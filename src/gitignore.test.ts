import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { ensureGitignore, gitignoreHasEntry } from "./gitignore";

describe("gitignoreHasEntry", () => {
  it("treats escaped and unescaped root profile globs as equal", () => {
    expect(gitignoreHasEntry("/.*\\.env\n", "/.*.env")).toBe(true);
    expect(gitignoreHasEntry("/.*.env\n", "/.*\\.env")).toBe(true);
    expect(gitignoreHasEntry(".env\n", "**/.env")).toBe(false);
  });
});

describe("ensureGitignore", () => {
  it("no-ops when .gitignore is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-gi-missing-"));
    const result = ensureGitignore(root, { profileName: "local" });
    expect(result.path).toBeNull();
    expect(result.updated).toBe(false);
  });

  it("appends a managed block with missing entries", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-gi-append-"));
    writeFileSync(join(root, ".gitignore"), "node_modules\n");
    const result = ensureGitignore(root, { profileName: "local" });
    expect(result.updated).toBe(true);
    expect(result.added.length).toBeGreaterThan(0);
    const text = readFileSync(join(root, ".gitignore"), "utf8");
    expect(text).toContain("# >>> envmng");
    expect(text).toContain(".env");
    expect(text).toContain("/.*.env");
    expect(text).toContain("/.local.env");
    expect(text).toContain("# <<< envmng");
  });

  it("is idempotent when entries already exist", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-gi-idem-"));
    writeFileSync(
      join(root, ".gitignore"),
      [
        ".env",
        "**/.env",
        "!.env.example",
        "!**/.env.example",
        ".envmng",
        "/.*.env",
        "/.local.env",
        "",
      ].join("\n")
    );
    const result = ensureGitignore(root, { profileName: "local" });
    expect(result.updated).toBe(false);
    expect(result.added).toEqual([]);
  });

  it("appends only missing entries when core already exists outside a managed block", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-gi-partial-"));
    writeFileSync(
      join(root, ".gitignore"),
      [".env", "**/.env", "!.env.example", "!**/.env.example", ".envmng", "/.*\\.env", ""].join(
        "\n"
      )
    );
    const result = ensureGitignore(root, { profileName: "local" });
    expect(result.updated).toBe(true);
    expect(result.added).toEqual(["/.local.env"]);
    const text = readFileSync(join(root, ".gitignore"), "utf8");
    expect(text).toContain("/.local.env");
    // Must not re-list core patterns that already existed above.
    const managed = text.slice(text.indexOf("# >>> envmng"), text.indexOf("# <<< envmng"));
    expect(managed).not.toContain(".envmng");
    expect(managed).toContain("/.local.env");
  });

  it("refreshes an existing managed block", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-gi-refresh-"));
    writeFileSync(
      join(root, ".gitignore"),
      ["node_modules", "# >>> envmng", ".env", "# <<< envmng", ""].join("\n")
    );
    const result = ensureGitignore(root, { profileName: "prev" });
    expect(result.updated).toBe(true);
    const text = readFileSync(join(root, ".gitignore"), "utf8");
    expect(text).toContain("/.prev.env");
    expect(text).toContain(".envmng");
    expect(text.indexOf("# >>> envmng")).toBe(text.lastIndexOf("# >>> envmng"));
  });
});
