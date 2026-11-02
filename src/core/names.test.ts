import { describe, expect, it } from "vite-plus/test";
import { assertEnvName, namedEnvFile, profileNameFromFilename } from "./names";

describe("namedEnvFile", () => {
  it("builds .envmng.<name>", () => {
    expect(namedEnvFile("local")).toBe(".envmng.local");
    expect(namedEnvFile("prod")).toBe(".envmng.prod");
  });
});

describe("profileNameFromFilename", () => {
  it("parses profile filenames", () => {
    expect(profileNameFromFilename(".envmng.local")).toBe("local");
    expect(profileNameFromFilename(".envmng.staging-1")).toBe("staging-1");
    expect(profileNameFromFilename(".env.example")).toBeNull();
    expect(profileNameFromFilename(".env")).toBeNull();
    expect(profileNameFromFilename(".envmng")).toBeNull();
    expect(profileNameFromFilename(".env.local")).toBeNull();
    expect(profileNameFromFilename(".local.env")).toBeNull();
    expect(profileNameFromFilename("envmng.local")).toBeNull();
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
