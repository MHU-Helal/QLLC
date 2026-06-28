// js/parser.js

const Parser = (() => {
  const MESSAGE_REGEX =
    /^(\d{1,2}\/\d{1,2}\/\d{2}),\s+([\d:]+\s?[APMapm\.]*)\s+-\s+(.*?):\s?(.*)$/;

  function parseChat(text) {
    text = text.replace(/\r/g, "");

    const lines = text.split("\n");

    const messages = [];

    let current = null;

    for (let line of lines) {
      const match = line.match(MESSAGE_REGEX);

      if (match) {
        if (current) {
          messages.push(current);
        }

        current = {
          date: match[1],
          time: match[2],
          sender: match[3],
          body: match[4],
        };

        continue;
      }

      if (current) {
        current.body += "\n" + line;
      }
    }

    if (current) {
      messages.push(current);
    }

    return messages.map(processMessage);
  }

  function processMessage(msg) {
    const phone = extractPhone(msg.sender);

    return {
      date: msg.date,
      time: msg.time,
      phone,
      body: msg.body,
      isMedia: detectMedia(msg.body),
    };
  }

  function extractPhone(sender) {
    return Normalizer.normalizePhone(sender);
  }

  function detectMedia(text) {
    return text.includes("<Media omitted>") || text.includes("(file attached)");
  }

  return {
    parseChat,
  };
})();
