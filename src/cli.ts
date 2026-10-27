import type { Argv } from "yargs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { addEnvKey, resolveAddInput } from "./commands/add.ts";
import { checkEnv } from "./commands/check.ts";
import { createEnv } from "./commands/create.ts";
import { deleteEnv } from "./commands/delete.ts";
import { initEnv } from "./commands/init.ts";
import { formatEnv } from "./commands/format.ts";
import { removeEnvVar } from "./commands/remove.ts";
import { AbortedError, setEnv } from "./commands/set.ts";

const withName = <T>(y: Argv<T>) =>
  y.positional("name", {
    describe: "Env profile slug (local, prod, prev, …)",
    type: "string",
    demandOption: true,
  });

const withOptionalName = <T>(y: Argv<T>) =>
  y.positional("name", {
    describe: "Env profile slug (default: local)",
    type: "string",
    default: "local",
  });

/** Wire yargs commands; `root` is the monorepo root. */
export const runCli = async (root: string, argv: string[] = hideBin(process.argv)): Promise<void> => {
  try {
    await yargs(argv)
      .scriptName("envmng")
      .usage("$0 <command> [options]")
      .epilogue(
        [
          "Central values:   /.{name}.env                    (from root .env.example)",
          "Consumer templates: <dir>/.{name}.env             (dirs with .env.example, {{VAR}})",
          "Runtime output:   .env / <consumer>/.env",
        ].join("\n"),
      )
      .command(
        "init [name]",
        "Onboard a checkout: create → check → set (default profile: local)",
        (y) =>
          withOptionalName(y)
            .option("force", {
              type: "boolean",
              default: false,
              describe: "Overwrite existing profile files on create",
            })
            .option("set", {
              type: "boolean",
              default: true,
              describe: "Render generated .env files after create/check",
            })
            .option("yes", {
              alias: "y",
              type: "boolean",
              default: false,
              describe: 'Skip confirmation when name is "prod"',
            })
            .option("strict", {
              type: "boolean",
              default: false,
              describe: "Fail init when check reports warnings",
            })
            .option("verbose", {
              alias: "v",
              type: "boolean",
              default: false,
              describe: "Verbose check / set output",
            }),
        async (args) => {
          const name = String(args.name ?? "local");
          const { checkOk } = await initEnv({
            root,
            name,
            force: Boolean(args.force),
            apply: args.set !== false,
            yes: Boolean(args.yes),
            strict: Boolean(args.strict),
            verbose: Boolean(args.verbose),
          });
          if (!checkOk) process.exit(1);
        },
      )
      .command(
        "create <name>",
        "Copy .env.example → .<name>.env (root values + consumer templates)",
        (y) =>
          withName(y).option("force", {
            type: "boolean",
            default: false,
            describe: "Overwrite existing .<name>.env files",
          }),
        (args) => {
          createEnv({ root, name: String(args.name), force: Boolean(args.force) });
        },
      )
      .command(
        "set <name>",
        "Render consumer .{name}.env + root .{name}.env → .env files",
        (y) =>
          withName(y)
            .option("yes", {
              alias: "y",
              type: "boolean",
              default: false,
              describe: 'Skip confirmation when name is "prod"',
            })
            .option("verbose", {
              alias: "v",
              type: "boolean",
              default: false,
              describe: "List unresolved {{placeholders}}",
            }),
        async (args) => {
          await setEnv({
            root,
            name: String(args.name),
            yes: Boolean(args.yes),
            verbose: Boolean(args.verbose),
          });
        },
      )
      .command(
        "add [name]",
        "Declare KEY in root .env.example and update profile value without activation",
        (y) =>
          y
            .positional("name", {
              describe: "Env profile slug (local, prod, …) — prompted if omitted",
              type: "string",
            })
            .option("key", {
              type: "string",
              describe: "Env key to set — prompted if omitted",
            })
            .option("value", {
              type: "string",
              describe: "Env value — prompted if omitted (use '' for empty)",
            })
            .option("sync-profiles", {
              type: "boolean",
              default: false,
              describe: "Also copy the value to other root .{name}.env profiles that lack the key",
            })
            .example("$0 add local --key NODE_ENV --value development", "Root catalogue + profile")
            .example("$0 add local --key MY_KEY --value 'x' --sync-profiles", "Also sync other profiles")
            .example("$0 add", "Interactive: asks name, key, value"),
        async (args) => {
          const resolved = await resolveAddInput({
            root,
            name: args.name === undefined || args.name === "" ? undefined : String(args.name),
            key: args.key === undefined ? undefined : String(args.key),
            value: args.value === undefined ? undefined : String(args.value),
            syncProfiles: Boolean(args["sync-profiles"]),
          });
          await addEnvKey(resolved);
        },
      )
      .command(
        "remove <name>",
        "Remove KEY from root .{name}.env",
        (y) =>
          withName(y)
            .option("key", {
              type: "string",
              demandOption: true,
              describe: "Env key to remove",
            })
            .example("$0 remove local --key MY_KEY", "Delete MY_KEY from .local.env"),
        (args) => {
          removeEnvVar({
            root,
            name: String(args.name),
            key: String(args.key),
          });
        },
      )
      .command(
        "delete <name>",
        "Delete an entire profile (root + consumer .{name}.env) — requires confirmation",
        (y) =>
          withName(y).option("yes", {
            alias: "y",
            type: "boolean",
            default: false,
            describe: "Skip confirmation (dangerous)",
          }),
        async (args) => {
          await deleteEnv({
            root,
            name: String(args.name),
            yes: Boolean(args.yes),
          });
        },
      )
      .command(
        "check [name]",
        "Validate profile(s) + source↔.env.example; omit name = every profile",
        (y) =>
          y
            .positional("name", {
              describe: "Env profile slug (omit = all existing profiles)",
              type: "string",
            })
            .option("strict", {
              type: "boolean",
              default: false,
              describe: "Treat warnings (empty values, key drift, unused) as failures",
            })
            .option("verbose", {
              alias: "v",
              type: "boolean",
              default: false,
              describe: "Extra summary output (add hints, empty-value refs)",
            })
            .option("source", {
              type: "boolean",
              default: true,
              describe: "Scan app sources vs .env.example (use --no-source to skip)",
            })
            .option("ignore", {
              type: "array",
              string: true,
              default: [],
              describe: "Keys to exclude from the source↔example scan",
            })
            .option("fix", {
              type: "boolean",
              default: false,
              describe: "Write missing keys into .env.example / drift gaps into profiles (no secret values)",
            })
            .option("include-tests", {
              type: "boolean",
              default: false,
              describe: "Also scan tests/ and *.test.ts (default: runtime sources only)",
            })
            .example("$0 check local", "One profile + source scan")
            .example("$0 check --fix", "Add used-but-missing keys to examples")
            .example("$0 check --no-source", "Profile completeness only")
            .example("$0 check --ignore NODE_ENV", "Skip a key in source scan"),
        (args) => {
          const name = args.name === undefined || args.name === "" ? undefined : String(args.name);
          const ignore = (args.ignore as string[] | undefined) ?? [];
          const { ok } = checkEnv({
            root,
            name,
            strict: Boolean(args.strict),
            verbose: Boolean(args.verbose),
            skipSource: args.source === false,
            ignore,
            fix: Boolean(args.fix),
            includeTests: Boolean(args["include-tests"]),
          });
          if (!ok) process.exit(1);
        },
      )
      .command(
        ["format", "fmt"],
        "Sort env files alphabetically within comment-delimited groups",
        (y) => y,
        () => formatEnv({ root }),
      )
      .demandCommand(1, "Use init | create | set | add | remove | delete | check | format (fmt)")
      .strict()
      .help()
      .alias("h", "help")
      .recommendCommands()
      .fail((msg, err, yargsInstance) => {
        if (err instanceof AbortedError) {
          console.error(err.message);
          process.exit(1);
        }

        const text = msg || (err instanceof Error ? err.message : "");
        const isUsageError = !err || err.name === "YError" || /Not enough non-option arguments|Missing required argument|Unknown argument|Invalid values|Did you mean/i.test(text);

        if (err instanceof Error && !isUsageError) {
          console.error(err.message);
          process.exit(1);
        }

        if (text) console.error(`Error: ${text}\n`);
        yargsInstance.showHelp("error");
        process.exit(1);
      })
      .parseAsync();
  } catch (error) {
    if (error instanceof AbortedError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
};
