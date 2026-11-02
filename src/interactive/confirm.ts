import { createInterface } from "node:readline/promises";

const ask = async (prompt: string): Promise<string | null> => {
  if (!process.stdin.isTTY) return null;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(prompt)).trim();
  } finally {
    rl.close();
  }
};

/** Interactive confirmation for applying the prod profile. */
export const confirmProd = async (): Promise<boolean> => {
  const answer = await ask(
    "Apply PRODUCTION env (.<prod>.env → .env)? This may point local apps at live infra. [y/N] "
  );
  if (answer === null) {
    console.error("set prod requires an interactive TTY or --yes");
    return false;
  }
  return /^y(es)?$/i.test(answer);
};

/** [y/N] prompt. Returns false on non-TTY. */
export const confirmYes = async (prompt: string): Promise<boolean> => {
  const answer = await ask(prompt);
  if (answer === null) {
    console.error("Confirmation requires an interactive TTY or --yes");
    return false;
  }
  return /^y(es)?$/i.test(answer);
};

/**
 * Require the user to type `expected` exactly (case-sensitive).
 * Returns false on non-TTY or mismatch.
 */
export const confirmByTyping = async (expected: string, prompt: string): Promise<boolean> => {
  const answer = await ask(prompt);
  if (answer === null) {
    console.error("Confirmation requires an interactive TTY or --yes");
    return false;
  }
  return answer === expected;
};
