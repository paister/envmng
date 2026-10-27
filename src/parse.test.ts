import { parse as parseDotenv } from "dotenv";
import { describe, expect, it } from "vite-plus/test";
import { renderTemplate } from "./render";
import {
  formatEnvValue,
  parseEnvFile,
  removeEnvKey,
  serializeEnvKeys,
  upsertEnvKey,
} from "./parse";

describe("parseEnvFile", () => {
  it("parses keys and ignores comments", () => {
    const map = parseEnvFile('# c\nFOO=bar\nBAZ="qux"\n');
    expect(map.get("FOO")).toBe("bar");
    expect(map.get("BAZ")).toBe('"qux"');
  });
});

describe("serializeEnvKeys", () => {
  it("writes only requested keys that exist", () => {
    const values = new Map([
      ["A", "1"],
      ["B", "2"],
    ]);
    const out = serializeEnvKeys(values, ["B", "C"], "# header");
    expect(out).toContain("# header");
    expect(out).toContain("B=2");
    expect(out).not.toContain("A=");
    expect(out).not.toContain("C=");
  });
});

describe("formatEnvValue", () => {
  it("quotes values with spaces", () => {
    expect(formatEnvValue("this is a value")).toBe('"this is a value"');
    expect(formatEnvValue("plain")).toBe("plain");
    expect(formatEnvValue('"already"')).toBe('"already"');
  });
});

describe("upsertEnvKey", () => {
  it.each([
    'a"b',
    "a'b",
    "C:\\tools\\bin",
    "literal\\nsequence",
    "line one\nline two",
    "line one\rline two",
    "contains # comment marker",
    "both \"double\" and 'single' quotes",
    "trailing\\",
    "`backticks`",
    "  padded  ",
  ])("preserves runtime value %j in root and rendered consumer files", value => {
    const { text } = upsertEnvKey("", "KEY", value);
    expect(parseDotenv(text).KEY).toBe(value);
    const rendered = renderTemplate("KEY={{KEY}}\n", parseEnvFile(text));
    expect(parseDotenv(rendered.text).KEY).toBe(value);
  });

  it("rejects values with no lossless single-line representation", () => {
    expect(() => upsertEnvKey("", "KEY", "literal\\n plus actual\nnewline")).toThrow("losslessly");
  });

  it("removes duplicate assignments so dotenv and templates use the new value", () => {
    const { text, existed } = upsertEnvKey("KEY=old\n# keep\nOTHER=1\nKEY=stale\n", "KEY", "new");
    expect(existed).toBe(true);
    expect(text).toBe("KEY=new\n# keep\nOTHER=1\n");
    expect(parseDotenv(text).KEY).toBe("new");
    expect(parseEnvFile(text).get("KEY")).toBe("new");
  });
  it("appends a new key", () => {
    const { text, existed } = upsertEnvKey("# header\nFOO=bar\n", "MY_KEY", "this is a value");
    expect(existed).toBe(false);
    expect(text).toBe('# header\nFOO=bar\n\nMY_KEY="this is a value"\n');
  });

  it("replaces an existing key in place", () => {
    const { text, existed } = upsertEnvKey("A=1\nB=old\nC=3\n", "B", "new");
    expect(existed).toBe(true);
    expect(text).toBe("A=1\nB=new\nC=3\n");
  });
});

describe("removeEnvKey", () => {
  it("removes an existing key and keeps comments", () => {
    const { text, removed } = removeEnvKey("# h\nA=1\nB=2\nC=3\n", "B");
    expect(removed).toBe(true);
    expect(text).toBe("# h\nA=1\nC=3\n");
  });

  it("is a no-op when key is absent", () => {
    const { text, removed } = removeEnvKey("A=1\n", "MISSING");
    expect(removed).toBe(false);
    expect(text).toBe("A=1\n");
  });
});
