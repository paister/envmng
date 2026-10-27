import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { confirmProd } from "../confirm.ts";
import { assertEnvName, namedEnvFile } from "../names.ts";
import { parseEnvFile } from "../parse.ts";
import { renderTemplate } from "../render.ts";
import { writeActiveEnv } from "../config.ts";
import { consumerRelPath, listConsumerDirs, writeGeneratedEnv } from "../workspace.ts";

export type SetOptions = {
  root: string;
  name: string;
  yes: boolean;
  verbose: boolean;
};

export class AbortedError extends Error {
  constructor(message = "Aborted.") {
    super(message);
    this.name = "AbortedError";
  }
}

/** Render named profile templates into generated .env files. Throws AbortedError if prod confirm is declined. */
export const setEnv = async ({ root, name, yes, verbose }: SetOptions): Promise<void> => {
  assertEnvName(name);

  if (name === "prod" && !yes) {
    const ok = await confirmProd();
    if (!ok) throw new AbortedError();
  }

  const file = namedEnvFile(name);
  const centralPath = resolve(root, file);
  if (!existsSync(centralPath)) {
    throw new Error(`Missing ${file}. Create it with: pnpm envmng create ${name}`);
  }

  const centralText = readFileSync(centralPath, "utf8");
  const values = parseEnvFile(centralText);

  writeGeneratedEnv(resolve(root, ".env"), centralText, name, file);
  console.log(`wrote .env (from ${file})`);

  let rendered = 0;
  for (const dir of listConsumerDirs(root)) {
    const templatePath = join(dir, file);
    if (!existsSync(templatePath)) continue;

    const relDir = consumerRelPath(root, dir);
    const template = readFileSync(templatePath, "utf8");
    const { text, missing } = renderTemplate(template, values);
    writeGeneratedEnv(join(dir, ".env"), text, name, `${relDir}/${file}`);
    console.log(`wrote ${relDir}/.env`);
    rendered += 1;

    if (missing.length === 0) continue;
    if (verbose) {
      console.warn(`  missing in ${file}: ${missing.join(", ")}`);
      continue;
    }
    console.warn(
      `  ${relDir}: ${missing.length} unresolved {{placeholder}}(s) — re-run with --verbose`
    );
  }

  if (rendered === 0) {
    console.warn(`No consumer ${file} templates found. Run: pnpm envmng create ${name}`);
  }

  writeActiveEnv(root, name);
  console.log(`\nActive env: ${name}`);
};
