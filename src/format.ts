type Entry = { key: string; text: string };

const ASSIGNMENT_RE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

/** Sort assignments within comment-delimited groups without reserializing their values. */
export const formatEnvFile = (text: string): string => {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const output: string[] = [];
  let group: (Entry | string)[] = [];

  const flush = () => {
    const entries = group.filter((item): item is Entry => typeof item !== "string");
    entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    let index = 0;
    for (const item of group) {
      output.push(typeof item === "string" ? item : entries[index++]!.text);
    }
    group = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const match = ASSIGNMENT_RE.exec(line.replace(/\r?\n$/, ""));
    if (!match) {
      if (line.trim() !== "") flush();
      group.push(line);
      continue;
    }

    let entryText = line;
    const value = match[2]!;
    const quote = value[0];
    if (quote === '"' || quote === "'" || quote === "`") {
      // Only consume continuation lines when a closing quote actually exists.
      // An unfinished single-line value must not swallow subsequent assignments.
      const remainder = lines.slice(i + 1).join("");
      const quoted = value.slice(1) + (line.endsWith("\n") ? "\n" : "") + remainder;
      let escaped = false;
      for (let offset = 0; offset < quoted.length; offset++) {
        const char = quoted[offset];
        if (char === quote && !escaped) {
          const extraLines = (quoted.slice(0, offset).match(/\n/g) ?? []).length;
          for (let j = 0; j < extraLines; j++) entryText += lines[++i]!;
          break;
        }
        escaped = char === "\\" && !escaped;
      }
    }
    group.push({ key: match[1]!, text: entryText });
  }
  flush();

  // Keep the final newline attached to the file, not the last sorted assignment.
  const ending = text.endsWith("\r\n") ? "\r\n" : text.endsWith("\n") ? "\n" : "";
  const body = output.map((part, index) => {
    if (index === output.length - 1) return part.replace(/\r?\n$/, "");
    return /\n$/.test(part) ? part : `${part}${text.includes("\r\n") ? "\r\n" : "\n"}`;
  });
  return body.join("") + ending;
};
