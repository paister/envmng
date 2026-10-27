/** `local`, `prod`, `prev`, … — lowercase slug */
export const ENV_NAME_RE = /^[a-z][a-z0-9_-]*$/;

/** Matches `.{name}.env` profile files (not `.env.example`). */
export const NAMED_ENV_FILE_RE = /^\.([a-z][a-z0-9_-]*)\.env$/;

export const namedEnvFile = (name: string): string => `.${name}.env`;

/** Extract profile slug from a filename like `.local.env`, or null. */
export const profileNameFromFilename = (filename: string): string | null => {
  const match = NAMED_ENV_FILE_RE.exec(filename);
  if (!match) return null;
  const name = match[1]!;
  if (name === "example") return null;
  return name;
};

export const assertEnvName = (name: string): void => {
  if (!ENV_NAME_RE.test(name)) {
    throw new Error(
      `Invalid env name "${name}". Use lowercase letters/digits/_/- (e.g. local, prod, prev).`
    );
  }
  if (name === "example") {
    throw new Error(`Reserved name "example" — that is the template (.env.example).`);
  }
};
