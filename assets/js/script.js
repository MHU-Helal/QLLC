const state = {
  participants: [],
  homework: [],
  submissions: [],
  reports: [],
  selected: null,
  dataQuality: [],
  reportRangeLabel: "",
  rawChatText: "",
  settings: {
    homeworkMark: 2,
    zoomLink: "",
    youtubePlaylist: "",
    adminWhatsapp: "",
    importantLinks: "",
    acceptLateSubmissions: false,
    skipEmptyPdf: false,
    whatsappTemplate: "Assalamu alaikum {name}, Roll: {roll}, Email: {email}",
  },
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
    "qualityStatus",
    "participantRows",
    "searchInput",
    "selectedName",
    "selectedMeta",
    "preview",
    "pdfBtn",
    "excelBtn",
    "zipBtn",
    "processBtn",
    "settingsBtn",
    "homeworkMarkInput",
    "zoomLinkInput",
    "youtubePlaylistInput",
    "adminWhatsappInput",
    "importantLinksInput",
    "acceptLateInput",
    "skipEmptyPdfInput",
    "whatsappTemplateInput",
    "participantsFile",
    "homeworkFile",
    "chatFile",
    "previewModal",
    "settingsModal",
    "closeModalBtn",
    "closeSettingsBtn",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });

  els.processBtn.addEventListener("click", loadApp);
  loadSettings();
  bindSettings();
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
  els.settingsBtn.addEventListener("click", openSettingsModal);
  els.closeModalBtn.addEventListener("click", closePreviewModal);
  els.closeSettingsBtn.addEventListener("click", closeSettingsModal);
  els.previewModal
    .querySelector("[data-close-modal]")
    .addEventListener("click", closePreviewModal);
  els.settingsModal
    .querySelector("[data-close-settings]")
    .addEventListener("click", closeSettingsModal);

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

    state.participants = processParticipants(parseCsv(participantCsv));
    state.homework = parseCsv(homeworkCsv)
      .map(normalizeHomework)
      .filter(Boolean);
    state.rawChatText = chatText;
    state.submissions = parseChat(chatText, state.homework);
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

function parseChat(text, homeworkRows = []) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let current = null;
  const windowRange = getReportWindow(homeworkRows);
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
        (submittedAt < windowRange.start ||
          (windowRange.end && submittedAt > windowRange.end))
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

  const enrichedBlocks = blocks.map((block, index) =>
    enrichNearbySubmissionBlock(block, blocks, index),
  );

  return enrichedBlocks
    .map((block) => extractSubmission(block, homeworkRows))
    .filter((submission) => submission.homeworkNumbers.length > 0);
}

function enrichNearbySubmissionBlock(block, blocks, index) {
  const nearby = [block];
  for (let i = index - 1; i >= 0; i--) {
    if (!isNearbySameSender(block, blocks[i])) break;
    nearby.unshift(blocks[i]);
  }
  for (let i = index + 1; i < blocks.length; i++) {
    if (!isNearbySameSender(block, blocks[i])) break;
    nearby.push(blocks[i]);
  }
  return {
    ...block,
    body: nearby.map((item) => item.body).join("\n"),
    hasAttachment: nearby.some((item) => item.hasAttachment),
  };
}

function isNearbySameSender(base, candidate) {
  if (!candidate || base.sender !== candidate.sender) return false;
  return Math.abs(base.submittedAt - candidate.submittedAt) / 60000 <= 12;
}

function extractSubmission(block, homeworkRows) {
  const text = block.body.replace(/[=:_#*()[\]{}]/g, " ");
  let homeworkNumbers = extractHomeworkNumbers(text);
  if (!homeworkNumbers.length && looksLikeHomeworkSubmission(text, block)) {
    homeworkNumbers = inferHomeworkNumbersFromTime(block.submittedAt, homeworkRows);
  }
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

function looksLikeHomeworkSubmission(text, block) {
  return /\b(home\s*work|homework|h\s*\.?\s*w\s*\.?|hw|submitted|done)\b/i.test(text);
}

function inferHomeworkNumbersFromTime(submittedAt, homeworkRows) {
  const active = homeworkRows.filter((row) => {
    const start = new Date(row.assignedDate);
    start.setHours(0, 0, 0, 0);
    return submittedAt >= start && submittedAt <= row.deadline;
  });
  if (!active.length) return [];
  active.sort((a, b) => b.assignedDate - a.assignedDate);
  return [active[0].homeworkNo];
}

function getReportWindow(homeworkRows) {
  if (!homeworkRows.length) return null;
  const start = new Date(homeworkRows[0].assignedDate);
  start.setHours(0, 0, 0, 0);
  const end = state.settings.acceptLateSubmissions
    ? null
    : new Date(Math.max(...homeworkRows.map((row) => row.deadline.getTime())));
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
        const lateAccepted = Boolean(late && state.settings.acceptLateSubmissions);
        const status = valid
          ? "submitted"
          : lateAccepted
            ? "late-accepted"
            : late
              ? "late"
              : "not-submitted";
        return {
          ...assignment,
          submittedAt: chosen ? chosen.submittedAt : null,
          mark: valid || lateAccepted ? state.settings.homeworkMark : 0,
          status,
          matchMethod: chosen ? chosen.matchMethod : "",
          hasAttachment: chosen ? chosen.hasAttachment : false,
          override: false,
        };
      });

      const submitted = rows.filter((row) =>
        ["submitted", "late-accepted"].includes(row.status),
      ).length;
      const earnedMarks = rows.reduce((sum, row) => sum + row.mark, 0);
      const hasAnySubmission = rows.some((row) => row.submittedAt);
      const total = rows.length;
      const percent = total ? Math.round((submitted / total) * 10000) / 100 : 0;
      return {
        participant,
        rows,
        total,
        submitted,
        earnedMarks,
        hasAnySubmission,
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

function processParticipants(rows) {
  const rawParticipants = rows.map(normalizeParticipant).filter((participant) =>
    participant.name || participant.mobileKey || participant.rollKey,
  );
  const issues = [];
  const seenRows = new Map();
  const deduped = [];

  for (const participant of rawParticipants) {
    const exactKey = [
      participant.name.toLowerCase(),
      participant.mobileKey,
      participant.rollKey,
      participant.email.toLowerCase(),
      participant.moderator.toLowerCase(),
    ].join("|");
    if (seenRows.has(exactKey)) {
      issues.push({
        type: "Duplicate participant rows removed",
        detail: `${participant.name || "Unnamed"} ${participant.roll || participant.mobile || ""}`.trim(),
      });
      continue;
    }
    seenRows.set(exactKey, true);
    deduped.push(participant);
  }

  const byMobile = groupParticipants(deduped, "mobileKey");
  for (const group of byMobile.values()) {
    const rolls = uniqueValues(group.map((item) => item.rollKey));
    const missingRolls = group.filter((item) => !item.rollKey);
    if (group.length > 1) {
      issues.push({
        type: "Duplicate mobile numbers",
        detail: `${formatIssueNames(group)} share ${group[0].mobile || group[0].mobileKey}`,
      });
    }
    if (rolls.length === 1 && missingRolls.length) {
      fillMissingRolls(missingRolls, group.find((item) => item.rollKey === rolls[0]));
      issues.push({
        type: "Missing roll numbers filled",
        detail: `${formatIssueNames(missingRolls)} filled from mobile match ${group[0].mobile || group[0].mobileKey}`,
      });
    }
  }

  const byNameEmail = groupParticipants(deduped, (item) =>
    `${item.name.toLowerCase()}|${item.email.toLowerCase()}`,
  );
  for (const group of byNameEmail.values()) {
    const rolls = uniqueValues(group.map((item) => item.rollKey));
    const missingRolls = group.filter((item) => !item.rollKey);
    if (rolls.length === 1 && missingRolls.length) {
      fillMissingRolls(missingRolls, group.find((item) => item.rollKey === rolls[0]));
      issues.push({
        type: "Missing roll numbers filled",
        detail: `${formatIssueNames(missingRolls)} filled from matching name and email`,
      });
    }
  }

  const byRoll = groupParticipants(deduped, "rollKey");
  for (const group of byRoll.values()) {
    if (group.length > 1) {
      issues.push({
        type: "Duplicate roll numbers",
        detail: `${formatIssueNames(group)} share ${group[0].roll || group[0].rollKey}`,
      });
    }
  }

  state.dataQuality = issues;
  return deduped.map((participant, index) => ({ ...participant, id: `p-${index}` }));
}

function fillMissingRolls(participants, source) {
  if (!source) return;
  for (const participant of participants) {
    participant.roll = source.roll;
    participant.rollKey = source.rollKey;
  }
}

function groupParticipants(items, keyOrGetter) {
  const map = new Map();
  for (const item of items) {
    const key = typeof keyOrGetter === "function" ? keyOrGetter(item) : item[keyOrGetter];
    if (!key || key === "|") continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return new Map([...map.entries()].filter(([, group]) => group.length > 1));
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatIssueNames(group) {
  return group.map((item) => item.name || item.mobile || item.roll || "Unnamed").join(", ");
}

function renderAll() {
  renderStats();
  renderQualityStatus();
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
  state.dataQuality = [];
  state.selected = null;
  state.reportRangeLabel = "";
  state.rawChatText = "";
  els.reportRange.textContent = message;
  els.statsGrid.innerHTML = "";
  if (els.qualityStatus) els.qualityStatus.innerHTML = "";
  els.participantRows.innerHTML = `<tr><td colspan="8" class="empty-cell">${escapeHtml(message)}</td></tr>`;
  closePreviewModal();
  setBusy(false);
}

function renderRange() {
  if (!state.homework.length) {
    state.reportRangeLabel = "";
    els.reportRange.textContent = "No homework schedule found.";
    return;
  }
  const first = state.homework[0];
  const last = state.homework[state.homework.length - 1];
  state.reportRangeLabel = `${formatDate(first.assignedDate)} to ${formatDate(last.assignedDate)} | Homework ${first.homeworkNo}-${last.homeworkNo}`;
  els.reportRange.textContent = state.reportRangeLabel;
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
    ["Parsed submissions", state.submissions.length],
    ["Phone matches", matchedPhones],
  ];
  els.statsGrid.innerHTML = values
    .map(
      ([label, value]) =>
        `<div class="stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`,
    )
    .join("");
}

function renderQualityStatus() {
  if (!els.qualityStatus) return;
  if (!state.dataQuality.length) {
    els.qualityStatus.innerHTML = `
      <div class="status-box status-ok">
        <strong>Roster status</strong>
        <span>No duplicate rows, duplicate mobile numbers, duplicate roll numbers, or fillable missing rolls found.</span>
      </div>`;
    return;
  }

  const grouped = groupBy(state.dataQuality, "type");
  els.qualityStatus.innerHTML = `
    <div class="status-box">
      <div class="status-head">
        <strong>Roster status needs review</strong>
        <span>${state.dataQuality.length} item${state.dataQuality.length === 1 ? "" : "s"} found while cleaning participant data.</span>
      </div>
      <div class="status-list">
        ${[...grouped.entries()].map(([type, items]) => `
          <details>
            <summary>${escapeHtml(type)} (${items.length})</summary>
            <ul>${items.map((item) => `<li>${escapeHtml(item.detail)}</li>`).join("")}</ul>
          </details>`).join("")}
      </div>
    </div>`;
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
            <td>${whatsappLinkHtml(report.participant)}</td>
            <td>${escapeHtml(report.participant.moderator)}</td>
            <td>${report.submitted}/${report.total}</td>
            <td>${report.percent.toFixed(2)}%</td>
            <td>${report.earnedMarks}/${report.total * state.settings.homeworkMark}</td>
            <td>
                <div class="row-actions">
                    <button class="btn btn-compact preview-row" type="button" data-id="${report.participant.id}">Preview</button>
                    <button class="btn btn-compact edit-row" type="button" data-id="${report.participant.id}">Edit</button>
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
  els.participantRows.querySelectorAll(".edit-row").forEach((button) => {
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
                    <p>${escapeHtml(state.reportRangeLabel || els.reportRange.textContent)}</p>
                </div>
            </header>
            <div class="report-body">
                <div class="summary-grid summary-grid-two">
                    <div class="summary-cell">
                        <strong><span>Student information</span><br></strong>
                        ${escapeHtml(report.participant.name)}<br>
                        Roll: ${escapeHtml(report.participant.roll || "-")}<br>
                        Phone: ${escapeHtml(report.participant.mobile || "-")}<br>
                        Email: ${escapeHtml(report.participant.email || "-")}
                    </div>
                    <div class="summary-cell">
                        <strong><span>Report stats</span><br></strong>
                        Submitted: ${report.submitted}/${report.total}<br>
                        Marks: ${report.earnedMarks}/${report.total * state.settings.homeworkMark}<br>
                        Moderator: ${escapeHtml(report.participant.moderator || "-")}
                    </div>
                </div>
                <div class="override-panel">
                    <div>
                        <h3>Missing homework override</h3>
                        <p class="muted">Tick missing homeworks to count them as manually submitted before exporting this participant.</p>
                    </div>
                    <div class="override-grid">
                        ${report.rows
                          .map(
                            (row) => `<label class="check-row override-check">
                                <input type="checkbox" class="override-input" data-homework="${row.homeworkNo}" ${row.mark > 0 ? "checked" : ""} />
                                <span>HW ${row.homeworkNo}</span>
                            </label>`,
                          )
                          .join("")}
                    </div>
                    <button id="applyOverridesBtn" class="btn btn-secondary" type="button">Apply overrides</button>
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
                            <td class="mark-${row.status}">${row.mark}</td>
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
  const applyBtn = document.getElementById("applyOverridesBtn");
  if (applyBtn) {
    applyBtn.addEventListener("click", applyPreviewOverrides);
  }
}

function whatsappLinkHtml(participant) {
  if (!participant.mobileKey) return "-";
  const url = buildWhatsappUrl(participant);
  return `<a class="phone-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(participant.mobile || participant.mobileKey)}</a>`;
}

function buildWhatsappUrl(participant) {
  return `https://wa.me/${participant.mobileKey}?text=${encodeURIComponent(renderWhatsappTemplate(participant))}`;
}

function renderWhatsappTemplate(participant) {
  return (state.settings.whatsappTemplate || "")
    .replace(/\{name\}/gi, participant.name || "")
    .replace(/\{roll\}/gi, participant.roll || "")
    .replace(/\{email\}/gi, participant.email || "")
    .replace(/\{mobile\}/gi, participant.mobile || "");
}

function applyPreviewOverrides() {
  if (!state.selected) return;
  const checked = new Set(
    [...document.querySelectorAll(".override-input:checked")].map((input) =>
      Number(input.dataset.homework),
    ),
  );
  for (const row of state.selected.rows) {
    if (checked.has(row.homeworkNo) && row.mark === 0) {
      row.status = "manual";
      row.submittedAt = row.assignedDate;
      row.mark = state.settings.homeworkMark;
      row.override = true;
    } else if (!checked.has(row.homeworkNo) && row.override) {
      row.status = "not-submitted";
      row.submittedAt = null;
      row.mark = 0;
      row.override = false;
    }
  }
  refreshReportTotals(state.selected);
  renderParticipants();
  renderPreview();
}

function refreshReportTotals(report) {
  report.submitted = report.rows.filter((row) => row.mark > 0).length;
  report.earnedMarks = report.rows.reduce((sum, row) => sum + row.mark, 0);
  report.hasAnySubmission = report.rows.some((row) => row.submittedAt || row.override);
  report.missed = report.total - report.submitted;
  report.percent = report.total ? Math.round((report.submitted / report.total) * 10000) / 100 : 0;
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

function openSettingsModal() {
  els.settingsModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeSettingsModal() {
  if (!els.settingsModal) return;
  els.settingsModal.hidden = true;
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
        text: String(row.mark),
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
              stack: [{ image: "logo", alignment: "center", width: 54, margin: [0, 6, 0, 0] }],
              alignment: "center",
              fillColor: "#ffffff",
              margin: [10, 8, 10, 8],
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
                  text: `${state.reportRangeLabel || els.reportRange.textContent}`,
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
          summaryStack(
            "Student Information",
            [
              p.name,
              `Roll: ${p.roll || "-"}`,
              `Phone: ${p.mobile || "-"}`,
              `Email: ${p.email || "-"}`,
            ],
          ),
          summaryStack(
            "Report Stats",
            [
              `Submitted: ${report.submitted}/${report.total} (${report.percent.toFixed(2)}%)`,
              `Marks: ${report.earnedMarks}/${report.total * state.settings.homeworkMark}`,
              `Moderator: ${p.moderator || "-"}`,
            ],
          ),
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
      ...importantLinksPdfContent(report),
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

function importantLinksPdfContent(report) {
  const adminPhone = normalizePhone(state.settings.adminWhatsapp);
  const adminMessage = report ? renderWhatsappTemplate(report.participant) : "";
  const links = [
    state.settings.zoomLink && { label: "Zoom class", url: state.settings.zoomLink },
    state.settings.youtubePlaylist && { label: "YouTube playlist", url: state.settings.youtubePlaylist },
    adminPhone && {
      label: "Admin WhatsApp",
      url: `https://wa.me/${adminPhone}?text=${encodeURIComponent(adminMessage)}`,
      text: state.settings.adminWhatsapp,
    },
    ...state.settings.importantLinks.split(/\r?\n/).map(parseImportantLink),
  ].filter(Boolean);
  if (!links.length) return [];
  return [
    {
      text: "Important Links",
      bold: true,
      fontSize: 18,
      color: "#18395a",
      pageBreak: "before",
      margin: [22, 18, 22, 6],
    },
    {
      text: "Tap or click any item below to open the resource.",
      color: "#5c6d7e",
      margin: [22, 0, 22, 12],
    },
    {
      table: {
        widths: ["*", 130],
        body: links.map((item) => [
          {
            stack: [
              { text: item.label, bold: true, fontSize: 12, color: "#18395a" },
              { text: item.text || item.url, color: "#5c6d7e", fontSize: 9, margin: [0, 3, 0, 0] },
            ],
            link: item.url,
            margin: [12, 10, 12, 10],
          },
          {
            text: "Open link",
            link: item.url,
            color: "#ffffff",
            bold: true,
            alignment: "center",
            fillColor: "#2e6f9f",
            margin: [8, 12, 8, 12],
          },
        ]),
      },
      layout: {
        fillColor: (rowIndex, node, columnIndex) => columnIndex === 0 ? "#f3f6f9" : null,
        hLineColor: () => "#d8e0e8",
        vLineColor: () => "#d8e0e8",
      },
      margin: [22, 0, 22, 0],
    },
  ];
}

function parseImportantLink(line) {
  const value = clean(line);
  if (!value) return null;
  const url = (value.match(/https?:\/\/\S+/) || [value])[0];
  const label = value.replace(url, "").replace(/[-:|]+$/, "").trim() || "Important link";
  return { label, url, text: value };
}

function summaryStack(label, value) {
  const valueStack = Array.isArray(value)
    ? value.map((line, index) => ({
        text: String(line),
        style: "summaryValue",
        bold: index === 0,
        margin: [0, index === 0 ? 4 : 2, 0, 0],
      }))
    : [{ text: String(value), style: "summaryValue", margin: [0, 3, 0, 0] }];
  return {
    stack: [
      { text: label, style: "summaryLabel" },
      ...valueStack,
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
  if (status === "manual") return "Manually submitted";
  if (status === "late-accepted") return "Late accepted";
  if (status === "late") return "Late / missed";
  return "Not submitted";
}

function statusColor(status) {
  if (status === "submitted" || status === "late-accepted" || status === "manual") return "#087443";
  if (status === "late") return "#a36b00";
  return "#a33d2d";
}

async function exportPdfZip() {
  if (!state.reports.length) return;
  setBusy(true, "Creating PDF ZIP...", els.zipBtn);
  const zip = new JSZip();
  const reports = state.settings.skipEmptyPdf
    ? state.reports.filter((report) => report.submitted > 0)
    : state.reports;

  if (!reports.length) {
    setBusy(false);
    renderRange();
    return;
  }

  for (const report of reports) {
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
  setBusy(true, "Creating Excel...", els.excelBtn);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "QLLC Homework Reports";
  workbook.created = new Date();
  workbook.modified = new Date();

  const groups = groupReportsByModerator();
  for (const [moderator, reports] of groups) {
    const sheet = workbook.addWorksheet(safeSheetName(moderator || "Unassigned", workbook));
    setupDetailedSheet(sheet, `Moderator: ${moderator || "Unassigned"}`);
    reports.forEach((report) => {
      report.rows.forEach((row) => addHomeworkExcelRow(sheet, report, row));
    });
    styleDetailedSheet(sheet);
  }

  state.homework.forEach((homework) => {
    const sheet = workbook.addWorksheet(
      safeSheetName(`HW ${homework.homeworkNo}`, workbook),
    );
    setupDetailedSheet(sheet, `Homework ${homework.homeworkNo} - ${homework.dateLabel}`);
    state.reports.forEach((report) => {
      const row = report.rows.find(
        (item) => item.homeworkNo === homework.homeworkNo,
      );
      if (row) addHomeworkExcelRow(sheet, report, row);
    });
    styleDetailedSheet(sheet);
  });

  const summarySheet = workbook.addWorksheet(safeSheetName("Summary", workbook));
  setupSummarySheet(summarySheet);
  state.reports.forEach((report) => addSummaryExcelRow(summarySheet, report));
  styleDetailedSheet(summarySheet);

  const summaryIndex = workbook.worksheets.indexOf(summarySheet);
  if (summaryIndex > 0) {
    workbook.worksheets.splice(summaryIndex, 1);
    workbook.worksheets.unshift(summarySheet);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), "homework-report.xlsx");
  setBusy(false);
}

function setupDetailedSheet(sheet, title) {
  const columns = detailedExcelColumns();
  const lastColumn = columnLetter(columns.length);
  sheet.properties.defaultRowHeight = 22;
  sheet.views = [{ state: "frozen", ySplit: 2 }];
  sheet.columns = columns;
  sheet.spliceRows(1, 0, []);
  sheet.mergeCells(`A1:${lastColumn}1`);
  sheet.getCell("A1").value = title;
  sheet.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF18395A" },
  };
  sheet.getCell("A1").alignment = { vertical: "middle" };
  sheet.autoFilter = {
    from: "A2",
    to: `${lastColumn}2`,
  };
}

function setupSummarySheet(sheet) {
  const columns = [
    { header: "Name", key: "name", width: 28 },
    { header: "Student Number", key: "mobile", width: 18 },
    { header: "Roll", key: "roll", width: 16 },
    { header: "Email", key: "email", width: 28 },
    { header: "Moderator", key: "moderator", width: 14 },
    { header: "Submitted/Total", key: "submittedTotal", width: 18 },
    { header: "Marks Gained/Total", key: "marksTotal", width: 20 },
    { header: "Percentage", key: "percent", width: 14 },
  ];
  const lastColumn = columnLetter(columns.length);
  sheet.properties.defaultRowHeight = 22;
  sheet.views = [{ state: "frozen", ySplit: 2 }];
  sheet.columns = columns;
  sheet.spliceRows(1, 0, []);
  sheet.mergeCells(`A1:${lastColumn}1`);
  sheet.getCell("A1").value = "Homework Report Summary";
  sheet.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF18395A" },
  };
  sheet.getCell("A1").alignment = { vertical: "middle" };
  sheet.autoFilter = {
    from: "A2",
    to: `${lastColumn}2`,
  };
}

function detailedExcelColumns() {
  return [
    { header: "Name", key: "name", width: 28 },
    { header: "Student Number", key: "mobile", width: 18 },
    { header: "Roll", key: "roll", width: 16 },
    { header: "Email", key: "email", width: 28 },
    { header: "Moderator", key: "moderator", width: 14 },
    { header: "Homework No", key: "homeworkNo", width: 13 },
    { header: "Homework Assigned Date", key: "assignedDate", width: 24 },
    { header: "Homework Submitted Date Time", key: "submittedAt", width: 28 },
    { header: "Is Submitted", key: "isSubmitted", width: 13 },
    { header: "Status", key: "status", width: 16 },
    { header: "Mark", key: "mark", width: 10 },
    { header: "Submitted/Total", key: "submittedTotal", width: 18 },
    { header: "Marks Gained/Total", key: "marksTotal", width: 20 },
  ];
}

function addHomeworkExcelRow(sheet, report, row) {
  const totalMark = report.total * state.settings.homeworkMark;
  sheet.addRow({
    name: report.participant.name,
    mobile: report.participant.mobile,
    roll: report.participant.roll,
    email: report.participant.email,
    moderator: report.participant.moderator,
    homeworkNo: row.homeworkNo,
    assignedDate: row.dateLabel,
    submittedAt: row.submittedAt ? formatDateTime(row.submittedAt) : "",
    isSubmitted: row.mark > 0 ? "Yes" : "No",
    status: statusLabel(row.status),
    mark: row.mark,
    submittedTotal: `${report.submitted}/${report.total}`,
    marksTotal: `${report.earnedMarks}/${totalMark}`,
  });
}

function addSummaryExcelRow(sheet, report) {
  const totalMark = report.total * state.settings.homeworkMark;
  sheet.addRow({
    name: report.participant.name,
    mobile: report.participant.mobile,
    roll: report.participant.roll,
    email: report.participant.email,
    moderator: report.participant.moderator,
    submittedTotal: `${report.submitted}/${report.total}`,
    marksTotal: `${report.earnedMarks}/${totalMark}`,
    percent: report.percent / 100,
  });
  sheet.getColumn("percent").numFmt = "0.00%";
}

function styleDetailedSheet(sheet) {
  const header = sheet.getRow(2);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF244A70" },
  };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.height = 30;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return;
    row.alignment = { vertical: "top", wrapText: true };
    if (rowNumber % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF5F8FB" },
      };
    }
  });
}

function columnLetter(index) {
  let value = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }
  return value || "A";
}

function safeSheetName(value, workbook) {
  const base = String(value || "Sheet")
    .replace(/[\\/?*[\]:]/g, "-")
    .slice(0, 31)
    .trim() || "Sheet";
  let name = base;
  let index = 2;
  while (workbook.getWorksheet(name)) {
    const suffix = ` ${index}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }
  return name;
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

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("qllcHomeworkSettings") || "{}");
    state.settings = {
      ...state.settings,
      ...saved,
      homeworkMark: normalizeNonNegativeNumber(saved.homeworkMark, 2),
    };
  } catch (error) {
    console.warn("Could not load report settings.", error);
  }
  renderSettings();
}

function bindSettings() {
  [
    "homeworkMarkInput",
    "zoomLinkInput",
    "youtubePlaylistInput",
    "adminWhatsappInput",
    "importantLinksInput",
    "acceptLateInput",
    "skipEmptyPdfInput",
    "whatsappTemplateInput",
  ].forEach((key) => {
    if (!els[key]) return;
    els[key].addEventListener("input", updateSettingsFromForm);
    els[key].addEventListener("change", updateSettingsFromForm);
  });
}

function renderSettings() {
  if (!els.homeworkMarkInput) return;
  els.homeworkMarkInput.value = state.settings.homeworkMark;
  els.zoomLinkInput.value = state.settings.zoomLink || "";
  els.youtubePlaylistInput.value = state.settings.youtubePlaylist || "";
  els.adminWhatsappInput.value = state.settings.adminWhatsapp || "";
  els.importantLinksInput.value = state.settings.importantLinks || "";
  els.acceptLateInput.checked = state.settings.acceptLateSubmissions;
  els.skipEmptyPdfInput.checked = state.settings.skipEmptyPdf;
  els.whatsappTemplateInput.value = state.settings.whatsappTemplate || "";
}

function updateSettingsFromForm() {
  const previousAcceptLate = state.settings.acceptLateSubmissions;
  state.settings = {
    homeworkMark: normalizeNonNegativeNumber(els.homeworkMarkInput.value, 2),
    zoomLink: clean(els.zoomLinkInput?.value),
    youtubePlaylist: clean(els.youtubePlaylistInput?.value),
    adminWhatsapp: clean(els.adminWhatsappInput?.value),
    importantLinks: clean(els.importantLinksInput?.value),
    acceptLateSubmissions: Boolean(els.acceptLateInput?.checked),
    skipEmptyPdf: Boolean(els.skipEmptyPdfInput?.checked),
    whatsappTemplate: clean(els.whatsappTemplateInput?.value) || "Assalamu alaikum {name}, Roll: {roll}, Email: {email}",
  };
  localStorage.setItem("qllcHomeworkSettings", JSON.stringify(state.settings));
  if (state.participants.length && state.homework.length) {
    if (previousAcceptLate !== state.settings.acceptLateSubmissions) {
      state.submissions = parseChat(state.rawChatText, state.homework);
    }
    state.reports = buildReports(
      state.participants,
      state.homework,
      state.submissions,
    );
    renderAll();
  }
}

function normalizeNonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
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

function setBusy(isBusy, message = "", activeButton = null) {
  [els.processBtn, els.excelBtn, els.zipBtn, els.pdfBtn]
    .filter(Boolean)
    .forEach((button) => {
      const needsReports = button === els.excelBtn || button === els.zipBtn;
      button.disabled =
        isBusy ||
        (button === els.pdfBtn && !state.selected) ||
        (needsReports && !state.reports.length);
      if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent;
      button.textContent = isBusy && button === activeButton
        ? message
        : button.dataset.defaultText;
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
