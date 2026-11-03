#!/usr/bin/env node
/**
 * FusionAL Management Server
 * Legacy command templates; configure for your host: node server/manage.cjs
 *
 * Exposes:
 *   POST /start/:key   — start a service
 *   POST /stop/:key    — stop a service
 *   GET  /status       — running state of all services
 *
 * Fill in SERVICE_COMMANDS below with your actual shell commands
 * (Docker, PM2, systemd, bare process — whatever you use).
 */

const http = require("http");
const { exec, execSync } = require("child_process");

const PORT = 8099;
const DEFAULT_HOST = "127.0.0.1";
const { createHash, timingSafeEqual } = require("node:crypto");

const LLAMA_BIN   = "/home/jrm-fusional/llama.cpp/build/bin/llama-server";
const LLAMA_MODEL = "/home/jrm-fusional/llama.cpp/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf";
const LLAMA_LOG   = "/home/jrm-fusional/christopher.log";

const SERVICE_COMMANDS = {
  "gateway": {
    start: "docker start fusional-fusional-1",
    stop:  "docker stop fusional-fusional-1",
    check: "docker inspect -f '{{.State.Running}}' fusional-fusional-1",
  },
  "bi-mcp": {
    start: "docker start business-intelligence-mcp",
    stop:  "docker stop business-intelligence-mcp",
    check: "docker inspect -f '{{.State.Running}}' business-intelligence-mcp",
  },
  "api-hub": {
    start: "docker start api-integration-hub",
    stop:  "docker stop api-integration-hub",
    check: "docker inspect -f '{{.State.Running}}' api-integration-hub",
  },
  "content-mcp": {
    start: "docker start content-automation-mcp",
    stop:  "docker stop content-automation-mcp",
    check: "docker inspect -f '{{.State.Running}}' content-automation-mcp",
  },
  "intel-mcp": {
    start: "docker start intelligence-mcp",
    stop:  "docker stop intelligence-mcp",
    check: "docker inspect -f '{{.State.Running}}' intelligence-mcp",
  },
  "christopher-ai": {
    start: `bash -c 'nohup ${LLAMA_BIN} -m ${LLAMA_MODEL} -ngl 99 -t 4 -c 2048 --host 127.0.0.1 --port 8080 --log-disable &>> ${LLAMA_LOG} &'`,
    stop:  "pkill -f llama-server; sleep 1; pkill -9 -f llama-server; true",
    check: "pgrep -x llama-server",
  },
};

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) reject({ err, stderr: stderr.trim() });
      else resolve(stdout.trim());
    });
  });
}

function checkRunning(key) {
  try {
    const cmd = SERVICE_COMMANDS[key]?.check;
    if (!cmd) return false;
    const out = execSync(cmd, { timeout: 3000, encoding: "utf8" }).trim();
    // docker inspect returns "true"/"false"; pgrep returns a pid on success
    return out === "true" || (out.length > 0 && out !== "false");
  } catch {
    return false;
  }
}

function createManagementServer({
  token = process.env.FUSIONAL_MANAGE_TOKEN,
  allowedOrigins = (process.env.FUSIONAL_MANAGE_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173").split(",").filter(Boolean),
  commands = SERVICE_COMMANDS,
  execute = run,
  check = checkRunning,
} = {}) {
  if (typeof token !== "string" || token.trim().length < 32 || token !== token.trim()) {
    throw new Error("Set a unique FUSIONAL_MANAGE_TOKEN of at least 32 characters");
  }
  for (const origin of allowedOrigins) {
    const parsed = new URL(origin);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error("Management origins must be explicit HTTP(S) origins, never wildcards");
    }
  }
  const expected = createHash("sha256").update(`Bearer ${token}`).digest();
  return http.createServer(async (req, res) => {
    const respond = (code, body) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) return respond(403, { error: "Origin denied" });
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    const supplied = createHash("sha256").update(req.headers.authorization || "").digest();
    if (!timingSafeEqual(expected, supplied)) return respond(401, { error: "Unauthorized" });
    let parts;
    try { parts = new URL(req.url, "http://127.0.0.1").pathname.split("/").filter(Boolean); }
    catch { return respond(400, { error: "Invalid URL" }); }
    if (req.method === "GET" && parts.length === 1 && parts[0] === "status") {
      return respond(200, Object.fromEntries(Object.keys(commands).map(key => [key, check(key) ? "running" : "stopped"])));
    }
    if (req.method === "POST" && parts.length === 2 && ["start", "stop"].includes(parts[0])) {
      const [action, key] = parts;
      if (!Object.hasOwn(commands, key)) return respond(404, { error: "Unknown service" });
      const cmd = commands[key][action];
      if (typeof cmd !== "string") return respond(400, { error: "Command not configured" });
      try {
        const output = await execute(cmd);
        return respond(200, { ok: true, key, action, output });
      } catch (error) {
        return respond(500, { ok: false, key, action, error: error.stderr || "Command failed" });
      }
    }
    return respond(404, { error: "Not found" });
  });
}

module.exports = { createManagementServer, DEFAULT_HOST };
if (require.main === module) {
  const server = createManagementServer();
  const host = process.env.FUSIONAL_MANAGE_HOST || DEFAULT_HOST;
  const port = Number(process.env.FUSIONAL_MANAGE_PORT || PORT);
  server.listen(port, host, () => console.log(`Management listener: ${host}:${port}`));
}
