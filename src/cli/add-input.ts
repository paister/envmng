import type { AddInput, AddOptions } from "../commands/add.ts";
import { assertEnvName } from "../core/names.ts";
import { assertEnvKey } from "../core/parse.ts";
import { openPromptSession, printCommandHint } from "./prompt.ts";

/**
 * Resolve add args; prompts interactively for anything still missing.
 * Lives in cli/ so commands stay free of terminal I/O helpers.
 */
export const resolveAddInput = async (input: AddInput): Promise<AddOptions> => {
  let { name, key, value } = input;
  const syncProfiles = Boolean(input.syncProfiles);
  const needsPrompt = !name || !key || value === undefined;

  if (!needsPrompt) {
    return {
      root: input.root,
      name: name!,
      key: key!,
      value: value!,
      syncProfiles,
    };
  }

  printCommandHint([
    "Usage:  envmng add <name> --key KEY --value VALUE [--sync-profiles]",
    "Example: envmng add local --key NODE_ENV --value development",
    "",
    "Missing fields — interactive fill-in:",
  ]);

  const session = openPromptSession();
  if (!session) {
    throw new Error("Missing arguments and no TTY for prompts. Use: envmng add <name> --key KEY --value VALUE");
  }

  try {
    if (!name) {
      name = await session.askUntil("Profile name (e.g. local): ", assertEnvName);
    }
    if (!key) {
      key = await session.askUntil("Key: ", assertEnvKey);
    }
    if (value === undefined) {
      value = await session.ask("Value (empty allowed): ");
    }
  } finally {
    session.close();
  }

  return { root: input.root, name, key, value, syncProfiles };
};
