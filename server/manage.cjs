#!/usr/bin/env node
/* eslint-disable */
/**
 * FusionAL Management Server
 * Run this on your T3610 host: node server/manage.js
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

const LLAMA_BIN   = "/home/jrm_fusional/llama.cpp/build/bin/llama-server";
const LLAMA_MODEL = "/home/jrm_fusional/llama.cpp/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf";
const LLAMA_LOG   = "/home/jrm_fusional/christopher.log";

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
    start: `bash -c 'nohup ${LLAMA_BIN} -m ${LLAMA_MODEL} -ngl 99 -t 4 -c 2048 --host 0.0.0.0 --port 8080 --log-disable &>> ${LLAMA_LOG} &'`,
    stop:  "pkill -f llama-server; sleep 1; pkill -9 -f llama-server; true",
    check: "pgrep -x llama-server",
  },
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, code, body) {
  cors(res);
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

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

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split("/").filter(Boolean);

  // GET /status
  if (req.method === "GET" && parts[0] === "status") {
    const status = {};
    for (const key of Object.keys(SERVICE_COMMANDS)) {
      status[key] = checkRunning(key) ? "running" : "stopped";
    }
    return json(res, 200, status);
  }

  // POST /start/:key or /stop/:key
  if (req.method === "POST" && (parts[0] === "start" || parts[0] === "stop")) {
    const action = parts[0];
    const key    = parts[1];

    if (!key || !SERVICE_COMMANDS[key]) {
      return json(res, 404, { error: `Unknown service: ${key}` });
    }

    const cmd = SERVICE_COMMANDS[key][action];
    if (!cmd) {
      return json(res, 400, { error: `No ${action} command for ${key}` });
    }

    console.log(`[${new Date().toISOString()}] ${action.toUpperCase()} ${key} → ${cmd}`);

    try {
      const out = await run(cmd);
      return json(res, 200, { ok: true, key, action, output: out });
    } catch (e) {
      console.error(`Failed: ${e.stderr || e.err?.message}`);
      return json(res, 500, { ok: false, key, action, error: e.stderr || String(e.err) });
    }
  }

  json(res, 404, { error: "Not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`FusionAL management server running on port ${PORT}`);
  console.log(`Services: ${Object.keys(SERVICE_COMMANDS).join(", ")}`);
  console.log(`Dashboard can reach this at http://<tailscale-ip>:${PORT}`);
});
