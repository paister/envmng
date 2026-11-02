const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

export type RenderResult = {
  text: string;
  missing: string[];
};

/** Unique `{{KEY}}` names referenced in a template, sorted. */
export const collectPlaceholders = (template: string): string[] => {
  const keys = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER)) {
    const key = match[1];
    if (key) keys.add(key);
  }
  return [...keys].sort();
};

/**
 * Replace `{{KEY}}` placeholders with values from the central env map.
 * Missing keys become empty string and are listed in `missing`.
 */
export const renderTemplate = (template: string, values: Map<string, string>): RenderResult => {
  const missing = new Set<string>();
  const text = template.replace(PLACEHOLDER, (_match, key: string) => {
    if (!values.has(key)) {
      missing.add(key);
      return "";
    }
    return values.get(key)!;
  });
  return { text, missing: [...missing].sort() };
};
