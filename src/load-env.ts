import { config } from "dotenv";
import { resolve } from "node:path";
import { findMonorepoRoot } from "./root";

export type LoadGeneratedEnvOptions = {
  /**
   * Directory that owns the generated .env (e.g. a consumer dir or monorepo root).
   * Defaults to process.cwd().
   */
  dir?: string;
};

/**
 * Load a single generated .env (from pnpm envmng set).
 * Programs must not read named profile files — only .env.
 */
export const loadGeneratedEnv = (
  options: LoadGeneratedEnvOptions = {}
): {
  root: string;
  envPath: string;
} => {
  const dir = resolve(options.dir ?? process.cwd());
  const root = findMonorepoRoot(dir);
  const envPath = resolve(dir, ".env");
  config({ path: envPath });
  return { root, envPath };
};

/** @deprecated Use `loadGeneratedEnv` — kept for call-site compatibility. */
export const loadMonorepoEnv = (options: { appDir?: string } = {}) => {
  const { root, envPath } = loadGeneratedEnv({ dir: options.appDir });
  return {
    root,
    rootEnvPath: resolve(root, ".env"),
    appEnvPath: envPath === resolve(root, ".env") ? null : envPath,
  };
};
