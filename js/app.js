// js/app.js

const App = {
  students: [],
  schedule: {},

  messages: [],
  submissions: [],

  studentReports: [],
  homeworkReports: [],
  unmatchedReports: [],

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Tabs

    $(".tab-btn").on("click", function () {
      $(".tab-btn").removeClass("active");
      $(this).addClass("active");

      $(".tab-content").addClass("hidden");

      const tab = $(this).data("tab");

      $("#" + tab + "Tab").removeClass("hidden");
    });

    // Generate

    $("#btnGenerate").on("click", () => {
      this.generate();
    });

    // Search

    $("#globalSearch").on("keyup", (e) => {
      this.filterStudents(e.target.value);
    });

    // PDF Modal

    $("#closePdfModal").on("click", () => {
      $("#pdfModal").addClass("hidden");
    });
    
    $('#btnExportExcel').on(
    'click',
    async () => {

        await ExportManager
            .exportExcel();

    }
    );

    $('#btnDownloadAllPdf').on(
        'click',
        async () => {

            await ExportManager
                .downloadAllPDFs();

        }
    );
  },

  // =====================================================
  // MAIN
  // =====================================================

  async generate() {
    try {
      this.students = await this.loadMasterCSV();

      this.schedule = await this.loadScheduleCSV();

      const chatText = await this.loadChatTXT();

      this.messages = Parser.parseChat(chatText);

      this.submissions = Matcher.buildSubmissions(this.messages, this.schedule);

      this.studentReports = Reports.buildStudentReports(
        this.students,
        this.submissions,
        this.schedule,
      );

      this.homeworkReports = Reports.buildHomeworkReport(
        this.studentReports,
        this.schedule,
      );

      this.unmatchedReports = Reports.buildUnmatchedReport(
        this.submissions,
        this.students,
      );

      this.render();

      $("#btnExportExcel").prop("disabled", false);

      $("#btnDownloadAllPdf").prop("disabled", false);

      alert("Report Generated Successfully");
    } catch (err) {
      console.error(err);

      alert("Error:\n\n" + err.message);
    }
  },

  // =====================================================
  // LOADERS
  // =====================================================

  loadMasterCSV() {
    return new Promise((resolve, reject) => {
      const file = $("#masterCsv")[0].files[0];

      if (!file) {
        reject(new Error("Select Master CSV"));

        return;
      }

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,

        complete: (result) => {
          const students = result.data.map((row) => {
            return {
              name: row.Name?.trim() || "",

              mobile: Normalizer.normalizePhone(row.Mobile || ""),

              roll: Normalizer.normalizeRoll(row.Roll || ""),

              country: row.Country || "",

              email: row.Email || "",

              moderator: row.Moderator || "",

              remarks: row.Remarks || "",
            };
          });

          resolve(students);
        },
      });
    });
  },

  loadScheduleCSV() {
    return new Promise((resolve, reject) => {
      const file = $("#scheduleCsv")[0].files[0];

      if (!file) {
        reject(new Error("Select Schedule CSV"));

        return;
      }

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,

        complete: (result) => {
          const schedule = {};

          result.data.forEach((row) => {
            const date = row.Date?.trim();

            if (!date) return;

            const hwList = String(row.Homework || "")
              .split(/[,\s;]+/)
              .map(Number)
              .filter(Boolean);

            schedule[date] = hwList;
          });

          resolve(schedule);
        },
      });
    });
  },

  loadChatTXT() {
    return new Promise((resolve, reject) => {
      const file = $("#chatTxt")[0].files[0];

      if (!file) {
        reject(new Error("Select WhatsApp TXT"));

        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        resolve(e.target.result);
      };

      reader.onerror = reject;

      reader.readAsText(file);
    });
  },

  // =====================================================
  // RENDER
  // =====================================================

  render() {
    this.renderStats();

    this.renderStudents();

    this.renderHomework();

    this.renderModerators();

    this.renderUnmatched();
  },

  renderStats() {
    $("#statStudents").text(this.students.length);

    $("#statMatched").text(
      this.studentReports.filter((x) => x.submittedCount > 0).length,
    );

    $("#statUnmatched").text(this.unmatchedReports.length);

    $("#statSubmissions").text(this.submissions.length);

    $("#statHomeworkDays").text(Object.keys(this.schedule).length);
  },

  renderStudents() {
    const tbody = $("#studentsBody");

    tbody.empty();

    this.studentReports.forEach((student) => {
      tbody.append(`
                <tr>

                    <td>${student.roll}</td>

                    <td>${student.name}</td>

                    <td>${student.mobile}</td>

                    <td>${student.moderator}</td>

                    <td>
                        ${student.submittedCount}
                    </td>

                    <td>
                        ${student.missingCount}
                    </td>

                    <td>
                        ${student.completion}%
                    </td>

                    <td>

                        <button
                            class="viewStudent btn-primary"
                            data-roll="${student.roll}">
                            View
                        </button>
                        
                        <button
                            class="downloadStudent btn-success"
                            data-roll="${student.roll}">
                            PDF
                        </button>

                    </td>

                </tr>
            `);
    });
  },

  renderHomework() {
    const tbody = $("#homeworkBody");

    tbody.empty();

    this.homeworkReports.forEach((hw) => {
      tbody.append(`
                <tr>

                    <td>${hw.homework}</td>

                    <td>${hw.submitted}</td>

                    <td>${hw.missing}</td>

                </tr>
            `);
    });
  },

  renderModerators() {
    const tbody = $("#moderatorBody");

    tbody.empty();

    const moderators = {};

    this.studentReports.forEach((student) => {
      const name = student.moderator || "Unassigned";

      if (!moderators[name]) {
        moderators[name] = {
          moderator: name,
          students: 0,
          submitted: 0,
          missing: 0,
        };
      }

      moderators[name].students++;
      moderators[name].submitted += student.submittedCount;
      moderators[name].missing += student.missingCount;
    });

    Object.values(moderators).forEach((row) => {
      tbody.append(`
                <tr>

                    <td>${row.moderator}</td>

                    <td>${row.students}</td>

                    <td>${row.submitted}</td>

                    <td>${row.missing}</td>

                </tr>
            `);
    });
  },

  renderUnmatched() {
    const tbody = $("#unmatchedBody");

    tbody.empty();

    this.unmatchedReports.forEach((row) => {
      tbody.append(`
                <tr>

                    <td>${row.phone}</td>

                    <td>${row.roll || ""}</td>

                    <td>${row.homework || ""}</td>

                    <td>Not Found</td>

                </tr>
            `);
    });
  },

  // =====================================================
  // SEARCH
  // =====================================================

  filterStudents(keyword) {
    keyword = keyword.toLowerCase();

    $("#studentsBody tr").each(function () {
      const row = $(this).text().toLowerCase();

      $(this).toggle(row.includes(keyword));
    });
  },
};

$(document).ready(() => {
  App.init();
});

$(document).on("click", ".viewStudent", function () {

    const roll =
        $(this).data('roll');

    const student =
        App.studentReports.find(
            x => x.roll === roll
        );

    if (!student)
        return;

    PDFManager.previewStudent(student);

});

$(document).on("click", ".downloadStudent", function () {
  const roll = $(this).data("roll");

  const student = App.studentReports.find((x) => x.roll === roll);

  if (!student) return;

  PDFManager.downloadStudent(student);
});
