import { describe, expect, it } from "vite-plus/test";
import { assertEnvName, namedEnvFile, profileNameFromFilename } from "./names";

describe("namedEnvFile", () => {
  it("builds .<name>.env", () => {
    expect(namedEnvFile("local")).toBe(".local.env");
    expect(namedEnvFile("prod")).toBe(".prod.env");
  });
});

describe("profileNameFromFilename", () => {
  it("parses profile filenames", () => {
    expect(profileNameFromFilename(".local.env")).toBe("local");
    expect(profileNameFromFilename(".staging-1.env")).toBe("staging-1");
    expect(profileNameFromFilename(".env.example")).toBeNull();
    expect(profileNameFromFilename(".env")).toBeNull();
    expect(profileNameFromFilename("local.env")).toBeNull();
  });
});

describe("assertEnvName", () => {
  it("accepts lowercase slugs", () => {
    expect(() => assertEnvName("local")).not.toThrow();
    expect(() => assertEnvName("prev")).not.toThrow();
    expect(() => assertEnvName("staging-1")).not.toThrow();
  });

  it("rejects reserved and invalid names", () => {
    expect(() => assertEnvName("example")).toThrow(/Reserved/);
    expect(() => assertEnvName("Local")).toThrow(/Invalid/);
    expect(() => assertEnvName("1local")).toThrow(/Invalid/);
  });
});
