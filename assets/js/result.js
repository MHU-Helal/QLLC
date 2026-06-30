const resultState = {
  students: [],
  results: [],
  reports: [],
  selected: null,
  files: { students: null, results: null },
  settings: {
    totalMarks: 100,
    headerTitle: "Monthly Result Report",
    footerText: "Quraner Alo Foundation - Student Report",
    adminWhatsapp: "",
    classLink: "",
    youtubeLink: "",
    importantLinks: "",
  },
};

const resultEls = {};

document.addEventListener("DOMContentLoaded", () => {
  [
    "resultRange",
    "resultStatsGrid",
    "resultRows",
    "resultSearchInput",
    "resultSelectedName",
    "resultSelectedMeta",
    "resultPreview",
    "resultPdfBtn",
    "resultZipBtn",
    "resultProcessBtn",
    "resultSettingsBtn",
    "resultUploadGrid",
    "studentsFile",
    "resultsFile",
    "resultPreviewModal",
    "resultCloseModalBtn",
    "resultSettingsModal",
    "resultCloseSettingsBtn",
    "resultTotalMarksInput",
    "resultHeaderInput",
    "resultFooterInput",
    "resultAdminWhatsappInput",
    "resultClassLinkInput",
    "resultYoutubeLinkInput",
    "resultImportantLinksInput",
  ].forEach((id) => {
    resultEls[id] = document.getElementById(id);
  });

  loadResultSettings();
  bindResultSettings();
  resultEls.studentsFile.addEventListener("change", () => handleResultFile("students", resultEls.studentsFile.files[0]));
  resultEls.resultsFile.addEventListener("change", () => handleResultFile("results", resultEls.resultsFile.files[0]));
  resultEls.resultProcessBtn.addEventListener("click", loadResultApp);
  resultEls.resultSearchInput.addEventListener("input", renderResultRows);
  resultEls.resultZipBtn.addEventListener("click", exportResultZip);
  resultEls.resultSettingsBtn.addEventListener("click", openResultSettings);
  resultEls.resultPdfBtn.addEventListener("click", () => resultState.selected && downloadResultPdf(resultState.selected));
  resultEls.resultCloseModalBtn.addEventListener("click", closeResultPreview);
  resultEls.resultCloseSettingsBtn.addEventListener("click", closeResultSettings);
  resultEls.resultPreviewModal.querySelector("[data-close-result-modal]").addEventListener("click", closeResultPreview);
  resultEls.resultSettingsModal.querySelector("[data-close-result-settings]").addEventListener("click", closeResultSettings);
  configureResultPdfFonts();
  renderResultEmpty();
});

function handleResultFile(type, file) {
  resultState.files[type] = file || null;
  if (hasResultFiles()) loadResultApp();
  else renderResultEmpty();
}

function hasResultFiles() {
  return Boolean(resultState.files.students && resultState.files.results);
}

async function loadResultApp() {
  if (!hasResultFiles()) {
    renderResultEmpty("Upload lists.csv and MonthlyExamResults.csv to populate the table.");
    return;
  }
  setResultBusy(true, "Processing files...", resultEls.resultProcessBtn);
  try {
    const [studentsCsv, resultsCsv] = await Promise.all([
      readResultFile(resultState.files.students),
      readResultFile(resultState.files.results),
    ]);
    resultState.students = parseResultCsv(studentsCsv).map(normalizeResultStudent);
    resultState.results = parseResultCsv(resultsCsv).map(normalizeExamResult);
    resultState.reports = buildResultReports(resultState.students, resultState.results);
    resultState.selected = null;
    renderResultAll();
    resultEls.resultUploadGrid.hidden = true;
  } catch (error) {
    console.error(error);
    renderResultEmpty("Could not process result files. Check that lists.csv and MonthlyExamResults.csv are valid.");
  }
  setResultBusy(false);
}

function readResultFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function parseResultCsv(text) {
  return Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  }).data;
}

function normalizeResultStudent(row, index) {
  const mobile = cleanResult(row.Mobile || row.Number || row.Phone || row.mobile);
  return {
    id: `r-${index}`,
    name: cleanResult(row.Name || row.name),
    mobile,
    phoneTail: phoneTail(mobile),
    roll: formatResultRoll(row.Roll || row.roll),
    rollKey: normalizeResultRoll(row.Roll || row.roll),
    country: cleanResult(row.Country),
    email: cleanResult(row.Email || row.email),
    moderator: cleanResult(row.Moderator || row.moderator) || "Unassigned",
    remarks: cleanResult(row.Remarks || row[" Remarks"]),
  };
}

function normalizeExamResult(row) {
  return {
    serial: cleanResult(row.Sl || row.SL || row.Serial),
    name: cleanResult(row.Name || row.name),
    roll: formatResultRoll(row.Roll || row.roll),
    rollKey: normalizeResultRoll(row.Roll || row.roll),
    phoneTail: phoneTail(row.Phone || row.Mobile),
    marks: normalizeNumber(row.Marks, 0),
    rank: cleanResult(row.Rank),
  };
}

function buildResultReports(students, results) {
  const byRoll = new Map();
  const byPhoneTail = new Map();
  const byName = new Map();
  results.forEach((result) => {
    if (result.rollKey) byRoll.set(result.rollKey, result);
    if (result.phoneTail) byPhoneTail.set(result.phoneTail, result);
    if (result.name) byName.set(result.name.toLowerCase(), result);
  });

  return students.map((student) => {
    const result =
      byRoll.get(student.rollKey) ||
      byPhoneTail.get(student.phoneTail) ||
      byName.get(student.name.toLowerCase()) ||
      null;
    const marks = result ? result.marks : 0;
    const totalMarks = resultState.settings.totalMarks || 100;
    const percent = totalMarks ? Math.round((marks / totalMarks) * 10000) / 100 : 0;
    return {
      student,
      result,
      marks,
      totalMarks,
      percent,
      rank: result ? result.rank : "",
      matched: Boolean(result),
    };
  }).sort((a, b) => b.marks - a.marks || Number(a.rank || 99999) - Number(b.rank || 99999) || a.student.name.localeCompare(b.student.name));
}

function renderResultAll() {
  resultEls.resultRange.textContent = `${resultState.reports.length} student result reports ready`;
  resultEls.resultStatsGrid.innerHTML = [
    ["Students", resultState.students.length],
    ["Result rows", resultState.results.length],
    ["Matched", resultState.reports.filter((report) => report.matched).length],
    ["Moderators", new Set(resultState.students.map((student) => student.moderator)).size],
  ].map(([label, value]) => `<div class="stat"><strong>${escapeResult(value)}</strong><span>${escapeResult(label)}</span></div>`).join("");
  renderResultRows();
  closeResultPreview();
}

function renderResultEmpty(message = "Upload lists.csv and MonthlyExamResults.csv to begin.") {
  resultEls.resultRange.textContent = message;
  resultEls.resultStatsGrid.innerHTML = "";
  resultEls.resultRows.innerHTML = `<tr><td colspan="7" class="empty-cell">${escapeResult(message)}</td></tr>`;
  resultEls.resultUploadGrid.hidden = false;
  setResultBusy(false);
}

function renderResultRows() {
  const query = resultEls.resultSearchInput.value.trim().toLowerCase();
  const reports = resultState.reports.filter(({ student }) =>
    `${student.name} ${student.roll} ${student.mobile} ${student.moderator}`.toLowerCase().includes(query),
  );
  resultEls.resultRows.innerHTML = reports.map((report) => `<tr>
    <td>${escapeResult(report.student.name)}</td>
    <td>${escapeResult(report.student.roll || "-")}</td>
    <td>${escapeResult(report.student.moderator)}</td>
    <td>${report.marks}/${report.totalMarks}</td>
    <td>${escapeResult(report.rank || "-")}</td>
    <td>${report.percent.toFixed(2)}%</td>
    <td><div class="row-actions"><button class="btn btn-compact result-preview-row" data-id="${report.student.id}" type="button">Preview</button><button class="btn btn-compact btn-primary result-download-row" data-id="${report.student.id}" type="button">PDF</button></div></td>
  </tr>`).join("");
  resultEls.resultRows.querySelectorAll(".result-preview-row").forEach((button) => {
    button.addEventListener("click", () => {
      resultState.selected = resultState.reports.find((report) => report.student.id === button.dataset.id);
      renderResultPreview();
      openResultPreview();
    });
  });
  resultEls.resultRows.querySelectorAll(".result-download-row").forEach((button) => {
    button.addEventListener("click", () => {
      const report = resultState.reports.find((item) => item.student.id === button.dataset.id);
      if (report) downloadResultPdf(report);
    });
  });
}

function renderResultPreview() {
  const report = resultState.selected;
  if (!report) return;
  resultEls.resultPdfBtn.disabled = false;
  resultEls.resultSelectedName.textContent = report.student.name;
  resultEls.resultSelectedMeta.textContent = `${report.student.roll || "No roll"} | Moderator ${report.student.moderator}`;
  resultEls.resultPreview.className = "";
  resultEls.resultPreview.innerHTML = `<article class="report-page">
    <header class="report-header">
      <div class="logo-mark"><img src="./assets/img/QLLC.png" alt="QLLC"></div>
      <div><h2>${escapeResult(resultState.settings.headerTitle)}</h2><p>Result summary for ${escapeResult(report.student.name)}</p></div>
    </header>
    <div class="report-body">
      <div class="summary-grid summary-grid-two">
        <div class="summary-cell"><strong>Student information</strong><br>${escapeResult(report.student.name)}<br>Roll: ${escapeResult(report.student.roll || "-")}<br>Phone: ${escapeResult(report.student.mobile || "-")}<br>Email: ${escapeResult(report.student.email || "-")}</div>
        <div class="summary-cell"><strong>Result stats</strong><br>Marks: ${report.marks}/${report.totalMarks}<br>Percentage: ${report.percent.toFixed(2)}%<br>Rank: ${escapeResult(report.rank || "-")}<br>Moderator: ${escapeResult(report.student.moderator)}</div>
      </div>
      <table class="report-table"><thead><tr><th>Exam</th><th>Marks</th><th>Total Marks</th><th>Percentage</th><th>Rank</th><th>Status</th></tr></thead><tbody>
        <tr><td>Monthly Exam</td><td>${report.marks}</td><td>${report.totalMarks}</td><td>${report.percent.toFixed(2)}%</td><td>${escapeResult(report.rank || "-")}</td><td>${report.matched ? "Published" : "No result found"}</td></tr>
      </tbody></table>
      ${importantLinksHtml()}
    </div>
    <footer class="report-footer"><span>${escapeResult(resultState.settings.footerText)}</span></footer>
  </article>`;
}

async function exportResultZip() {
  if (!resultState.reports.length) return;
  setResultBusy(true, "Creating PDF ZIP...", resultEls.resultZipBtn);
  const zip = new JSZip();
  for (const report of resultState.reports) {
    const folder = zip.folder(fileResultName(report.student.moderator || "Unassigned"));
    const blob = await resultPdfBlob(buildResultPdfDefinition(report));
    folder.file(fileResultName(`${report.student.roll || report.student.name}-${report.student.name}-result.pdf`), blob);
  }
  saveAs(await zip.generateAsync({ type: "blob" }), "result-reports-by-moderator.zip");
  setResultBusy(false);
}

function downloadResultPdf(report) {
  pdfMake.createPdf(buildResultPdfDefinition(report)).download(fileResultName(`${report.student.roll || report.student.name}-result.pdf`));
}

const resultLogo = `data:image/png;base64,${QLLCLogo}`;

function buildResultPdfDefinition(report) {
  const p = report.student;
  return {
    pageSize: "A4",
    pageMargins: [0, 76, 0, 42],
    defaultStyle: { font: getResultPdfFont(), fontSize: 9, color: "#17212b" },
    header: () => ({
      margin: [0, 0, 0, 0],
      table: {
        widths: [92, "*"],
        body: [[
          { image: "logo", alignment: "center", width: 60, margin: [0, 2, 0, 0] },
          {
            stack: [
              { text: resultState.settings.headerTitle, bold: true, fontSize: 17, color: "#ffffff" },
              { text: `Result summary for ${p.name}`, color: "#dbe7f3", margin: [0, 4, 0, 0] },
            ],
            fillColor: "#18395a",
            margin: [14, 14, 14, 12],
          },
        ]],
      },
      layout: "noBorders",
    }),
    footer: (currentPage, pageCount) => ({
      margin: [0, 0, 0, 0],
      table: {
        widths: ["*", 80],
        heights: [42],
        body: [[
          { text: resultState.settings.footerText, color: "#ffffff", fillColor: "#18395a", margin: [18, 13, 0, 0] },
          { text: `${currentPage}/${pageCount}`, color: "#ffffff", alignment: "right", fillColor: "#18395a", margin: [0, 13, 18, 0] },
        ]],
      },
      layout: "noBorders",
    }),
    content: [
      {
        columns: [
          summaryStackResult("Student Information", [
            p.name,
            `Roll: ${p.roll || "-"}`,
            `Phone: ${p.mobile || "-"}`,
            `Email: ${p.email || "-"}`,
          ]),
          summaryStackResult("Result Stats", [
            `Marks: ${report.marks}/${report.totalMarks}`,
            `Percentage: ${report.percent.toFixed(2)}%`,
            `Rank: ${report.rank || "-"}`,
            `Moderator: ${p.moderator || "-"}`,
          ]),
        ],
        columnGap: 8,
        margin: [22, 14, 22, 14],
      },
      {
        margin: [22, 0, 22, 0],
        table: {
          headerRows: 1,
          widths: ["*", 60, 70, 70, 50, 80],
          body: [
            ["Exam", "Marks", "Total Marks", "Percentage", "Rank", "Status"].map((text) => ({ text, style: "tableHeader", alignment: "center" })),
            [
              "Monthly Exam",
              { text: String(report.marks), alignment: "center" },
              { text: String(report.totalMarks), alignment: "center" },
              { text: `${report.percent.toFixed(2)}%`, alignment: "center" },
              { text: report.rank || "-", alignment: "center" },
              { text: report.matched ? "Published" : "No result found", alignment: "center" },
            ],
          ],
        },
        layout: {
          fillColor: (rowIndex) => rowIndex === 0 ? "#2e6f9f" : rowIndex % 2 === 0 ? "#f5f8fb" : null,
          hLineColor: () => "#d8e0e8",
          vLineColor: () => "#d8e0e8",
        },
      },
      ...importantLinksPdfContentResult(),
    ],
    styles: {
      tableHeader: { color: "#ffffff", bold: true, margin: [4, 5, 4, 5] },
      summaryLabel: { color: "#5c6d7e", fontSize: 8 },
      summaryValue: { bold: true, fontSize: 10 },
    },
    images: { logo: resultLogo },
  };
}

function summaryStackResult(label, value) {
  return {
    stack: [
      { text: label, style: "summaryLabel" },
      ...value.map((line, index) => ({
        text: String(line),
        style: "summaryValue",
        bold: index === 0,
        margin: [0, index === 0 ? 4 : 2, 0, 0],
      })),
    ],
    fillColor: "#f3f6f9",
    margin: [8, 8, 8, 8],
  };
}

function importantLinksHtml() {
  const links = resultImportantLinks();
  if (!links.length) return "";
  return `<div class="summary-cell important-links-preview"><strong>Important links</strong><br>${links.map((link) => escapeResult(link)).join("<br>")}</div>`;
}

function importantLinksPdfContentResult() {
  const links = resultImportantLinks();
  if (!links.length) return [];
  return [
    { text: "Important Links", bold: true, fontSize: 15, pageBreak: "before", margin: [22, 14, 22, 8] },
    {
      ul: links.map((item) => {
        const url = (item.match(/https?:\/\/\S+/) || [item])[0];
        return { text: item, link: url, color: "#18395a" };
      }),
      margin: [34, 0, 22, 0],
    },
  ];
}

function resultImportantLinks() {
  return [
    resultState.settings.adminWhatsapp && `Admin WhatsApp: ${resultState.settings.adminWhatsapp}`,
    resultState.settings.classLink && `Class link: ${resultState.settings.classLink}`,
    resultState.settings.youtubeLink && `YouTube link: ${resultState.settings.youtubeLink}`,
    ...resultState.settings.importantLinks.split(/\r?\n/),
  ].map(cleanResult).filter(Boolean);
}

function resultPdfBlob(definition) {
  return new Promise((resolve) => pdfMake.createPdf(definition).getBlob(resolve));
}

function openResultPreview() {
  resultEls.resultPreviewModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeResultPreview() {
  resultEls.resultPreviewModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function openResultSettings() {
  resultEls.resultSettingsModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeResultSettings() {
  resultEls.resultSettingsModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function loadResultSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("qllcResultSettings") || "{}");
    resultState.settings = {
      ...resultState.settings,
      ...saved,
      totalMarks: normalizeNumber(saved.totalMarks, 100) || 100,
    };
  } catch (error) {
    console.warn("Could not load result settings.", error);
  }
  renderResultSettings();
}

function bindResultSettings() {
  [
    "resultTotalMarksInput",
    "resultHeaderInput",
    "resultFooterInput",
    "resultAdminWhatsappInput",
    "resultClassLinkInput",
    "resultYoutubeLinkInput",
    "resultImportantLinksInput",
  ].forEach((key) => {
    resultEls[key].addEventListener("input", updateResultSettingsFromForm);
    resultEls[key].addEventListener("change", updateResultSettingsFromForm);
  });
}

function renderResultSettings() {
  resultEls.resultTotalMarksInput.value = resultState.settings.totalMarks;
  resultEls.resultHeaderInput.value = resultState.settings.headerTitle;
  resultEls.resultFooterInput.value = resultState.settings.footerText;
  resultEls.resultAdminWhatsappInput.value = resultState.settings.adminWhatsapp || "";
  resultEls.resultClassLinkInput.value = resultState.settings.classLink || "";
  resultEls.resultYoutubeLinkInput.value = resultState.settings.youtubeLink || "";
  resultEls.resultImportantLinksInput.value = resultState.settings.importantLinks;
}

function updateResultSettingsFromForm() {
  resultState.settings = {
    totalMarks: normalizeNumber(resultEls.resultTotalMarksInput.value, 100) || 100,
    headerTitle: cleanResult(resultEls.resultHeaderInput.value) || "Monthly Result Report",
    footerText: cleanResult(resultEls.resultFooterInput.value) || "Quraner Alo Foundation - Student Report",
    adminWhatsapp: cleanResult(resultEls.resultAdminWhatsappInput.value),
    classLink: cleanResult(resultEls.resultClassLinkInput.value),
    youtubeLink: cleanResult(resultEls.resultYoutubeLinkInput.value),
    importantLinks: cleanResult(resultEls.resultImportantLinksInput.value),
  };
  localStorage.setItem("qllcResultSettings", JSON.stringify(resultState.settings));
  if (resultState.students.length && resultState.results.length) {
    resultState.reports = buildResultReports(resultState.students, resultState.results);
    if (resultState.selected) {
      resultState.selected = resultState.reports.find((report) => report.student.id === resultState.selected.student.id) || null;
    }
    renderResultAll();
    if (resultState.selected) {
      renderResultPreview();
      openResultPreview();
    }
  }
}

function setResultBusy(isBusy, message = "", activeButton = null) {
  [resultEls.resultProcessBtn, resultEls.resultZipBtn, resultEls.resultPdfBtn].filter(Boolean).forEach((button) => {
    if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent;
    const needsReports = button === resultEls.resultZipBtn;
    button.disabled = isBusy || (needsReports && !resultState.reports.length) || (button === resultEls.resultPdfBtn && !resultState.selected);
    button.textContent = isBusy && button === activeButton ? message : button.dataset.defaultText;
  });
  resultEls.resultProcessBtn.disabled = isBusy || !hasResultFiles();
}

function configureResultPdfFonts() {
  if (typeof pdfMake === "undefined" || typeof BENGALI_FONT_BASE64 !== "string") return;
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

function getResultPdfFont() {
  return typeof BENGALI_FONT_BASE64 === "string" ? "NotoSansBengali" : "Roboto";
}

function cleanResult(value) {
  return String(value || "").replace(/\u202f|\u200e|\u200f/g, " ").trim();
}

function normalizeNumber(value, fallback) {
  const number = Number(cleanResult(value));
  return Number.isFinite(number) ? number : fallback;
}

function phoneTail(value) {
  const digits = cleanResult(value).replace(/\D/g, "");
  return digits ? digits.slice(-4) : "";
}

function normalizeResultRoll(value) {
  return formatResultRoll(value).replace(/\s+/g, "").toUpperCase();
}

function formatResultRoll(value) {
  const text = cleanResult(value).toUpperCase();
  if (!text) return "";
  const match = text.match(/([A-Z]{1,3})\s*[-.]?\s*(\d+)(?:\s*[-.]?\s*(\d+))?/);
  if (!match) return text.replace(/\s+/g, "");
  return match[3] ? `${match[1]}${match[2]}-${match[3]}` : `${match[1]}-${match[2]}`;
}

function escapeResult(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function fileResultName(value) {
  return String(value || "report").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}
