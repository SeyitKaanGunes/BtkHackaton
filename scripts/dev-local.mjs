#!/usr/bin/env node
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { existsSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const env = { ...process.env };
const isWindows = process.platform === "win32";
const cleanExisting = !process.argv.includes("--no-clean");
const ports = { api: 4000, web: 3000 };

for (const file of [".env", "apps/api/.env", "apps/web/.env"]) {
  loadEnvFile(path.join(root, file), env);
}

env.NEXT_PUBLIC_API_URL ||= "http://localhost:4000";
env.EXPO_PUBLIC_API_URL ||= env.NEXT_PUBLIC_API_URL;
preferDirectDatabaseUrlForLocalDev(env);

if (cleanExisting) {
  await stopExistingDevProcesses();
  await waitForClosedPorts(Object.values(ports), 15_000);
  clearDevBuildCaches();
}

const children = [
  start("api", ["run", "dev:api"]),
  start("web", ["run", "dev:web"])
];

let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(signal));
}

void waitForReadiness();

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
      if (other !== child) killTree(other.pid);
    }
    process.exitCode = code ?? 1;
  });

  return child;
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) killTree(child.pid, signal);
}

async function waitForReadiness() {
  const checks = [
    waitForHttp("api", `http://localhost:${ports.api}/ready`, [200], 120_000),
    waitForHttp("web", `http://localhost:${ports.web}/login`, [200], 120_000)
  ];
  const results = await Promise.allSettled(checks);
  for (const result of results) {
    if (result.status === "rejected") {
      process.stderr.write(`[dev] ${result.reason instanceof Error ? result.reason.message : String(result.reason)}\n`);
    }
  }
}

async function waitForHttp(name, url, acceptedStatuses, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (acceptedStatuses.includes(response.status)) {
        process.stdout.write(`[dev] ${name} ready: ${name === "api" ? `http://localhost:${ports.api}` : `http://localhost:${ports.web}`}\n`);
        return;
      }
    } catch {
      // Server is still booting.
    }
    await sleep(1_000);
  }
  throw new Error(`${name} did not become ready within ${Math.round(timeoutMs / 1000)}s.`);
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

function preferDirectDatabaseUrlForLocalDev(target) {
  if (target.FINTWIN_DEV_DATABASE_URL_MODE === "pooler") return;
  if (!target.DIRECT_URL || !target.DATABASE_URL) return;
  if (!/pooler\.supabase\.com/i.test(target.DATABASE_URL)) return;
  target.DATABASE_URL = target.DIRECT_URL;
  process.stdout.write("[dev] DATABASE_URL uses Supabase pooler; local dev is using DIRECT_URL. Set FINTWIN_DEV_DATABASE_URL_MODE=pooler to force the pooler.\n");
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function clearDevBuildCaches() {
  const targets = [path.join(root, "apps", "web", ".next", "dev")];
  for (const target of targets) {
    const resolved = path.resolve(target);
    if (!isInsideRoot(resolved)) {
      throw new Error(`Refusing to delete dev cache outside repo: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  }
}

function isInsideRoot(target) {
  const relative = path.relative(root, target);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function stopExistingDevProcesses() {
  if (isWindows) {
    const script = `
$ErrorActionPreference = "SilentlyContinue"
$root = '${escapePowerShellSingleQuoted(root)}'
$current = ${process.pid}
$self = $PID
$patterns = @(
  "*$root*dev:api*",
  "*$root*dev:web*",
  "*$root*start:dev*",
  "*$root*tsx*watch*src/main.ts*",
  "*$root*--require*tsx*src/main.ts*",
  "*$root*next*dev*--port 3000*",
  "*$root*next*dist*server*start-server.js*"
)
$ids = New-Object System.Collections.Generic.HashSet[int]
$processes = @()
foreach ($candidate in Get-CimInstance Win32_Process) {
  if ($candidate.ProcessId -eq $current -or $candidate.ProcessId -eq $self) { continue }
  $matched = $false
  foreach ($pattern in $patterns) {
    if ($candidate.CommandLine -like $pattern) {
      $matched = $true
      break
    }
  }
  if ($matched) { $processes += $candidate }
}
foreach ($process in $processes) { [void]$ids.Add([int]$process.ProcessId) }
$listeners = Get-NetTCPConnection -LocalPort ${ports.api},${ports.web} -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
  if ($process -and $process.ProcessId -ne $current -and $process.CommandLine -like "*$root*") {
    [void]$ids.Add([int]$process.ProcessId)
  } elseif ($process -and $process.CommandLine -notlike "*$root*") {
    Write-Error "Port $($listener.LocalPort) is already used by PID $($process.ProcessId): $($process.CommandLine)"
    exit 1
  }
}
foreach ($id in $ids) {
  & taskkill.exe /PID $id /T /F *> $null
}
exit 0
`;
    await runCommand("powershell.exe", ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script]);
    return;
  }

  const listeners = await listenersOnPorts(Object.values(ports));
  for (const listener of listeners) killTree(listener.pid, "SIGTERM");
}

async function waitForClosedPorts(portList, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const checks = await Promise.all(portList.map((port) => isPortOpen(port)));
    if (checks.every((open) => !open)) return;
    await sleep(500);
  }
  throw new Error(`Ports did not close in time: ${portList.join(", ")}`);
}

function killTree(pid, signal = "SIGTERM") {
  if (!pid || pid === process.pid) return;
  if (isWindows) {
    spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // Process already exited.
    }
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1_000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function listenersOnPorts() {
  return [];
}

function escapePowerShellSingleQuoted(value) {
  return value.replaceAll("'", "''");
}
