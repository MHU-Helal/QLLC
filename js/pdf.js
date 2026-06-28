// js/pdf.js

const PDFManager = (() => {
  const PAGE_PADDING = 28;
  const HEADER_HEIGHT = 74;
  const FOOTER_HEIGHT = 34;
  const FOOTER_AREA_HEIGHT = FOOTER_HEIGHT + 18;
  const BLUE = "#1D4ED8";
  const DARK_BLUE = "#0F172A";
  const LIGHT_BLUE = "#EFF6FF";
  function buildStudentDoc(student) {
    return {
      pageSize: "A4",
      pageMargins: [0, HEADER_HEIGHT + 18, 0, FOOTER_AREA_HEIGHT],
      header: (currentPage, pageCount, pageSize) =>
        reportHeader(student, pageSize),
      footer: (currentPage, pageCount, pageSize),
      contents: {
        table: {
          widths: [pageSize.width],
          heights: [FOOTER_AREA_HEIGHT],
          body: [
            [
              {
                fillColor: BLUE,
                // margin: [PAGE_PADDING, 8, PAGE_PADDING, 8],
                margin: [PAGE_PADDING, 18, PAGE_PADDING, 0],
                columns: [
                  {
                    text: "Homework Report Generator",
                    color: "#FFFFFF",
                    fontSize: 8,
                    bold: true,
                  },
                  {
                    text: `Page ${currentPage} of ${pageCount}`,
                    alignment: "right",
                    color: "#FFFFFF",
                    fontSize: 8,
                  },
                ],
              },
            ],
          ],
        },
        layout: edgeToEdgeLayout(),
      },
    };

    function paddedBlock(stack) {
      return {
        table: {
          widths: ["*"],
          body: [
            [
              {
                stack,
                margin: [PAGE_PADDING, 0, PAGE_PADDING, 0],
                border: [false, false, false, false],
              },
            ],
          ],
        },
        layout: "noBorders",
      };
    }

    function buildHomeworkTable(student) {
      const homeworkStatus = student.homeworkStatus || [];
      const body = [
        [
          tableHeader("HW"),
          tableHeader("Assigned"),
          tableHeader("Files"),
          tableHeader("Submitted"),
          tableHeader("Time"),
          tableHeader("Status"),
          tableHeader("Marks"),
        ],
      ];

      homeworkStatus.forEach((row) => {
        body.push([
          cell(String(row.homework)),
          cell(formatDate(row.assignedDate)),
          cell(String(row.files), "center"),
          cell(row.submittedAt ? formatDate(row.submittedAt) : "-", "center"),
          cell(row.submittedAt ? formatTime(row.submittedAt) : "-", "center"),
          statusCell(row.status),
          cell(String(row.marks), "center"),
        ]);
      });

      if (body.length === 1) {
        body.push([
          {
            text: "No scheduled homework found.",
            colSpan: 7,
            alignment: "center",
            margin: [0, 10, 0, 10],
            color: "#64748B",
          },
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
      }

      return {
        table: {
          headerRows: 1,
          widths: [36, 70, 42, 72, 52, "*", 42],
          body,
        },

        layout: {
          hLineColor: () => BORDER,
          vLineColor: () => BORDER,
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 6,
          paddingBottom: () => 6,
          fillColor(rowIndex) {
            if (rowIndex === 0) return BLUE;

            const row = homeworkStatus[rowIndex - 1];

            if (!row) return null;

            if (row.status === "ontime") {
              return "#ECFDF5";
            }

            if (row.status === "late") {
              return "#FFFBEB";
            }

            return "#FEF2F2";
          },
        },
      };
    }

    function statusCell(status) {
      const colors = {
        ontime: "#047857",
        late: "#B45309",
        missing: "#B91C1C",
      };

      return {
        text: statusText(status),
        color: colors[status] || colors.missing,
        bold: true,
        alignment: "center",
      };
    }

    function statusText(status) {
      switch (status) {
        case "ontime":
          return "On Time";

        case "late":
          return "Late";

        default:
          return "Missing";
      }
    }

    function infoTable(student) {
      return {
        table: {
          widths: [95, "*", 90, "*"],

          body: [
            [
              labelCell("Name"),
              valueCell(student.name),
              labelCell("Roll"),
              valueCell(student.roll),
            ],
            [
              labelCell("Phone"),
              valueCell(student.mobile),
              labelCell("Country"),
              valueCell(student.country),
            ],
            [
              labelCell("Moderator"),
              valueCell(student.moderator),
              labelCell("Email"),
              valueCell(student.email),
            ],
          ],
        },
        layout: lightTableLayout(),
      };
    }

    function summaryTable(student) {
      const submitted = student.submitted || 0;
      const homeworkStatus = student.homeworkStatus || [];

      return {
        table: {
          widths: ["*", "*", "*", "*", "*"],

          body: [
            [
              summaryCell("Submitted", `${submitted}/${homeworkStatus.length}`),
              summaryCell("On Time", `${student.onTime || 0}`),
              summaryCell("Late", `${student.late || 0}`),
              summaryCell("Completion", `${student.completion}%`),
              summaryCell(
                "Marks",
                `${student.marks || 0}/${student.maxMarks || 0}`,
              ),
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
      };
    }

    function notesSection(student) {
      return {
        table: {
          widths: ["*"],
          body: [
            [
              {
                fillColor: LIGHT_BLUE,
                margin: [12, 10, 12, 10],
                ul: buildNotes(student),
              },
            ],
          ],
        },
        layout: {
          hLineColor: () => "#BFDBFE",
          vLineColor: () => "#BFDBFE",
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
        },
      };
    }

    function buildNotes(student) {
      return [
        "A homework is counted only when the submission matches this student by roll or phone number.",
        "On-time work is submitted on or before the assigned date and receives 2 marks.",
        "Late work is shown as submitted, but receives 0 marks in this report.",
        "Missing rows mean no matching submission was found for that scheduled homework.",
        "Homework outside the uploaded schedule is not included in completion rate or marks.",
        `${student.missingCount || 0} scheduled homework item(s) are currently marked missing.`,
      ];
    }

    function sectionHeader(text) {
      return {
        table: {
          widths: ["*"],
          body: [
            [
              {
                text,
                style: "sectionHeaderText",
                fillColor: BLUE,
                margin: [10, 6, 10, 6],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 8],
      };
    }

    function tableHeader(text) {
      return {
        text,
        style: "tableHeader",
        alignment: "center",
      };
    }

    function summaryCell(title, value) {
      return {
        fillColor: "#F8FAFC",
        margin: [8, 9, 8, 9],
        stack: [
          {
            text: title,
            color: "#64748B",
            fontSize: 7,
            bold: true,
            alignment: "center",
          },
          {
            text: value,
            color: DARK_BLUE,
            fontSize: 13,
            bold: true,
            alignment: "center",
            margin: [0, 3, 0, 0],
          },
        ],
      };
    }

    function labelCell(text) {
      return {
        text,
        bold: true,
        fillColor: "#F1F5F9",
        color: "#334155",
      };
    }

    function valueCell(text) {
      return {
        text: text || "",
        color: "#111827",
      };
    }

    function cell(text, alignment = "left") {
      return {
        text,
        alignment,
      };
    }

    function lightTableLayout() {
      return {
        hLineColor: () => BORDER,
        vLineColor: () => BORDER,
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        paddingLeft: () => 7,
        paddingRight: () => 7,
        paddingTop: () => 6,
        paddingBottom: () => 6,
      };
    }

    function edgeToEdgeLayout() {
      return {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      };
    }

    function previewStudent(student) {
      const doc = buildStudentDoc(student);

      pdfMake.createPdf(doc).getDataUrl((url) => {
        $("#pdfFrame").attr("src", url);
        $("#pdfModal").removeClass("hidden");
      });
    }

    function downloadStudent(student) {
      const doc = buildStudentDoc(student);

      pdfMake.createPdf(doc).download(sanitizeFileName(student.roll) + ".pdf");
    }

    function getPdfBlob(student) {
      return new Promise((resolve) => {
        const doc = buildStudentDoc(student);

        pdfMake.createPdf(doc).getBlob((blob) => {
          resolve(blob);
        });
      });
    }

    function spacer(height = 8) {
      return {
        text: "",
        margin: [0, height / 2, 0, height / 2],
      };
    }

    function formatDateTime(date) {
      return `${formatDate(date)}, ${formatTime(date)}`;
    }

    function formatDate(date) {
      if (!date) return "";

      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(date));
    }

    function formatTime(date) {
      if (!date) return "";

      return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(date));
    }

    function sanitizeFileName(name) {
      return String(name || "Unknown").replace(/[\\/:*?"<>|]/g, "_");
    }

    return {
      buildStudentDoc,
      buildHomeworkTable,
      previewStudent,
      downloadStudent,
      getPdfBlob,
    };
  }
})();
