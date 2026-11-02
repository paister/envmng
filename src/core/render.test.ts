import { describe, expect, it } from "vite-plus/test";
import { collectPlaceholders, renderTemplate } from "./render";

describe("collectPlaceholders", () => {
  it("returns unique sorted keys", () => {
    expect(collectPlaceholders("A={{B}}\nC={{A}}\nD={{B}}\n")).toEqual(["A", "B"]);
  });
});

describe("renderTemplate", () => {
  it("substitutes placeholders from the values map", () => {
    const values = new Map([["DATABASE_URL", "postgres://local"]]);
    const { text, missing } = renderTemplate("DATABASE_URL={{DATABASE_URL}}\n", values);
    expect(text).toBe("DATABASE_URL=postgres://local\n");
    expect(missing).toEqual([]);
  });

  it("records missing keys and leaves empty values", () => {
    const { text, missing } = renderTemplate("A={{A}}\nB={{B}}\n", new Map([["A", "1"]]));
    expect(text).toBe("A=1\nB=\n");
    expect(missing).toEqual(["B"]);
  });
});
