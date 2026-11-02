import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { ensureGitignore, gitignoreHasEntry } from "./gitignore.ts";

describe("gitignoreHasEntry", () => {
  it("matches exact lines only", () => {
    expect(gitignoreHasEntry(".envmng.*\n", ".envmng.*")).toBe(true);
    expect(gitignoreHasEntry(".env\n", "**/.env")).toBe(false);
    expect(gitignoreHasEntry("/.envmng.*\n", ".envmng.*")).toBe(false);
  });
});

describe("ensureGitignore", () => {
  it("no-ops when .gitignore is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-gi-missing-"));
    const result = ensureGitignore(root);
    expect(result.path).toBeNull();
    expect(result.updated).toBe(false);
  });

  it("appends a managed block with missing entries", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-gi-append-"));
    writeFileSync(join(root, ".gitignore"), "node_modules\n");
    const result = ensureGitignore(root);
    expect(result.updated).toBe(true);
    expect(result.added.length).toBeGreaterThan(0);
    const text = readFileSync(join(root, ".gitignore"), "utf8");
    expect(text).toContain("# >>> envmng");
    expect(text).toContain(".env");
    expect(text).toContain(".envmng.*");
    expect(text).not.toContain("/.envmng.*");
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
        ".envmng.*",
        "",
      ].join("\n")
    );
    const result = ensureGitignore(root);
    expect(result.updated).toBe(false);
    expect(result.added).toEqual([]);
  });

  it("appends only missing entries when core already exists outside a managed block", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-gi-partial-"));
    writeFileSync(
      join(root, ".gitignore"),
      [".env", "**/.env", "!.env.example", "!**/.env.example", ".envmng", ""].join("\n")
    );
    const result = ensureGitignore(root);
    expect(result.updated).toBe(true);
    expect(result.added).toEqual([".envmng.*"]);
    const text = readFileSync(join(root, ".gitignore"), "utf8");
    expect(text).toContain(".envmng.*");
    // Must not re-list core patterns that already existed above.
    const managed = text.slice(text.indexOf("# >>> envmng"), text.indexOf("# <<< envmng"));
    const managedLines = managed.split("\n").map((line) => line.trim()).filter(Boolean);
    expect(managedLines).not.toContain(".envmng");
    expect(managedLines).toContain(".envmng.*");
  });

  it("refreshes an existing managed block", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-gi-refresh-"));
    writeFileSync(
      join(root, ".gitignore"),
      ["node_modules", "# >>> envmng", ".env", "# <<< envmng", ""].join("\n")
    );
    const result = ensureGitignore(root);
    expect(result.updated).toBe(true);
    const text = readFileSync(join(root, ".gitignore"), "utf8");
    expect(text).toContain(".envmng.*");
    expect(text).toContain(".envmng");
    expect(text.indexOf("# >>> envmng")).toBe(text.lastIndexOf("# >>> envmng"));
  });

  it("upgrades root-only /.envmng.* to .envmng.* on refresh", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-gi-upgrade-"));
    writeFileSync(
      join(root, ".gitignore"),
      [
        "# >>> envmng",
        "# managed by envmng (init / create)",
        ".env",
        "**/.env",
        "!.env.example",
        "!**/.env.example",
        ".envmng",
        "/.envmng.*",
        "/.envmng.local",
        "# <<< envmng",
        "",
      ].join("\n")
    );
    const result = ensureGitignore(root);
    expect(result.updated).toBe(true);
    expect(result.added).toContain(".envmng.*");
    const text = readFileSync(join(root, ".gitignore"), "utf8");
    expect(text).toContain(".envmng.*");
    const managed = text.slice(text.indexOf("# >>> envmng"), text.indexOf("# <<< envmng"));
    expect(managed).not.toContain("/.envmng.*");
    expect(managed).not.toContain("/.envmng.local");
  });
});
