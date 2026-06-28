// js/normalizer.js

const Normalizer = (() => {
  const bnDigits = {
    "০": "0",
    "১": "1",
    "২": "2",
    "৩": "3",
    "৪": "4",
    "৫": "5",
    "৬": "6",
    "৭": "7",
    "৮": "8",
    "৯": "9",
  };

  function convertBanglaDigits(text = "") {
    return text.replace(/[০-৯]/g, (d) => bnDigits[d] || d);
  }

  function normalizeText(text = "") {
    text = convertBanglaDigits(text);

    return text
      .replace(/\r/g, "")
      .replace(/\u200E/g, "")
      .replace(/\u200F/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizePhone(phone = "") {
    phone = phone.replace(/[^\d]/g, "");

    if (phone.startsWith("0")) {
      phone = "88" + phone;
    }

    if (phone.startsWith("880") === false && phone.length >= 10) {
      phone = "880" + phone.replace(/^88/, "");
    }

    return phone;
  }

  function normalizeRoll(raw = "") {
    raw = convertBanglaDigits(raw);

    raw = raw.toUpperCase();

    raw = raw.replace(/[()]/g, "");

    raw = raw.replace(/_/g, "-");

    raw = raw.replace(/\./g, "");

    raw = raw.replace(/\s+/g, "");

    raw = raw.replace(/^([A-Z]+)-?(\d)(\d{2,6})$/, "$1$2-$3");

    raw = raw.replace(/([A-Z]+)(\d+)-?(\d+)/, "$1$2-$3");

    raw = raw.replace(/([A-Z]+\d)(\d{3,6})$/, "$1-$2");

    return raw;
  }

  return {
    convertBanglaDigits,
    normalizeText,
    normalizePhone,
    normalizeRoll,
  };
})();
