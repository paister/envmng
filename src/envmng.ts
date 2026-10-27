#!/usr/bin/env node

import { runCli } from "./cli.ts";
import { findMonorepoRoot } from "./root.ts";

const main = async () => {
  const root = findMonorepoRoot(process.cwd());
  await runCli(root);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
