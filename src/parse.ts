import { parse as parseDotenv } from "dotenv";

const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Parse a dotenv-style file into a Map (first assignment wins; comments ignored). */
export const parseEnvFile = (text: string): Map<string, string> => {
  const out = new Map<string, string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || out.has(key)) continue;
    out.set(key, line.slice(eq + 1));
  }
  return out;
};

/** Serialize selected keys (preserve raw values as stored, including quotes). */
export const serializeEnvKeys = (
  values: Map<string, string>,
  keys: readonly string[],
  header: string
): string => {
  const lines = [header, ""];
  for (const key of keys) {
    if (!values.has(key)) continue;
    lines.push(`${key}=${values.get(key)}`);
  }
  lines.push("");
  return lines.join("\n");
};

export const assertEnvKey = (key: string): void => {
  if (!ENV_KEY_RE.test(key)) {
    throw new Error(
      `Invalid env key "${key}". Use letters/digits/_ starting with a letter or underscore.`
    );
  }
};

/**
 * Quote a raw value for dotenv when it needs it (spaces, `#`, quotes, etc.).
 * Already-quoted values are left alone.
 */
export const formatEnvValue = (value: string): string => {
  if (value === "") return "";
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value;
  }
  if (!/[\s#"'`\\]/.test(value)) return value;

  // dotenv does not decode JavaScript-style escapes for quotes or backslashes.
  // Only accept a single-line representation that its runtime parser round-trips.
  const candidates = [
    `"${value.replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`,
    `'${value}'`,
    `\`${value}\``,
    value,
  ];
  for (const candidate of candidates) {
    if (/[\r\n]/.test(candidate)) continue;
    if (parseDotenv(`VALUE=${candidate}\n`).VALUE === value) return candidate;
  }
  throw new Error("Value cannot be represented losslessly as a single-line dotenv assignment.");
};

/**
 * Upsert `KEY=value` in dotenv text: replace first assignment line, or append.
 * Removes duplicate assignments for this key; preserves comments and other lines.
 * Returns `{ text, existed }`.
 */
export const upsertEnvKey = (
  text: string,
  key: string,
  value: string
): { text: string; existed: boolean } => {
  assertEnvKey(key);
  const formatted = formatEnvValue(value);
  const assignment = `${key}=${formatted}`;
  const endsWithNewline = text.length > 0 && /\r?\n$/.test(text);
  const lines = text.length === 0 ? [] : text.split(/\r?\n/);
  // split keeps a trailing empty string when file ends with newline — drop it for rewrite
  if (lines.length > 0 && lines[lines.length - 1] === "" && endsWithNewline) {
    lines.pop();
  }

  let existed = false;
  const next = lines.flatMap(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return [line];
    const eq = trimmed.indexOf("=");
    if (eq <= 0) return [line];
    const lineKey = trimmed.slice(0, eq).trim();
    if (lineKey !== key) return [line];
    if (existed) return [];
    existed = true;
    return [assignment];
  });

  if (!existed) {
    if (next.length > 0 && next[next.length - 1] !== "") next.push("");
    next.push(assignment);
  }

  return { text: `${next.join("\n")}\n`, existed };
};

/**
 * Remove all `KEY=…` assignment lines from dotenv text.
 * Preserves comments and other keys. Returns `{ text, removed }`.
 */
export const removeEnvKey = (text: string, key: string): { text: string; removed: boolean } => {
  assertEnvKey(key);
  const endsWithNewline = text.length > 0 && /\r?\n$/.test(text);
  const lines = text.length === 0 ? [] : text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "" && endsWithNewline) {
    lines.pop();
  }

  let removed = false;
  const next = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return true;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) return true;
    const lineKey = trimmed.slice(0, eq).trim();
    if (lineKey !== key) return true;
    removed = true;
    return false;
  });

  if (next.length === 0) return { text: "", removed };
  return { text: `${next.join("\n")}\n`, removed };
};
