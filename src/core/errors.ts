/** Thrown when the user declines an interactive confirmation. */
export class AbortedError extends Error {
  constructor(message = "Aborted.") {
    super(message);
    this.name = "AbortedError";
  }
}
