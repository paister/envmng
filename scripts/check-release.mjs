import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const errors = [];

if (pkg.private) errors.push("Remove private: true before publishing.");
if (!pkg.description?.trim()) errors.push("Add a package description.");
if (!pkg.license || pkg.license === "UNLICENSED") {
  errors.push("Choose a license and add its SPDX identifier to package.json (license).");
}
const license = new URL("LICENSE", root);
if (!existsSync(license) || !readFileSync(license, "utf8").trim()) {
  errors.push("Add a LICENSE file containing the chosen license and correct copyright attribution.");
}

const isHttpsUrl = value => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};
const repositoryUrl = pkg.repository?.url?.replace(/^git\+/, "");
if (pkg.repository?.type !== "git" || !isHttpsUrl(repositoryUrl)) {
  errors.push("Add the real Git repository URL: repository.type = git and repository.url = git+https://…");
}
if (!isHttpsUrl(pkg.homepage)) errors.push("Add the real project homepage URL (homepage).");
if (!isHttpsUrl(pkg.bugs?.url)) errors.push("Add the real issue tracker URL (bugs.url).");
if (pkg.publishConfig?.registry !== "https://registry.npmjs.org/" || pkg.publishConfig?.access !== "public") {
  errors.push("publishConfig must target the public npm registry with access: public.");
}

if (errors.length) {
  console.error("Release metadata is incomplete:\n" + errors.map(error => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Release metadata checked for ${pkg.name}@${pkg.version}. Review license terms and repository URLs before publishing.`);
}
