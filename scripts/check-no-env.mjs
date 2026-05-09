import { execSync } from "node:child_process";

const output = execSync("git diff --cached --name-only", { encoding: "utf8" }).trim();
const stagedFiles = output ? output.split(/\r?\n/) : [];
const blockedFiles = stagedFiles.filter((file) => {
  const normalized = file.replace(/\\/g, "/");
  return /(^|\/)\.env($|\.)/.test(normalized) && !/(^|\/)\.env(\..*)?\.example$/.test(normalized);
});

if (blockedFiles.length > 0) {
  console.error(`Refusing to commit environment files:\n${blockedFiles.join("\n")}`);
  process.exit(1);
}
