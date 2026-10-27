import { createInterface, type Interface } from "node:readline/promises";

export type PromptSession = {
  ask: (label: string) => Promise<string>;
  /** Ask until `validate` succeeds; re-prints the error and retries. */
  askUntil: (label: string, validate: (value: string) => void) => Promise<string>;
  close: () => void;
};

/** Open an interactive prompt session, or `null` when stdin is not a TTY. */
export const openPromptSession = (): PromptSession | null => {
  if (!process.stdin.isTTY) return null;

  const rl: Interface = createInterface({ input: process.stdin, output: process.stdout });

  const ask = async (label: string): Promise<string> => (await rl.question(label)).trim();

  const askUntil = async (label: string, validate: (value: string) => void): Promise<string> => {
    for (;;) {
      const value = await ask(label);
      try {
        validate(value);
        return value;
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
      }
    }
  };

  return {
    ask,
    askUntil,
    close: () => rl.close(),
  };
};

export const printCommandHint = (lines: string[]): void => {
  console.log("");
  for (const line of lines) console.log(line);
  console.log("");
};
