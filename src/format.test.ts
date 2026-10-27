import { describe, expect, it } from "vite-plus/test";
import { formatEnvFile } from "./format.ts";

describe("formatEnvFile", () => {
  it("sorts the requested example inside headings, including an unclosed quote", () => {
    const header =
      "# ---\n# Test\n# --- \n\n# DATABASE \nDATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres\n\n# Gruppe 2\n";
    expect(formatEnvFile(header + "B = 'test1'\nA = 'test2\n")).toBe(
      header + "A = 'test2\nB = 'test1'\n"
    );
  });

  it("sorts across blank lines without moving them or altering assignments", () => {
    expect(formatEnvFile("Z={{Z}} # keep\n\nexport A = 'a b'\nM=\n")).toBe(
      "export A = 'a b'\n\nM=\nZ={{Z}} # keep\n"
    );
  });

  it("treats every comment and unknown line as a group boundary", () => {
    expect(formatEnvFile("B=2\n# Group\nD=4\nC=3\nunknown\nB=2\nA=1\n")).toBe(
      "B=2\n# Group\nC=3\nD=4\nunknown\nA=1\nB=2\n"
    );
  });

  it("keeps duplicate keys in their original order", () => {
    expect(formatEnvFile("B=2\nA=first\nA=second\n")).toBe("A=first\nA=second\nB=2\n");
  });

  it.each(['"', "'", "`"])("keeps multiline %s values together", quote => {
    const value = `Z=${quote}first\n# not a heading\nA=not an assignment\nlast${quote} # inline\n`;
    expect(formatEnvFile(value + "B=2\n")).toBe("B=2\n" + value);
  });

  it("recognizes closing quotes following escaped backslashes", () => {
    const value = 'Z="path\\\\"\n';
    expect(formatEnvFile(value + 'A="first"\n')).toBe('A="first"\n' + value);
  });

  it.each(["", "\n", "# Header\n\n", "A=1", "A=1\n", "A=1\r\n"])(
    "leaves already formatted content unchanged: %j",
    text => expect(formatEnvFile(text)).toBe(text)
  );

  it.each(["\n", "\r\n"])("preserves %j line endings and a missing final newline", eol => {
    expect(formatEnvFile(`B=2${eol}A=1`)).toBe(`A=1${eol}B=2`);
    expect(formatEnvFile(`B=2${eol}A=1${eol}`)).toBe(`A=1${eol}B=2${eol}`);
  });

  it("is idempotent", () => {
    const formatted = formatEnvFile("# Group\nZ=3\n\nB='two'\nA=1");
    expect(formatEnvFile(formatted)).toBe(formatted);
  });
});
