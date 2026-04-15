#!/usr/bin/env node
import net from "node:net";
import { spawn } from "node:child_process";

const BASE_PORT = 1420;
const MAX_TRIES = 50;

function checkHost(port, host) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", () => resolve(false));
    srv.listen({ port, host }, () => {
      srv.close(() => resolve(true));
    });
  });
}

async function check(port) {
  for (const host of ["0.0.0.0", "::", "127.0.0.1", "::1"]) {
    if (!(await checkHost(port, host))) return false;
  }
  return true;
}

async function findPort() {
  for (let i = 0; i < MAX_TRIES; i++) {
    const p = BASE_PORT + i;
    if (await check(p)) return p;
  }
  throw new Error(`No free port in ${BASE_PORT}..${BASE_PORT + MAX_TRIES - 1}`);
}

const port = await findPort();
console.log(`[dev] using port ${port}`);

const env = { ...process.env, HONE_DEV_PORT: String(port) };
const configOverride = JSON.stringify({
  build: { devUrl: `http://localhost:${port}` },
});

const child = spawn(
  "npx",
  ["tauri", "dev", "--config", configOverride, ...process.argv.slice(2)],
  { stdio: "inherit", env },
);
child.on("exit", (code) => process.exit(code ?? 0));
