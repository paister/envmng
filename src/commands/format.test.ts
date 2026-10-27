import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { runCli } from "../cli.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("format CLI", () => {
  it.each(["format", "fmt"])("%s formats root and consumer env files only", async command => {
    const root = mkdtempSync(join(tmpdir(), "envmng-format-"));
    roots.push(root);
    const files = [
      ".env",
      ".env.example",
      ".local.env",
      ".prod.env",
      "apps/api/.env.example",
      "apps/api/.env",
      "apps/api/.local.env",
      "node_modules/ignored/.env.example",
      "node_modules/ignored/.env",
      "other/.env",
      ".envmng",
      "notes.txt",
      "backup.env",
    ];
    for (const file of files) {
      const path = join(root, file);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, "B=2\nA=1\n");
    }
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await runCli(root, [command]);
    for (const file of files.slice(0, 7)) {
      expect(readFileSync(join(root, file), "utf8")).toBe("A=1\nB=2\n");
    }
    for (const file of files.slice(7)) {
      expect(readFileSync(join(root, file), "utf8")).toBe("B=2\nA=1\n");
    }
    expect(log).toHaveBeenLastCalledWith("Formatted 7 of 7 env file(s).");
    await runCli(root, [command]);
    expect(log).toHaveBeenLastCalledWith("Formatted 0 of 7 env file(s).");
  });

  it("handles a repository without env files", async () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-format-empty-"));
    roots.push(root);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await runCli(root, ["format"]);
    expect(log).toHaveBeenLastCalledWith("Formatted 0 of 0 env file(s).");
  });
});
