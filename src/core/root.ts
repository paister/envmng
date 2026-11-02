import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const isMonorepoRoot = (dir: string): boolean =>
  existsSync(resolve(dir, "pnpm-workspace.yaml")) || existsSync(resolve(dir, "turbo.json"));

/** Walk up from `startDir` until the monorepo root (pnpm-workspace / turbo.json). */
export const findMonorepoRoot = (startDir: string): string => {
  let dir = resolve(startDir);
  for (;;) {
    if (isMonorepoRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(startDir);
    dir = parent;
  }
};
