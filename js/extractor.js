const Extractor = (() => {
  // -----------------------------------------
  // Bangla Roll Prefixes
  // -----------------------------------------

  const rollPrefixMap = {
    এম: "M",
    ম: "M",
    এফ: "F",
    ফ: "F",
  };

  // -----------------------------------------

  function normalizeBanglaRollText(text) {
    Object.keys(rollPrefixMap).forEach((key) => {
      text = text.replace(new RegExp(key, "g"), rollPrefixMap[key]);
    });

    return text;
  }

  // -----------------------------------------
  // ROLL
  // -----------------------------------------

  function extractRoll(text) {
    text = Normalizer.convertBanglaDigits(text);

    text = normalizeBanglaRollText(text);

    const patterns = [
      /(?:roll|rool|id)\s*[:\-]?\s*\(?([A-Z]+\d?[\s\-_]?\d{2,6})\)?/gi,

      /\b([FM]\d[\s\-_]?\d{2,6})\b/gi,

      /\b(FE[\s\-_]?\d{2,6})\b/gi,

      /\b(ME[\s\-_]?\d{2,6})\b/gi,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text);

      if (match) {
        return Normalizer.normalizeRoll(match[1]);
      }
    }

    return null;
  }

  // -----------------------------------------
  // HOMEWORK
  // -----------------------------------------

  function extractHomeworkNumbers(text) {
    text = Normalizer.convertBanglaDigits(text);

    const homeworks = [];

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

      while ((match = pattern.exec(text))) {
        parseHomeworkChunk(match[1], homeworks);
      }
    });

    return [...new Set(homeworks)].sort((a, b) => a - b);
  }

  // -----------------------------------------

  function parseHomeworkChunk(chunk, homeworks) {
    chunk = chunk.trim();

    const parts = chunk.split(/[;,]/);

    parts.forEach((part) => {
      part = part.trim();

      if (/^\d+\-\d+$/.test(part)) {
        const [start, end] = part.split("-").map(Number);

        for (let i = start; i <= end; i++) {
          homeworks.push(i);
        }
      } else {
        const nums = part.match(/\d+/g);

        if (!nums) return;

        nums.forEach((n) => {
          homeworks.push(Number(n));
        });
      }
    });
  }

  // -----------------------------------------
  // NAME
  // -----------------------------------------

  function extractName(text) {
    const match = text.match(/name\s*[:\-]\s*(.+)/i);

    if (match) {
      return match[1].trim().split("\n")[0];
    }

    return null;
  }

  // -----------------------------------------
  // DATE
  // -----------------------------------------

  function extractDate(text) {
    const match = text.match(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/);

    return match ? match[0] : null;
  }

  return {
    extractRoll,

    extractHomeworkNumbers,

    extractName,

    extractDate,
  };
})();
