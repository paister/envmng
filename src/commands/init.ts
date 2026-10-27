import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { checkEnv } from "./check.ts";
import { createEnv } from "./create.ts";
import { setEnv } from "./set.ts";

export type InitOptions = {
  root: string;
  name: string;
  force: boolean;
  /** When false, skip rendering generated .env files. Default true. */
  apply: boolean;
  yes: boolean;
  strict: boolean;
  verbose: boolean;
};

export type InitResult = {
  checkOk: boolean;
};

/**
 * Onboard a checkout: scaffold profile → check → optionally set.
 * Does not invent secrets or touch Docker/DB.
 */
export const initEnv = async ({
  root,
  name,
  force,
  apply,
  yes,
  strict,
  verbose,
}: InitOptions): Promise<InitResult> => {
  const example = resolve(root, ".env.example");
  if (!existsSync(example)) {
    throw new Error(`Missing root .env.example — cannot init without a template.`);
  }

  console.log(`\n→ create ${name}`);
  createEnv({ root, name, force, quiet: true });

  console.log(`\n→ check ${name}`);
  const { reports, ok: checkOk } = checkEnv({
    root,
    name,
    strict,
    verbose,
    skipSource: false,
    ignore: [],
    fix: false,
    includeTests: false,
  });
  const report = reports[0];

  if (!checkOk) {
    const reason =
      report && report.errorCount > 0
        ? "fix errors above"
        : "check failed with --strict (warnings)";
    console.error(`\ninit aborted: ${reason}, then re-run pnpm envmng init ${name}`);
    return { checkOk: false };
  }

  if (apply) {
    console.log(`\n→ set ${name}`);
    await setEnv({ root, name, yes, verbose });
  } else {
    console.log(`\nskipped set (--no-set). Run: pnpm envmng set ${name}`);
  }

  console.log(`\nNext:`);
  console.log(
    `  1. Fill empty keys in .${name}.env  (see warnings above, or: pnpm envmng check ${name})`
  );
  console.log(`  2. pnpm envmng check ${name}${strict ? " --strict" : ""}`);
  if (apply) {
    console.log(`  3. Re-run pnpm envmng set ${name} after editing values`);
  } else {
    console.log(`  3. pnpm envmng set ${name}`);
  }
  console.log(`  4. pnpm docker:up && pnpm db:push   # if you need local infra`);

  return { checkOk };
};
