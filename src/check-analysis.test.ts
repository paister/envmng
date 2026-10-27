import { describe, expect, it } from "vite-plus/test";
import {
  analyzeProfile,
  isCheckPassing,
  isEmptyEnvValue,
  type ProfileSnapshot,
} from "./check-analysis";

const baseSnap = (overrides: Partial<ProfileSnapshot> = {}): ProfileSnapshot => ({
  name: "local",
  profileFile: ".local.env",
  centralText: "FOO=bar\nBAZ=\n",
  rootExampleText: "FOO=\nBAZ=\n",
  apps: [
    {
      relPath: "apps/api",
      exampleText: "FOO={{FOO}}\n",
      templateText: "FOO={{FOO}}\n",
    },
  ],
  ...overrides,
});

describe("isEmptyEnvValue", () => {
  it("detects blank and empty quotes", () => {
    expect(isEmptyEnvValue("")).toBe(true);
    expect(isEmptyEnvValue("  ")).toBe(true);
    expect(isEmptyEnvValue('""')).toBe(true);
    expect(isEmptyEnvValue("''")).toBe(true);
    expect(isEmptyEnvValue("x")).toBe(false);
  });

  it.each([" # TODO", "#TODO", '"" # TODO', "'' # TODO", "`` # TODO"])(
    "detects empty values with inline comments: %s",
    raw => {
      expect(isEmptyEnvValue(raw)).toBe(true);
    }
  );

  it.each(['"#"', "'#'", "`#`", '"  "', "'  '", '"#" # TODO', "value # TODO"])(
    "preserves nonempty dotenv values: %s",
    raw => {
      expect(isEmptyEnvValue(raw)).toBe(false);
    }
  );
});

describe("analyzeProfile", () => {
  it("passes a complete profile", () => {
    const report = analyzeProfile(
      baseSnap({
        centralText: "FOO=bar\n",
        rootExampleText: "FOO=\n",
      })
    );
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(isCheckPassing(report, false)).toBe(true);
  });

  it.each([" # TODO", '"" # TODO', "'' # TODO"])(
    "fails strict checks for referenced empty values with inline comments: %s",
    raw => {
      const report = analyzeProfile(
        baseSnap({ centralText: `FOO=${raw}\n`, rootExampleText: "FOO=\n" })
      );
      expect(report.issues).toEqual([
        expect.objectContaining({
          severity: "warning",
          code: "empty_value",
          key: "FOO",
          refs: ["apps/api/.local.env"],
        }),
      ]);
      expect(report.errorCount).toBe(0);
      expect(report.warningCount).toBe(1);
      expect(isCheckPassing(report, false)).toBe(true);
      expect(isCheckPassing(report, true)).toBe(false);
    }
  );

  it.each(['"#" # TODO', "'#' # TODO", '"  " # TODO'])(
    "passes strict checks for referenced nonempty quoted values: %s",
    raw => {
      const report = analyzeProfile(
        baseSnap({ centralText: `FOO=${raw}\n`, rootExampleText: "FOO=\n" })
      );
      expect(report.issues).toEqual([]);
      expect(isCheckPassing(report, true)).toBe(true);
    }
  );

  it("errors on missing central and unresolved placeholders", () => {
    const report = analyzeProfile(
      baseSnap({
        centralText: null,
        apps: [
          {
            relPath: "apps/api",
            exampleText: "FOO={{FOO}}\n",
            templateText: "FOO={{FOO}}\nMISSING={{MISSING}}\n",
          },
        ],
      })
    );
    expect(report.issues.map(i => i.code)).toContain("missing_central");
    expect(report.errorCount).toBeGreaterThan(0);
  });

  it("errors on missing app template when example exists", () => {
    const report = analyzeProfile(
      baseSnap({
        apps: [
          {
            relPath: "apps/web",
            exampleText: "FOO={{FOO}}\n",
            templateText: null,
          },
        ],
      })
    );
    expect(report.issues.some(i => i.code === "missing_app_template")).toBe(true);
  });

  it("warns on empty referenced values and key drift", () => {
    const report = analyzeProfile(
      baseSnap({
        centralText: "FOO=\n",
        rootExampleText: "FOO=\nEXTRA=\n",
        apps: [
          {
            relPath: "apps/api",
            exampleText: "FOO={{FOO}}\nNEW={{NEW}}\n",
            templateText: "FOO={{FOO}}\n",
          },
          {
            relPath: "apps/web",
            exampleText: "FOO={{FOO}}\n",
            templateText: "FOO={{FOO}}\n",
          },
        ],
      })
    );
    const codes = report.issues.map(i => i.code);
    expect(codes).toContain("empty_value");
    expect(codes.filter(c => c === "empty_value")).toHaveLength(1);
    expect(codes).toContain("drift_central_key");
    expect(codes).toContain("drift_app_key");
    expect(report.errorCount).toBe(0);
    expect(isCheckPassing(report, false)).toBe(true);
    expect(isCheckPassing(report, true)).toBe(false);
  });

  it("errors when placeholder key is absent from central", () => {
    const report = analyzeProfile(
      baseSnap({
        centralText: "OTHER=1\n",
        rootExampleText: "OTHER=\n",
        apps: [
          {
            relPath: "apps/api",
            exampleText: "FOO={{FOO}}\n",
            templateText: "FOO={{FOO}}\n",
          },
        ],
      })
    );
    expect(report.issues.some(i => i.code === "unresolved_placeholder" && i.key === "FOO")).toBe(
      true
    );
  });
});
