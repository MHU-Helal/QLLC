const state = {
  participants: [],
  homework: [],
  submissions: [],
  reports: [],
  selected: null,
  files: {
    participants: null,
    homework: null,
    chat: null,
  },
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  [
    "reportRange",
    "statsGrid",
    "participantRows",
    "searchInput",
    "selectedName",
    "selectedMeta",
    "preview",
    "pdfBtn",
    "excelBtn",
    "zipBtn",
    "processBtn",
    "participantsFile",
    "homeworkFile",
    "chatFile",
    "previewModal",
    "closeModalBtn",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });

  els.processBtn.addEventListener("click", loadApp);
  els.participantsFile.addEventListener("change", () => handleFileChange("participants", els.participantsFile.files[0]));
  els.homeworkFile.addEventListener("change", () => handleFileChange("homework", els.homeworkFile.files[0]));
  els.chatFile.addEventListener("change", () => handleFileChange("chat", els.chatFile.files[0]));

  // Testing with default files
  // async function getSampleFile(path, name, type) {
  //   const response = await fetch(path);
  //   if (!response.ok) {
  //     throw new Error(`Failed to load ${path}: ${response.status}`);
  //   }
  //   const blob = await response.blob();
  //   return new File([blob], name, { type });
  // }

  // async function loadDefaults() {
  //   try {
  //     const participants = await getSampleFile(
  //       "./data/MasterLists.csv",
  //       "MasterLists.csv",
  //       "text/csv",
  //     );
  //     handleFileChange("participants", participants);

  //     const homework = await getSampleFile(
  //       "./data/homework.csv",
  //       "homework.csv",
  //       "text/plain",
  //     );
  //     handleFileChange("homework", homework);

  //     const chat = await getSampleFile(
  //       "./data/Chat.txt",
  //       "Chat.txt",
  //       "text/plain",
  //     );
  //     handleFileChange("chat", chat);
  //   } catch (err) {
  //     console.error("Error loading sample files:", err);
  //   }
  // }

  // window.addEventListener("DOMContentLoaded", () => {
  //   loadDefaults();
  // });

  // Testing with default files
  els.searchInput.addEventListener("input", renderParticipants);
  els.pdfBtn.addEventListener(
    "click",
    () => state.selected && downloadParticipantPdf(state.selected),
  );
  els.excelBtn.addEventListener("click", exportExcel);
  els.zipBtn.addEventListener("click", exportPdfZip);
  els.closeModalBtn.addEventListener("click", closePreviewModal);
  els.previewModal
    .querySelector("[data-close-modal]")
    .addEventListener("click", closePreviewModal);

  configurePdfFonts();
  renderEmptyState();
});
async function loadApp() {
  if (!hasRequiredFiles()) {
    renderEmptyState(
      "Upload all three required files to populate the participant list.",
    );
    return;
  }

  setBusy(true, "Processing uploaded files...");
  try {
    const [participantCsv, homeworkCsv, chatText] = await Promise.all([
      readFileText(state.files.participants),
      readFileText(state.files.homework),
      readFileText(state.files.chat),
      $(".upload-grid").fadeOut(500),
    ]);

    state.participants = parseCsv(participantCsv).map(normalizeParticipant);
    state.homework = parseCsv(homeworkCsv)
      .map(normalizeHomework)
      .filter(Boolean);
    state.submissions = parseChat(chatText, getReportWindow(state.homework));
    state.reports = buildReports(
      state.participants,
      state.homework,
      state.submissions,
    );
    state.selected = null;

    renderAll();
    setBusy(false);
  } catch (error) {
    console.error(error);
    renderEmptyState(
      "Could not process the uploaded files. Check that the files match the required formats.",
    );
    setBusy(false);
  }
}

function handleFileChange(type, file) {
  state.files[type] = file || null;
  if (hasRequiredFiles()) {
    loadApp();
  } else {
    renderEmptyState(
      "Upload all three required files to populate the participant list.",
    );
  }
}

function hasRequiredFiles() {
  return Boolean(
    state.files.participants && state.files.homework && state.files.chat,
  );
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function parseCsv(text) {
  return Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  }).data;
}

function normalizeParticipant(row, index) {
  const mobileRaw = clean(row.Mobile);
  return {
    id: `p-${index}`,
    name: clean(row.Name),
    mobile: mobileRaw,
    mobileKey: normalizePhone(mobileRaw),
    roll: formatRoll(row.Roll),
    rollKey: normalizeRoll(row.Roll),
    country: clean(row.Country),
    email: clean(row.Email),
    moderator: clean(row.Moderator) || "Unassigned",
    remarks: clean(row.Remarks),
  };
}

function normalizeHomework(row) {
  const assignedDate = parseDate(clean(row.dates));
  const homeworkNo = parseInt(clean(row.homework), 10);
  if (!assignedDate || Number.isNaN(homeworkNo)) return null;
  const periodHours = parseInt(clean(row["submit period"]), 10) || 24;
  const deadline = new Date(
    assignedDate.getTime() + periodHours * 60 * 60 * 1000,
  );
  return {
    assignedDate,
    dateLabel: formatDate(assignedDate),
    homeworkNo,
    periodHours,
    deadline,
  };
}

function parseChat(text, windowRange) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let current = null;
  const startPattern =
    /^(\d{1,2}\/\d{1,2}\/\d{2}),\s+(\d{1,2}:\d{2})\s*([AP]M)\s+-\s+([^:]+):\s?(.*)$/i;

  for (const line of lines) {
    const normalized = line.replace(/\u202f|\u200e|\u200f/g, " ").trimEnd();
    const match = normalized.match(startPattern);
    if (match) {
      if (current) blocks.push(current);
      const submittedAt = parseChatDate(match[1], match[2], match[3]);
      if (
        windowRange &&
        (submittedAt < windowRange.start || submittedAt > windowRange.end)
      ) {
        current = null;
        continue;
      }
      current = {
        submittedAt,
        sender: clean(match[4]),
        body: match[5] || "",
        hasAttachment: /(file attached|<Media omitted>)/i.test(match[5] || ""),
      };
    } else if (current) {
      current.body += `\n${normalized}`;
      if (/(file attached|<Media omitted>)/i.test(normalized))
        current.hasAttachment = true;
    }
  }
  if (current) blocks.push(current);

  return blocks
    .map(extractSubmission)
    .filter(
      (submission) =>
        submission.homeworkNumbers.length > 0 || submission.hasAttachment,
    );
}

function extractSubmission(block) {
  const text = block.body.replace(/[=:_#*()[\]{}]/g, " ");
  const homeworkNumbers = extractHomeworkNumbers(text);
  const rollKey = normalizeRoll(
    (text.match(
      /\b(?:roll|id|r)\s*(?:no|number)?\s*[-:]?\s*([A-Z]{1,3}\s*[-.]?\s*\d+\s*[-.]?\s*\d*|\d{2,6})/i,
    ) || [])[1],
  );
  return {
    submittedAt: block.submittedAt,
    sender: block.sender,
    senderPhoneKey: normalizePhone(block.sender),
    body: block.body,
    homeworkNumbers,
    rollKey,
    hasAttachment: block.hasAttachment,
  };
}

function getReportWindow(homeworkRows) {
  if (!homeworkRows.length) return null;
  const start = new Date(homeworkRows[0].assignedDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(
    Math.max(...homeworkRows.map((row) => row.deadline.getTime())),
  );
  return { start, end };
}

function extractHomeworkNumbers(text) {
  const numbers = new Set();
  const patterns = [
    /\b(?:home\s*work|homework|h\s*\.?\s*w\s*\.?|hw|h\s*\.?\s*m\s*\.?)\s*(?:no|number)?\s*[-:]?\s*([0-9,\s.&-]{1,30})/gi,
    /\b(?:quranic\s+vocabulary\s+hw)\s*([0-9,\s.&-]{1,30})/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      expandNumberList(match[1]).forEach((number) => numbers.add(number));
    }
  }

  return [...numbers].filter((number) => number > 0 && number < 1000);
}

function expandNumberList(value) {
  const output = [];
  const cleaned = String(value || "").replace(/\band\b|&/gi, ",");
  for (const part of cleaned.split(",")) {
    const range = part.match(/(\d{1,3})\s*-\s*(\d{1,3})/);
    if (range) {
      const start = parseInt(range[1], 10);
      const end = parseInt(range[2], 10);
      if (end >= start && end - start <= 60) {
        for (let n = start; n <= end; n++) output.push(n);
      }
      continue;
    }
    const single = part.match(/\d{1,3}/);
    if (single) output.push(parseInt(single[0], 10));
  }
  return output;
}

function buildReports(participants, homeworkRows, submissions) {
  const byPhone = groupBy(
    submissions.filter((item) => item.senderPhoneKey),
    "senderPhoneKey",
  );
  const byRoll = groupBy(
    submissions.filter((item) => item.rollKey),
    "rollKey",
  );

  return participants
    .map((participant) => {
      const candidates = uniqueSubmissions([
        ...(byPhone.get(participant.mobileKey) || []).map((item) => ({
          ...item,
          matchMethod: "phone",
        })),
        ...(participant.rollKey
          ? (byRoll.get(participant.rollKey) || []).map((item) => ({
              ...item,
              matchMethod: "roll",
            }))
          : []),
      ]);

      const rows = homeworkRows.map((assignment) => {
        const attempts = candidates
          .filter((submission) =>
            submission.homeworkNumbers.includes(assignment.homeworkNo),
          )
          .sort((a, b) => a.submittedAt - b.submittedAt);
        const valid = attempts.find(
          (submission) => submission.submittedAt <= assignment.deadline,
        );
        const late = !valid && attempts[0];
        const chosen = valid || late || null;
        const status = valid ? "submitted" : late ? "late" : "not-submitted";
        return {
          ...assignment,
          submittedAt: chosen ? chosen.submittedAt : null,
          mark: valid ? 1 : 0,
          status,
          matchMethod: chosen ? chosen.matchMethod : "",
          hasAttachment: chosen ? chosen.hasAttachment : false,
        };
      });

      const submitted = rows.reduce((sum, row) => sum + row.mark, 0);
      const total = rows.length;
      const percent = total ? Math.round((submitted / total) * 10000) / 100 : 0;
      return {
        participant,
        rows,
        total,
        submitted,
        missed: total - submitted,
        percent,
      };
    })
    .sort(
      (a, b) =>
        b.submitted - a.submitted ||
        b.percent - a.percent ||
        a.participant.name.localeCompare(b.participant.name),
    );
}

function uniqueSubmissions(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.senderPhoneKey}|${item.submittedAt ? item.submittedAt.toISOString() : ""}|${item.body.slice(0, 40)}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

function renderAll() {
  renderStats();
  renderRange();
  renderParticipants();
  closePreviewModal();
}

function renderEmptyState(
  message = "Upload the participants list, homework list, and WhatsApp chat export to begin.",
) {
  state.participants = [];
  state.homework = [];
  state.submissions = [];
  state.reports = [];
  state.selected = null;
  els.reportRange.textContent = message;
  els.statsGrid.innerHTML = "";
  els.participantRows.innerHTML = `<tr><td colspan="6" class="empty-cell">${escapeHtml(message)}</td></tr>`;
  closePreviewModal();
  setBusy(false);
}

function renderRange() {
  if (!state.homework.length) {
    els.reportRange.textContent = "No homework schedule found.";
    return;
  }
  const first = state.homework[0];
  const last = state.homework[state.homework.length - 1];
  els.reportRange.textContent = `${formatDate(first.assignedDate)} to ${formatDate(last.assignedDate)} | Homework ${first.homeworkNo}-${last.homeworkNo}`;
}

function renderStats() {
  const moderatorCount = new Set(
    state.participants.map((item) => item.moderator),
  ).size;
  const matchedPhones = state.participants.filter((participant) =>
    state.submissions.some(
      (submission) => submission.senderPhoneKey === participant.mobileKey,
    ),
  ).length;
  const values = [
    ["Participants", state.participants.length],
    ["Homework days", state.homework.length],
    ["Moderators", moderatorCount],
    ["Chat submissions", state.submissions.length],
    ["Phone matches", matchedPhones],
  ];
  els.statsGrid.innerHTML = values
    .map(
      ([label, value]) =>
        `<div class="stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`,
    )
    .join("");
}

function renderParticipants() {
  const query = els.searchInput.value.trim().toLowerCase();
  const reports = state.reports.filter(({ participant }) => {
    const haystack =
      `${participant.name} ${participant.roll} ${participant.mobile} ${participant.moderator}`.toLowerCase();
    return !query || haystack.includes(query);
  });

  els.participantRows.innerHTML = reports
    .map((report) => {
      const active =
        state.selected &&
        state.selected.participant.id === report.participant.id
          ? "active"
          : "";
      return `<tr class="${active}" data-id="${report.participant.id}">
            <td>${escapeHtml(report.participant.name)}</td>
            <td>${escapeHtml(report.participant.roll || "-")}</td>
            <td>${escapeHtml(report.participant.moderator)}</td>
            <td>${report.percent.toFixed(2)}%</td>
            <td>${report.submitted}/${report.total}</td>
            <td>
                <div class="row-actions">
                    <button class="btn btn-compact preview-row" type="button" data-id="${report.participant.id}">Preview</button>
                    <button class="btn btn-compact btn-primary download-row" type="button" data-id="${report.participant.id}">PDF</button>
                </div>
            </td>
        </tr>`;
    })
    .join("");

  els.participantRows.querySelectorAll(".preview-row").forEach((button) => {
    button.addEventListener("click", () => {
      state.selected = state.reports.find(
        (report) => report.participant.id === button.dataset.id,
      );
      renderParticipants();
      renderPreview();
      openPreviewModal();
    });
  });
  els.participantRows.querySelectorAll(".download-row").forEach((button) => {
    button.addEventListener("click", () => {
      const report = state.reports.find(
        (item) => item.participant.id === button.dataset.id,
      );
      if (report) downloadParticipantPdf(report);
    });
  });
}

function renderPreview() {
  const report = state.selected;
  if (!report) {
    els.selectedName.textContent = "Report preview";
    els.selectedMeta.textContent =
      "Use a row Preview button to show the homework table.";
    els.preview.textContent = "Report preview will appear here.";
    els.pdfBtn.disabled = true;
    return;
  }

  els.pdfBtn.disabled = false;
  els.selectedName.textContent = report.participant.name;
  els.selectedMeta.textContent = `${report.participant.roll || "No roll"} | ${report.participant.mobile || "No mobile"} | Moderator ${report.participant.moderator}`;
  els.preview.className = "";
  els.preview.innerHTML = `
        <article class="report-page">
            <header class="report-header">
                <div class="logo-mark"><img src="./assets/img/QLLC.png" alt="QLLC"></div>
                <div>
                    <h2>Monthly Homework Report</h2>
                    <p>${escapeHtml(els.reportRange.textContent)}</p>
                </div>
            </header>
            <div class="report-body">
                <div class="summary-grid">
                    <div class="summary-cell"><strong><span>Name</span><br></strong>${escapeHtml(report.participant.name)}</div>
                    <div class="summary-cell"><strong><span>Roll</span><br></strong>${escapeHtml(report.participant.roll || "-")}</div>
                    <div class="summary-cell"><strong><span>Homework</span><br></strong>${report.submitted}/${report.total}</div>
                    <div class="summary-cell"><strong><span>Submission</span><br></strong>${report.percent.toFixed(2)}%</div>
                </div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Assigned date</th>
                            <th class="rth">Homework</th>
                            <th class="rth">Submitted at</th>
                            <th class="rth">Status</th>
                            <th>Mark</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.rows
                          .map(
                            (row) => `<tr>
                            <td>${escapeHtml(row.dateLabel)}</td>
                            <td>${row.homeworkNo}</td>
                            <td>${escapeHtml(row.submittedAt ? formatDateTime(row.submittedAt) : "-")}</td>
                            <td>${escapeHtml(statusLabel(row.status))}</td>
                            <td class="mark-${row.status}">${row.mark * 2}</td>
                        </tr>`,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
            <footer class="report-footer">
                <span>Quraner Alo Foundation - Student Report</span>
            </footer>
        </article>`;
}

function openPreviewModal() {
  els.previewModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closePreviewModal() {
  if (!els.previewModal) return;
  els.previewModal.hidden = true;
  document.body.classList.remove("modal-open");
}

const QLLClogo = `data:image/png;base64,${QLLCLogo}`; // your full base64
function buildPdfDefinition(report) {
  //   const logo = QLLCLogo;
  const p = report.participant;
  const body = [
    [
      {
        text: "Assigned date",
        style: "tableHeader",
        alignment: "center",
        bold: true,
      },
      {
        text: "Homework",
        style: "tableHeader",
        alignment: "center",
        bold: true,
      },
      {
        text: "Submitted at",
        style: "tableHeader",
        alignment: "center",
        bold: true,
      },
      { text: "Status", style: "tableHeader", alignment: "center", bold: true },
      { text: "Mark", style: "tableHeader", alignment: "center", bold: true },
    ],
    ...report.rows.map((row) => [
      { text: row.dateLabel, alignment: "center" },
      {
        text: String(row.homeworkNo),
        alignment: "center",
      },
      {
        text: row.submittedAt ? formatDateTime(row.submittedAt) : "-",
        alignment: "center",
      },
      {
        text: statusLabel(row.status),
        color: statusColor(row.status),
        bold: row.status !== "submitted",
        alignment: "center",
      },
      {
        text: String(row.mark * 2),
        color: row.mark ? "#087443" : "#a33d2d",
        bold: true,
        alignment: "center",
      },
    ]),
  ];

  return {
    pageSize: "A4",
    pageMargins: [0, 76, 0, 42],
    defaultStyle: { font: getPdfFont(), fontSize: 9, color: "#17212b" },
    header: () => ({
      margin: [0, 0, 0, 0],
      table: {
        widths: [92, "*"],
        body: [
          [
            {
              image: "logo",
              alignment: "center",
              width: 60,
              //   fillColor: "#18395a",
              margin: [0, 2, 0, 0],
            },
            {
              stack: [
                {
                  text: "Monthly Homework Report",
                  bold: true,
                  fontSize: 17,
                  color: "#ffffff",
                },
                {
                  text: `${els.reportRange.textContent}`,
                  color: "#dbe7f3",
                  margin: [0, 4, 0, 0],
                },
              ],
              fillColor: "#18395a",
              margin: [14, 14, 14, 12],
            },
          ],
        ],
      },
      layout: "noBorders",
    }),
    footer: (currentPage, pageCount) => ({
      margin: [0, 0, 0, 0],
      table: {
        widths: ["*", 80],
        heights: [42],
        body: [
          [
            {
              text: "Quraner Alo Foundation - Student Report",
              color: "#ffffff",
              fillColor: "#18395a",
              margin: [18, 13, 0, 0],
            },
            {
              text: `${currentPage}/${pageCount}`,
              color: "#ffffff",
              alignment: "right",
              fillColor: "#18395a",
              margin: [0, 13, 18, 0],
            },
          ],
        ],
      },
      layout: "noBorders",
    }),
    content: [
      {
        columns: [
          summaryStack("Name", p.name),
          summaryStack("Roll", p.roll || "-"),
          summaryStack("Moderator", p.moderator),
          summaryStack(
            "Submitted",
            `${report.submitted}/${report.total} (${report.percent.toFixed(2)}%)`,
          ),
          summaryStack("Marks", report.submitted * 2),
        ],
        columnGap: 8,
        margin: [22, 14, 22, 14],
      },
      {
        margin: [22, 0, 22, 0],
        table: {
          headerRows: 1,
          widths: [70, 70, "*", 82, 45],
          body,
          alignment: "center",
          valign: "middle",
        },
        layout: {
          fillColor: (rowIndex) =>
            rowIndex === 0 ? "#2e6f9f" : rowIndex % 2 === 0 ? "#f5f8fb" : null,
          hLineColor: () => "#d8e0e8",
          vLineColor: () => "#d8e0e8",
        },
      },
    ],
    styles: {
      tableHeader: { color: "#ffffff", bold: true, margin: [4, 5, 4, 5] },
      summaryLabel: { color: "#5c6d7e", fontSize: 8 },
      summaryValue: { bold: true, fontSize: 10 },
    },
    images: {
      logo: QLLClogo, // inject your base64 constant here
    },
  };
}

function summaryStack(label, value) {
  return {
    stack: [
      { text: label, style: "summaryLabel" },
      { text: String(value), style: "summaryValue", margin: [0, 3, 0, 0] },
    ],
    fillColor: "#f3f6f9",
    margin: [8, 8, 8, 8],
  };
}

function downloadParticipantPdf(report) {
  pdfMake
    .createPdf(buildPdfDefinition(report))
    .download(
      fileName(
        `${report.participant.roll || report.participant.name}-report.pdf`,
      ),
    );
}

function statusLabel(status) {
  if (status === "submitted") return "Submitted";
  if (status === "late") return "Late / missed";
  return "Not submitted";
}

function statusColor(status) {
  if (status === "submitted") return "#087443";
  if (status === "late") return "#a36b00";
  return "#a33d2d";
}

async function exportPdfZip() {
  if (!state.reports.length) return;
  setBusy(true, "Creating PDF ZIP...");
  const zip = new JSZip();

  for (const report of state.reports) {
    const folder = zip.folder(
      fileName(report.participant.moderator || "Unassigned"),
    );
    const blob = await pdfBlob(buildPdfDefinition(report));
    folder.file(
      fileName(
        `${report.participant.roll || report.participant.name}-${report.participant.name}.pdf`,
      ),
      blob,
    );
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  saveAs(zipBlob, "homework-reports-by-moderator.zip");
  setBusy(false);
}

function pdfBlob(definition) {
  return new Promise((resolve) =>
    pdfMake.createPdf(definition).getBlob(resolve),
  );
}

async function exportExcel() {
  if (!state.reports.length) return;
  setBusy(true, "Creating Excel workbook...");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "QLLC Homework Reports";

  const groups = groupReportsByModerator();
  for (const [moderator, reports] of groups) {
    const sheet = workbook.addWorksheet(moderator.slice(0, 31) || "Unassigned");
    sheet.columns = [
      { header: "Name", key: "name", width: 28 },
      { header: "Mobile", key: "mobile", width: 18 },
      { header: "Roll", key: "roll", width: 16 },
      { header: "Moderator", key: "moderator", width: 12 },
      { header: "Submitted", key: "submitted", width: 12 },
      { header: "Total", key: "total", width: 10 },
      { header: "Percentage", key: "percent", width: 14 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF244A70" },
    };
    reports.forEach((report) => {
      sheet.addRow({
        name: report.participant.name,
        mobile: report.participant.mobile,
        roll: report.participant.roll,
        moderator: report.participant.moderator,
        submitted: report.submitted,
        total: report.total,
        percent: report.percent / 100,
      });
    });
    sheet.getColumn("percent").numFmt = "0.00%";
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), "homework-report.xlsx");
  setBusy(false);
}

function groupReportsByModerator() {
  const groups = new Map();
  for (const report of state.reports) {
    const key = report.participant.moderator || "Unassigned";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(report);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function configurePdfFonts() {
  if (typeof pdfMake === "undefined") return;
  if (typeof BENGALI_FONT_BASE64 === "string") {
    pdfMake.vfs = pdfMake.vfs || {};
    pdfMake.vfs["NotoSansBengali-Regular.ttf"] = BENGALI_FONT_BASE64;
    pdfMake.fonts = {
      NotoSansBengali: {
        normal: "NotoSansBengali-Regular.ttf",
        bold: "NotoSansBengali-Regular.ttf",
        italics: "NotoSansBengali-Regular.ttf",
        bolditalics: "NotoSansBengali-Regular.ttf",
      },
      Roboto: {
        normal: "Roboto-Regular.ttf",
        bold: "Roboto-Bold.ttf",
        italics: "Roboto-Italic.ttf",
        bolditalics: "Roboto-BoldItalic.ttf",
      },
    };
  }
}

function getPdfFont() {
  return typeof BENGALI_FONT_BASE64 === "string" ? "NotoSansBengali" : "Roboto";
}

function setBusy(isBusy, message = "") {
  [els.processBtn, els.excelBtn, els.zipBtn, els.pdfBtn]
    .filter(Boolean)
    .forEach((button) => {
      const needsReports = button === els.excelBtn || button === els.zipBtn;
      button.disabled =
        isBusy ||
        (button === els.pdfBtn && !state.selected) ||
        (needsReports && !state.reports.length);
    });
  if (els.processBtn) els.processBtn.disabled = isBusy || !hasRequiredFiles();
  if (message) els.reportRange.textContent = message;
}

function groupBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const value = item[key];
    if (!value) continue;
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(item);
  }
  return map;
}

function clean(value) {
  return String(value || "")
    .replace(/\u202f|\u200e|\u200f/g, " ")
    .trim();
}

function normalizePhone(value) {
  const digits = clean(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11)
    return `880${digits.slice(1)}`;
  return digits;
}

function normalizeRoll(value) {
  const text = clean(value).toUpperCase();
  if (!text) return "";
  const match = text.match(/([A-Z]{1,3})\s*[-.]?\s*(\d+)(?:\s*[-.]?\s*(\d+))?/);
  if (!match) return text.replace(/\s+/g, "");
  const prefix = match[1];
  const first = match[2];
  const second = match[3];
  return second ? `${prefix}${first}-${second}` : `${prefix}-${first}`;
}

function formatRoll(value) {
  const text = clean(value).toUpperCase();
  if (!text) return "";
  const match = text.match(/([A-Z]{1,3})\s*[-.]?\s*(\d+)(?:\s*[-.]?\s*(\d+))?/);
  if (!match) return text.replace(/\s+/g, "");
  const prefix = match[1];
  const first = match[2];
  const second = match[3];
  return second ? `${prefix}${first}-${second}` : `${prefix}-${first}`;
}

function parseDate(value) {
  const parts = clean(value).match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (!parts) return null;
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const year = normalizeYear(parseInt(parts[3], 10));
  return new Date(year, month, day, 23, 59, 59, 999);
}

function parseChatDate(datePart, timePart, ampm) {
  const [month, day, yearRaw] = datePart
    .split("/")
    .map((value) => parseInt(value, 10));
  let [hour, minute] = timePart.split(":").map((value) => parseInt(value, 10));
  if (/pm/i.test(ampm) && hour !== 12) hour += 12;
  if (/am/i.test(ampm) && hour === 12) hour = 0;
  return new Date(normalizeYear(yearRaw), month - 1, day, hour, minute, 0, 0);
}

function normalizeYear(year) {
  return year < 100 ? 2000 + year : year;
}

function formatDate(date) {
  if (!date) return "-";
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const year = parts.find((part) => part.type === "year")?.value || "";
  return `${day} ${month}, ${year}`;
}

function formatDateTime(date) {
  if (!date) return "-";
  return `${formatDate(date)} | ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );
}

function fileName(value) {
  return String(value || "report")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
