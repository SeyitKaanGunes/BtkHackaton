#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const env = { ...process.env };
const isWindows = process.platform === "win32";

for (const file of [".env", "apps/api/.env", "apps/web/.env"]) {
  loadEnvFile(path.join(root, file), env);
}

env.NEXT_PUBLIC_API_URL ||= "http://localhost:4000";
env.EXPO_PUBLIC_API_URL ||= env.NEXT_PUBLIC_API_URL;

const children = [
  start("api", ["run", "dev:api"]),
  start("web", ["run", "dev:web"])
];

let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shuttingDown = true;
    for (const child of children) child.kill(signal);
  });
}

function start(name, args) {
  const command = isWindows ? "cmd.exe" : "npm";
  const commandArgs = isWindows ? ["/d", "/s", "/c", ["npm", ...args].join(" ")] : args;
  const child = spawn(command, commandArgs, {
    cwd: root,
    env,
    stdio: ["inherit", "pipe", "pipe"]
  });

  pipeWithPrefix(name, child.stdout, process.stdout);
  pipeWithPrefix(name, child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (code === 0 || signal) return;
    shuttingDown = true;
    for (const other of children) {
      if (other !== child) other.kill();
    }
    process.exitCode = code ?? 1;
  });

  return child;
}

function pipeWithPrefix(name, source, target) {
  let buffer = "";
  source.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      target.write(`[${name}] ${line}\n`);
    }
  });
  source.on("end", () => {
    if (buffer) target.write(`[${name}] ${buffer}\n`);
  });
}

function loadEnvFile(filePath, target) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    target[key] = unquote(rawValue);
  }
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
