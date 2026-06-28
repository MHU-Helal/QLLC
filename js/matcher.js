// js/matcher.js

const Matcher = (() => {
  const SUBMISSION_WINDOW_MINUTES = 15;

  function buildSubmissions(messages, homeworkSchedule = {}) {
    const groupedByPhone = groupMessagesByPhone(messages);

    const submissions = [];

    Object.keys(groupedByPhone).forEach((phone) => {
      const phoneMessages = groupedByPhone[phone];

      const buckets = buildTimeBuckets(phoneMessages);

      buckets.forEach((bucket) => {
        const submission = extractSubmission(phone, bucket, homeworkSchedule);

        if (submission) {
          submissions.push(submission);
        }
      });
    });

    return mergeDuplicateSubmissions(submissions);
  }

  // -------------------------------------------------

  function groupMessagesByPhone(messages) {
    const grouped = {};

    messages.forEach((msg) => {
      if (!msg.phone) return;

      if (!grouped[msg.phone]) {
        grouped[msg.phone] = [];
      }

      grouped[msg.phone].push(msg);
    });

    Object.values(grouped).forEach((arr) => {
      arr.sort((a, b) => parseDate(a) - parseDate(b));
    });

    return grouped;
  }

  // -------------------------------------------------

  function buildTimeBuckets(messages) {
    const buckets = [];

    let currentBucket = [];

    messages.forEach((msg, index) => {
      if (currentBucket.length === 0) {
        currentBucket.push(msg);
        return;
      }

      const prev = currentBucket[currentBucket.length - 1];

      const diff = (parseDate(msg) - parseDate(prev)) / 1000 / 60;

      if (diff <= SUBMISSION_WINDOW_MINUTES) {
        currentBucket.push(msg);
      } else {
        buckets.push(currentBucket);

        currentBucket = [msg];
      }
    });

    if (currentBucket.length) {
      buckets.push(currentBucket);
    }

    return buckets;
  }

  // -------------------------------------------------

  function extractSubmission(phone, bucket, schedule) {
    const fullText = bucket.map((x) => x.body).join("\n");

    const roll = extractRoll(fullText);

    const homeworks = extractHomeworkNumbers(fullText);

    const mediaCount = bucket.filter((x) => x.isMedia).length;

    const latestMsg = bucket[bucket.length - 1];

    const dateKey = normalizeDateKey(latestMsg.date);

    let finalHomeworks = [...homeworks];

    if (finalHomeworks.length === 0 && schedule[dateKey]) {
      finalHomeworks.push(...schedule[dateKey]);
    }

    if (!roll && finalHomeworks.length === 0 && mediaCount === 0) {
      return null;
    }

    return {
      roll,
      phone,

      homeworks: [...new Set(finalHomeworks)].sort((a, b) => a - b),

      fileCount: mediaCount,

      submittedAt: parseDate(latestMsg),

      inferredHomework: homeworks.length === 0 && finalHomeworks.length > 0,

      rawText: fullText,
    };
  }

  // -------------------------------------------------

  function extractRoll(text) {
    text = Normalizer.convertBanglaDigits(text);

    const patterns = [
      /(?:roll|rool|id)\s*[:\-]?\s*\(?([A-Z]+\d[\s\-_]?\d{2,6})\)?/i,

      /\b([A-Z]+\d[\s\-_]?\d{2,6})\b/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);

      if (match) {
        return Normalizer.normalizeRoll(match[1]);
      }
    }

    return null;
  }

  // -------------------------------------------------

  function extractHomeworkNumbers(text) {
    text = Normalizer.convertBanglaDigits(text);

    const found = [];

    const patterns = [
      /home\s*work[^0-9]*([0-9,;_\-\s]+)/gi,

      /homework[^0-9]*([0-9,;_\-\s]+)/gi,

      /h\.?\s*w\.?[^0-9]*([0-9,;_\-\s]+)/gi,

      /lesson[^0-9]*([0-9,;_\-\s]+)/gi,

      /হোমওয়ার্ক[^0-9]*([0-9,;_\-\s]+)/gi,

      /হোম\s*ওয়াক[^0-9]*([0-9,;_\-\s]+)/gi,
    ];

    patterns.forEach((pattern) => {
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const numbers = match[1]
          .split(/[,;_\-\s]+/)
          .map((x) => parseInt(x))
          .filter((x) => !isNaN(x));

        found.push(...numbers);
      }
    });

    return [...new Set(found)];
  }

  // -------------------------------------------------

  function mergeDuplicateSubmissions(submissions) {
    const merged = {};

    submissions.forEach((sub) => {
      const key =
        (sub.roll || sub.phone) +
        "_" +
        sub.homeworks.join(",") +
        "_" +
        dateKeyFromDate(sub.submittedAt);

      if (!merged[key]) {
        merged[key] = {
          ...sub,
          attempts: 1,
        };

        return;
      }

      merged[key].attempts++;

      merged[key].fileCount += sub.fileCount;

      if (sub.submittedAt > merged[key].submittedAt) {
        merged[key].submittedAt = sub.submittedAt;
      }
    });

    return Object.values(merged);
  }

  // -------------------------------------------------

  function normalizeDateKey(dateStr) {
    const parts = dateStr.split("/");

    const day = parts[0].padStart(2, "0");

    const month = parts[1].padStart(2, "0");

    const year = "20" + parts[2];

    return `${year}-${month}-${day}`;
  }

  // -------------------------------------------------

  function parseDate(msg) {
    const [day, month, shortYear] = msg.date.split("/").map(Number);
    const year = 2000 + shortYear;
    const timeMatch = String(msg.time)
      .trim()
      .match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?\.?$/i);

    if (!timeMatch) {
      return new Date(year, month - 1, day);
    }

    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const meridiem = (timeMatch[3] || "").toUpperCase();

    if (meridiem === "PM" && hours < 12) {
      hours += 12;
    }

    if (meridiem === "AM" && hours === 12) {
      hours = 0;
    }

    return new Date(year, month - 1, day, hours, minutes);
  }

  function dateKeyFromDate(date) {
    const value = new Date(date);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return {
    buildSubmissions,

    extractRoll,

    extractHomeworkNumbers,
  };
})();
