// js/export.js

const ExportManager = (() => {
  // =====================================================
  // EXCEL EXPORT
  // =====================================================

  async function exportExcel() {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Homework Report Generator";

    // ==========================================
    // STUDENTS SHEET
    // ==========================================

    const studentSheet = workbook.addWorksheet("Students");

    studentSheet.columns = [
      {
        header: "Roll",
        key: "roll",
        width: 15,
      },

      {
        header: "Name",
        key: "name",
        width: 35,
      },

      {
        header: "Phone",
        key: "phone",
        width: 20,
      },

      {
        header: "Country",
        key: "country",
        width: 20,
      },

      {
        header: "Moderator",
        key: "moderator",
        width: 20,
      },

      {
        header: "Submitted",
        key: "submitted",
        width: 15,
      },

      {
        header: "Missing",
        key: "missing",
        width: 15,
      },

      {
        header: "Completion %",
        key: "completion",
        width: 15,
      },
    ];

    App.studentReports.forEach((student) => {
      studentSheet.addRow({
        roll: student.roll,

        name: student.name,

        phone: student.mobile,

        country: student.country,

        moderator: student.moderator,

        submitted: student.submittedCount,

        missing: student.missingCount,

        completion: student.completion,
      });
    });

    // ==========================================
    // HOMEWORK SHEET
    // ==========================================

    const homeworkSheet = workbook.addWorksheet("Homework Summary");

    homeworkSheet.columns = [
      {
        header: "Homework",
        key: "homework",
        width: 20,
      },

      {
        header: "Submitted",
        key: "submitted",
        width: 20,
      },

      {
        header: "Missing",
        key: "missing",
        width: 20,
      },
    ];

    App.homeworkReports.forEach((hw) => {
      homeworkSheet.addRow(hw);
    });

    // ==========================================
    // UNMATCHED SHEET
    // ==========================================

    const unmatchedSheet = workbook.addWorksheet("Unmatched");

    unmatchedSheet.columns = [
      {
        header: "Phone",
        key: "phone",
        width: 20,
      },

      {
        header: "Roll",
        key: "roll",
        width: 20,
      },

      {
        header: "Homework",
        key: "homework",
        width: 20,
      },

      {
        header: "Files",
        key: "files",
        width: 15,
      },
    ];

    App.unmatchedReports.forEach((item) => {
      unmatchedSheet.addRow(item);
    });

    // ==========================================
    // DETAILS SHEET
    // ==========================================

    const detailSheet = workbook.addWorksheet("Submission Details");

    detailSheet.columns = [
      {
        header: "Roll",
        key: "roll",
        width: 20,
      },

      {
        header: "Homework",
        key: "homework",
        width: 20,
      },

      {
        header: "Files",
        key: "files",
        width: 15,
      },

      {
        header: "Date",
        key: "date",
        width: 25,
      },

      {
        header: "Inferred",
        key: "inferred",
        width: 15,
      },
    ];

    App.studentReports.forEach((student) => {
      student.submissions.forEach((sub) => {
        detailSheet.addRow({
          roll: student.roll,

          homework: sub.homeworks.join(","),

          files: sub.fileCount,

          date: sub.submittedAt,

          inferred: sub.inferredHomework ? "Yes" : "No",
        });
      });
    });

    // ==========================================
    // STYLE HEADERS
    // ==========================================

    workbook.eachSheet((sheet) => {
      sheet.getRow(1).font = {
        bold: true,
      };
    });

    // ==========================================
    // SAVE
    // ==========================================

    const buffer = await workbook.xlsx.writeBuffer();

    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),

      `Homework_Report_${timestamp()}.xlsx`,
    );
  }

  // =====================================================
  // DOWNLOAD ALL PDFS
  // =====================================================

  async function downloadAllPDFs() {
    const zip = new JSZip();

    const reportsFolder = zip.folder("Reports");

    const total = App.studentReports.length;

    let count = 0;

    for (const student of App.studentReports) {
      count++;

      console.log(`Generating PDF ${count}/${total}`);

      const blob = await PDFManager.getPdfBlob(student);

      reportsFolder.file(
        sanitize(student.roll) + ".pdf",

        blob,
      );
    }

    const content = await zip.generateAsync({
      type: "blob",
    });

    saveAs(
      content,

      `Homework_Reports_${timestamp()}.zip`,
    );
  }

  // =====================================================
  // HELPERS
  // =====================================================

  function sanitize(text) {
    return String(text || "Unknown").replace(/[\\/:*?"<>|]/g, "_");
  }

  function timestamp() {
    const now = new Date();

    const yyyy = now.getFullYear();

    const mm = String(now.getMonth() + 1).padStart(2, "0");

    const dd = String(now.getDate()).padStart(2, "0");

    const hh = String(now.getHours()).padStart(2, "0");

    const mi = String(now.getMinutes()).padStart(2, "0");

    return `${yyyy}${mm}${dd}_${hh}${mi}`;
  }

  return {
    exportExcel,

    downloadAllPDFs,
  };
})();
