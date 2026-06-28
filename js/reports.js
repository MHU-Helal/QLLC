// js/reports.js

const Reports = (() => {
  // ---------------------------------------------------
  // STUDENT REPORTS
  // ---------------------------------------------------

  function buildStudentReports(students, submissions, schedule) {
    const reports = [];

    const totalHomeworkDays = Object.keys(schedule).length;

    const expectedHomework = getExpectedHomework(schedule);

    students.forEach((student) => {
      const studentSubs = findStudentSubmissions(student, submissions);
      
      const homeworkStatus = buildHomeworkMatrix(
        student,
        studentSubs,
        schedule,
      );

      const submittedHomework = collectSubmittedHomework(homeworkStatus);

      const missingHomework = calculateMissingHomework(
        submittedHomework,
        schedule,
      );

      const submittedExpectedCount = submittedHomework.filter((hw) =>
        expectedHomework.includes(hw),
      ).length;

      const percentage =
        expectedHomework.length === 0
          ? 0
          : (submittedExpectedCount / expectedHomework.length) * 100;

      const onTime = homeworkStatus.filter((row) => row.status === "ontime").length;

      const late = homeworkStatus.filter((row) => row.status === "late").length;

      const marks = homeworkStatus.reduce((sum, row) => sum + row.marks, 0);

      reports.push({
        ...student,

        totalHomeworkDays,

        submittedCount: submittedHomework.length,

        missingCount: missingHomework.length,

        completion: percentage.toFixed(2),

        submittedHomework,

        missingHomework,

        homeworkStatus,

        submitted: onTime + late,

        onTime,

        late,

        marks,

        maxMarks: homeworkStatus.length * 2,

        submissions: studentSubs,
      });
    });

    return reports;
  }

  // ---------------------------------------------------
  // HOMEWORK REPORT
  // ---------------------------------------------------

  function buildHomeworkReport(studentReports, schedule) {
    const report = [];

    const homeworkList = getExpectedHomework(schedule);

    homeworkList.forEach((hw) => {
      let submitted = 0;

      studentReports.forEach((student) => {
        if (student.submittedHomework.includes(hw)) {
          submitted++;
        }
      });

      report.push({
        homework: hw,

        submitted,

        missing: studentReports.length - submitted,
      });
    });

    return report;
  }

  // ---------------------------------------------------
  // UNMATCHED REPORT
  // ---------------------------------------------------

  function buildUnmatchedReport(submissions, students) {
    const unmatched = [];

    submissions.forEach((sub) => {
      const found = students.find((student) => {
        return student.roll === sub.roll || student.mobile === sub.phone;
      });

      if (!found) {
        unmatched.push({
          phone: sub.phone,

          roll: sub.roll,

          homework: sub.homeworks.join(","),

          files: sub.fileCount,

          submittedAt: sub.submittedAt,
        });
      }
    });

    return unmatched;
  }

  // ---------------------------------------------------
  // MATCH SUBMISSIONS
  // ---------------------------------------------------

  function findStudentSubmissions(student, submissions) {
    return submissions.filter((sub) => {
      if (student.roll && sub.roll && student.roll === sub.roll) {
        return true;
      }

      if (student.mobile && sub.phone && student.mobile === sub.phone) {
        return true;
      }

      return false;
    });
  }

  // ---------------------------------------------------
  // HOMEWORK LIST
  // ---------------------------------------------------

  function collectHomeworkNumbers(submissions) {
    const homeworkSet = new Set();

    submissions.forEach((sub) => {
      sub.homeworks.forEach((hw) => {
        homeworkSet.add(hw);
      });
    });

    return [...homeworkSet].sort((a, b) => a - b);
  }

  function collectSubmittedHomework(homeworkStatus) {
    return homeworkStatus
      .filter((row) => row.status !== "missing")
      .map((row) => row.homework)
      .sort((a, b) => a - b);
  }

  // ---------------------------------------------------
  // MISSING HOMEWORK
  // ---------------------------------------------------

  function calculateMissingHomework(submittedHomework, schedule) {
    const expected = getExpectedHomework(schedule);

    return expected.filter((hw) => {
      return !submittedHomework.includes(hw);
    });
  }

  function buildHomeworkMatrix(student, submissions, schedule) {
    const rows = [];

    Object.entries(schedule).forEach(([date, hwList]) => {
      hwList.forEach((hw) => {
        const match = submissions.find((sub) => {
          return (
            sub.homeworks.includes(hw) &&
            isWithinSubmissionWindow(sub.submittedAt, date)
          );
        });

        let status = "missing";
        let marks = 0;

        if (match) {
          status = "ontime";
          marks = 2;
        }

        rows.push({
          homework: hw,

          assignedDate: date,

          status,

          marks,

          files: match?.fileCount || 0,

          submittedAt: match?.submittedAt || null,
        });
      });
    });

    return rows;
  }

  function isWithinSubmissionWindow(submittedAt, assignedDate) {
    const submittedDate = new Date(submittedAt);
    const windowStart = parseScheduleDate(assignedDate);
    const windowEnd = new Date(windowStart);

    windowEnd.setHours(windowEnd.getHours() + 24);

    return submittedDate >= windowStart && submittedDate <= windowEnd;
  }

  function parseScheduleDate(date) {
    const [year, month, day] = String(date).split("-").map(Number);

    return new Date(year, month - 1, day);
  }

  function getExpectedHomework(schedule) {
    return [
      ...new Set(
        Object.values(schedule)
          .flat()
          .map(Number)
          .filter(Boolean),
      ),
    ].sort((a, b) => a - b);
  }

  return {
    buildStudentReports,

    buildHomeworkReport,

    buildUnmatchedReport,

    buildHomeworkMatrix,
  };
})();
