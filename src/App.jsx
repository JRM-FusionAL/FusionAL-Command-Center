import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";

// ─── REAL SERVICE ENDPOINTS ────────────────────────────────────────────────
const SERVICES = [
  { key: "gateway",       name: "FusionAL Gateway",          subdomain: "gateway.fusional.dev", port: 8089, healthPath: "/health" },
  { key: "bi-mcp",        name: "Business Intelligence MCP",  subdomain: "bi.fusional.dev",      port: 8101, healthPath: "/health" },
  { key: "api-hub",       name: "API Integration Hub",        subdomain: "api.fusional.dev",      port: 8102, healthPath: "/health" },
  { key: "content-mcp",   name: "Content Automation MCP",     subdomain: "content.fusional.dev",  port: 8103, healthPath: "/health" },
  { key: "intel-mcp",     name: "Intelligence MCP",           subdomain: "intel.fusional.dev",    port: 8104, healthPath: "/health" },
  { key: "christopher-ai", name: "Christopher-AI (llama.cpp)", subdomain: "100.65.9.40:8080",     port: 8080, healthPath: "/health",
    url: "http://100.65.9.40:8080/health" },
];

// Christopher-AI llama.cpp runs on T3610 — configurable endpoint
const DEFAULT_CHRISTOPHER_ENDPOINT = "http://100.65.9.40:8080";

// ─── STYLES ────────────────────────────────────────────────────────────────
const COLORS = {
  bg:       "#0a0d14",
  surface:  "#111827",
  border:   "#1f2937",
  accent:   "#00d4ff",
  accent2:  "#7c3aed",
  green:    "#22c55e",
  yellow:   "#eab308",
  red:      "#ef4444",
  muted:    "#6b7280",
  text:     "#f9fafb",
  subtext:  "#9ca3af",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body, #root {
    background: ${COLORS.bg};
    color: ${COLORS.text};
    font-family: 'Space Grotesk', sans-serif;
    min-height: 100vh;
  }

  .cmd { font-family: 'JetBrains Mono', monospace; }

  .cc-root {
    min-height: 100vh;
    background: ${COLORS.bg};
    background-image:
      radial-gradient(ellipse at 20% 0%, rgba(0,212,255,0.04) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 100%, rgba(124,58,237,0.05) 0%, transparent 60%);
    padding: 24px;
  }

  .cc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
    padding-bottom: 20px;
    border-bottom: 1px solid ${COLORS.border};
  }

  .cc-header-left { display: flex; align-items: center; gap: 14px; }

  .logo-mark {
    width: 44px; height: 44px;
    background: linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2});
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    font-size: 16px;
    color: #fff;
    flex-shrink: 0;
  }

  .cc-title { font-size: 22px; font-weight: 700; color: ${COLORS.text}; }
  .cc-subtitle { font-size: 12px; color: ${COLORS.muted}; margin-top: 2px; }

  .live-badge {
    display: flex; align-items: center; gap: 6px;
    background: ${COLORS.surface};
    border: 1px solid ${COLORS.border};
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    color: ${COLORS.text};
    font-family: 'JetBrains Mono', monospace;
  }

  .pulse-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: ${COLORS.green};
    animation: pulse-anim 2s ease-in-out infinite;
  }

  @keyframes pulse-anim {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  /* Overview cards */
  .overview-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 20px;
  }

  .ov-card {
    background: ${COLORS.surface};
    border: 1px solid ${COLORS.border};
    border-radius: 10px;
    padding: 16px 18px;
    position: relative;
    overflow: hidden;
  }

  .ov-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: var(--card-accent, ${COLORS.accent});
    opacity: 0.7;
  }

  .ov-label { font-size: 11px; color: ${COLORS.muted}; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  .ov-value { font-size: 28px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
  .ov-sub { font-size: 11px; color: ${COLORS.muted}; margin-top: 4px; }

  /* Two-col chart + alerts */
  .two-col { display: grid; grid-template-columns: 1fr 320px; gap: 14px; margin-bottom: 20px; }

  .panel {
    background: ${COLORS.surface};
    border: 1px solid ${COLORS.border};
    border-radius: 10px;
    padding: 18px;
  }

  .panel-title {
    font-size: 13px;
    font-weight: 600;
    color: ${COLORS.subtext};
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 14px;
  }

  /* Server cards */
  .servers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 14px;
    margin-bottom: 20px;
  }

  .srv-card {
    background: ${COLORS.surface};
    border: 1px solid ${COLORS.border};
    border-radius: 10px;
    padding: 16px;
    transition: border-color 0.2s;
  }

  .srv-card:hover { border-color: rgba(0,212,255,0.3); }

  .srv-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
  .srv-name { font-size: 13px; font-weight: 600; color: ${COLORS.text}; }
  .srv-url { font-size: 10px; color: ${COLORS.muted}; font-family: 'JetBrains Mono', monospace; margin-top: 2px; }

  .status-pill {
    font-size: 10px;
    font-family: 'JetBrains Mono', monospace;
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .status-online  { background: rgba(34,197,94,0.12);  color: ${COLORS.green};  border: 1px solid rgba(34,197,94,0.3); }
  .status-offline { background: rgba(239,68,68,0.12);  color: ${COLORS.red};    border: 1px solid rgba(239,68,68,0.3); }
  .status-warning { background: rgba(234,179,8,0.12);  color: ${COLORS.yellow}; border: 1px solid rgba(234,179,8,0.3); }
  .status-checking{ background: rgba(107,114,128,0.12);color: ${COLORS.muted};  border: 1px solid rgba(107,114,128,0.3); }

  .srv-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .srv-stat { }
  .srv-stat-label { font-size: 10px; color: ${COLORS.muted}; }
  .srv-stat-value { font-size: 14px; font-weight: 600; font-family: 'JetBrains Mono', monospace; margin-top: 1px; }

  .bar-bg { height: 3px; background: ${COLORS.border}; border-radius: 2px; margin-top: 4px; }
  .bar-fill { height: 100%; border-radius: 2px; transition: width 0.5s; }

  /* Alerts */
  .alert-list { display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto; }
  .alert-item { display: flex; gap: 10px; align-items: flex-start; }
  .alert-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
  .alert-msg { font-size: 12px; color: ${COLORS.subtext}; line-height: 1.4; }
  .alert-meta { font-size: 10px; color: ${COLORS.muted}; font-family: 'JetBrains Mono', monospace; margin-top: 2px; }

  /* Christopher-AI */
  .christopher-panel {
    background: ${COLORS.surface};
    border: 1px solid rgba(124,58,237,0.4);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 20px;
  }

  .christopher-header {
    background: linear-gradient(135deg, rgba(124,58,237,0.15), rgba(0,212,255,0.05));
    border-bottom: 1px solid rgba(124,58,237,0.3);
    padding: 14px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .christopher-title-row { display: flex; align-items: center; gap: 10px; }
  .christopher-icon {
    width: 32px; height: 32px;
    background: linear-gradient(135deg, ${COLORS.accent2}, ${COLORS.accent});
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px;
  }

  .christopher-name { font-size: 14px; font-weight: 700; }
  .christopher-sub { font-size: 11px; color: ${COLORS.muted}; font-family: 'JetBrains Mono', monospace; }

  .christopher-body { display: flex; height: 380px; }

  .christopher-chat {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-right: 1px solid ${COLORS.border};
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .chat-msg { max-width: 85%; }
  .chat-msg.user { align-self: flex-end; }
  .chat-msg.assistant { align-self: flex-start; }

  .chat-bubble {
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.5;
  }

  .chat-msg.user .chat-bubble {
    background: rgba(0,212,255,0.12);
    border: 1px solid rgba(0,212,255,0.25);
    color: ${COLORS.text};
  }

  .chat-msg.assistant .chat-bubble {
    background: rgba(124,58,237,0.1);
    border: 1px solid rgba(124,58,237,0.25);
    color: ${COLORS.text};
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
  }

  .chat-sender { font-size: 10px; color: ${COLORS.muted}; margin-bottom: 3px; font-family: 'JetBrains Mono', monospace; }
  .chat-msg.user .chat-sender { text-align: right; }

  .chat-input-row {
    padding: 12px;
    border-top: 1px solid ${COLORS.border};
    display: flex;
    gap: 8px;
  }

  .chat-input {
    flex: 1;
    background: ${COLORS.bg};
    border: 1px solid ${COLORS.border};
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
    color: ${COLORS.text};
    font-family: 'Space Grotesk', sans-serif;
    outline: none;
    transition: border-color 0.2s;
  }

  .chat-input:focus { border-color: rgba(124,58,237,0.5); }
  .chat-input::placeholder { color: ${COLORS.muted}; }

  .chat-send-btn {
    background: linear-gradient(135deg, ${COLORS.accent2}, ${COLORS.accent});
    border: none;
    border-radius: 6px;
    padding: 0 16px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
    font-family: 'Space Grotesk', sans-serif;
  }

  .chat-send-btn:hover { opacity: 0.85; }
  .chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .christopher-config {
    width: 240px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
  }

  .config-label { font-size: 10px; color: ${COLORS.muted}; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }

  .config-input {
    width: 100%;
    background: ${COLORS.bg};
    border: 1px solid ${COLORS.border};
    border-radius: 6px;
    padding: 7px 10px;
    font-size: 11px;
    color: ${COLORS.text};
    font-family: 'JetBrains Mono', monospace;
    outline: none;
    transition: border-color 0.2s;
  }

  .config-input:focus { border-color: rgba(0,212,255,0.4); }

  .config-row { display: flex; flex-direction: column; }

  .chris-status-row {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 10px;
    background: ${COLORS.bg};
    border-radius: 6px;
    border: 1px solid ${COLORS.border};
  }

  .chris-status-text { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: ${COLORS.subtext}; }

  .config-divider { border: none; border-top: 1px solid ${COLORS.border}; }

  .config-section-title { font-size: 11px; font-weight: 600; color: ${COLORS.subtext}; }

  .model-info { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: ${COLORS.muted}; line-height: 1.6; }

  .test-btn {
    width: 100%;
    background: transparent;
    border: 1px solid rgba(0,212,255,0.3);
    border-radius: 6px;
    padding: 7px;
    color: ${COLORS.accent};
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    cursor: pointer;
    transition: all 0.2s;
  }

  .test-btn:hover {
    background: rgba(0,212,255,0.08);
    border-color: rgba(0,212,255,0.6);
  }

  /* Thinking animation */
  .thinking-dots span {
    animation: blink 1.2s ease-in-out infinite;
    opacity: 0;
  }
  .thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
  .thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink { 0%,80%,100%{opacity:0} 40%{opacity:1} }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 2px; }

  /* Responsive collapse */
  @media (max-width: 900px) {
    .overview-grid { grid-template-columns: repeat(2, 1fr); }
    .two-col { grid-template-columns: 1fr; }
    .christopher-body { flex-direction: column; height: auto; }
    .christopher-config { width: 100%; border-right: none; border-top: 1px solid ${COLORS.border}; }
  }
`;

// ─── SYSTEM OVERVIEW ───────────────────────────────────────────────────────
function SystemOverview({ servers }) {
  const total     = servers.length;
  const online    = servers.filter(s => s.status === "online").length;
  const offline   = servers.filter(s => s.status === "offline").length;
  const checking  = servers.filter(s => s.status === "checking").length;
  const latencies = servers.map(s => s.latency).filter(Boolean);
  const avgLat    = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;

  const cards = [
    { label: "Total Services",    value: total,                             sub: "registered",     accent: COLORS.accent,   color: COLORS.accent },
    { label: "Online",            value: checking > 0 ? "…" : online,       sub: `${offline} offline`, accent: COLORS.green,    color: COLORS.green },
    { label: "Avg Latency",       value: avgLat ? `${avgLat}ms` : "—",      sub: "response time",  accent: COLORS.yellow,   color: COLORS.yellow },
    { label: "Health Checks",     value: checking > 0 ? "Polling…" : "Live", sub: "3s interval",   accent: COLORS.accent2,  color: COLORS.accent2 },
  ];

  return (
    <div className="overview-grid">
      {cards.map(c => (
        <div className="ov-card" key={c.label} style={{ "--card-accent": c.accent }}>
          <div className="ov-label">{c.label}</div>
          <div className="ov-value" style={{ color: c.color }}>{c.value}</div>
          <div className="ov-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── SERVER CARD ──────────────────────────────────────────────────────────
function ServerCard({ name, subdomain, port, status, latency, code }) {
  const statusClass = {
    online: "status-online", offline: "status-offline",
    warning: "status-warning", checking: "status-checking",
  }[status] || "status-checking";

  const latencyColor = !latency ? COLORS.muted
    : latency < 100 ? COLORS.green
    : latency < 300 ? COLORS.yellow
    : COLORS.red;

  return (
    <div className="srv-card">
      <div className="srv-header">
        <div>
          <div className="srv-name">{name}</div>
          <div className="srv-url cmd">{subdomain}</div>
        </div>
        <span className={`status-pill ${statusClass}`}>{status}</span>
      </div>
      <div className="srv-stats">
        <div className="srv-stat">
          <div className="srv-stat-label">Latency</div>
          <div className="srv-stat-value" style={{ color: latencyColor }}>
            {latency ? `${latency}ms` : "—"}
          </div>
        </div>
        <div className="srv-stat">
          <div className="srv-stat-label">HTTP Code</div>
          <div className="srv-stat-value" style={{ color: code === 200 ? COLORS.green : COLORS.muted }}>
            {code ?? "—"}
          </div>
        </div>
        <div className="srv-stat">
          <div className="srv-stat-label">Port</div>
          <div className="srv-stat-value cmd">{port}</div>
        </div>
        <div className="srv-stat">
          <div className="srv-stat-label">Endpoint</div>
          <div className="srv-stat-value" style={{ fontSize: 10, color: COLORS.muted }}>
            /health
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── METRICS CHART ────────────────────────────────────────────────────────
function MetricsChart({ data }) {
  return (
    <div className="panel" style={{ height: 280 }}>
      <div className="panel-title">System Metrics — Derived from Health Poll Latency</div>
      <ResponsiveContainer width="100%" height={210}>
        <LineChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
          <XAxis dataKey="time" tick={{ fill: COLORS.muted, fontSize: 10, fontFamily: "JetBrains Mono" }} />
          <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 11 }}
            labelStyle={{ color: COLORS.subtext }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="avgLatency" name="Avg Latency (ms)" stroke={COLORS.accent} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="online" name="Online" stroke={COLORS.green} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── ALERTS FEED ──────────────────────────────────────────────────────────
function AlertsFeed({ alerts }) {
  const colors = { error: COLORS.red, warning: COLORS.yellow, info: COLORS.accent, success: COLORS.green };

  return (
    <div className="panel" style={{ height: 280, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div className="panel-title">Event Log</div>
      <div className="alert-list">
        {alerts.map(a => (
          <div className="alert-item" key={a.id}>
            <div className="alert-dot" style={{ background: colors[a.type] }} />
            <div>
              <div className="alert-msg">{a.message}</div>
              <div className="alert-meta">{a.timestamp}{a.server ? ` · ${a.server}` : ""}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CHRISTOPHER-AI ───────────────────────────────────────────────────────
function ChristopherAI() {
  const [endpoint, setEndpoint] = useState(DEFAULT_CHRISTOPHER_ENDPOINT);
  const [sysPrompt, setSysPrompt] = useState(
    "You are Christopher, an intelligent assistant running locally on a JRM FusionAL server. Be concise, direct, and helpful."
  );
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Christopher online. I'm running llama.cpp on the T3610. What do you need?" }
  ]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [connStatus, setConnStatus] = useState("unknown"); // "online" | "offline" | "unknown"
  const [modelInfo, setModelInfo]   = useState(null);
  const messagesEndRef = useRef(null);

  const scroll = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scroll, [messages]);

  const checkConnection = useCallback(async () => {
    setConnStatus("checking");
    try {
      const res = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setConnStatus("online");
        setModelInfo(data);
      } else {
        setConnStatus("offline");
      }
    } catch {
      setConnStatus("offline");
    }
  }, [endpoint]);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  const buildPrompt = (msgs, sys) => {
    let prompt = sys ? `### System\n${sys}\n\n` : "";
    msgs.forEach(m => {
      prompt += m.role === "user"
        ? `### User\n${m.content}\n\n`
        : `### Assistant\n${m.content}\n\n`;
    });
    prompt += "### Assistant\n";
    return prompt;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${endpoint}/completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: buildPrompt(newMsgs, sysPrompt),
          n_predict: 512,
          temperature: 0.7,
          stop: ["### User", "### System", "</s>"],
          stream: false,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply = data.content?.trim() || "[empty response]";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      setConnStatus("online");
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `[Connection error: ${e.message}]\n\nCheck that llama.cpp server is running at ${endpoint}\n\nStart it with:\n./server -m /path/to/model.gguf --host 0.0.0.0 --port 8080`
      }]);
      setConnStatus("offline");
    } finally {
      setLoading(false);
    }
  };

  const statusColor = { online: COLORS.green, offline: COLORS.red, checking: COLORS.yellow, unknown: COLORS.muted }[connStatus];
  const statusLabel = { online: "Connected", offline: "Unreachable", checking: "Checking…", unknown: "Unknown" }[connStatus];

  return (
    <div className="christopher-panel">
      <div className="christopher-header">
        <div className="christopher-title-row">
          <div className="christopher-icon">🧠</div>
          <div>
            <div className="christopher-name">Christopher-AI</div>
            <div className="christopher-sub cmd">whisper.cpp · llama.cpp CUDA · Piper TTS · T3610</div>
          </div>
        </div>
        <div className="chris-status-row">
          <div className="alert-dot" style={{ background: statusColor }} />
          <span className="chris-status-text">{statusLabel}</span>
        </div>
      </div>

      <div className="christopher-body">
        {/* Chat */}
        <div className="christopher-chat">
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                <div className="chat-sender">{m.role === "user" ? "you" : "christopher"}</div>
                <div className="chat-bubble" style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="chat-msg assistant">
                <div className="chat-sender">christopher</div>
                <div className="chat-bubble">
                  <span className="thinking-dots">
                    <span>●</span><span>●</span><span>●</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-row">
            <input
              className="chat-input"
              placeholder="Talk to Christopher…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              disabled={loading}
            />
            <button className="chat-send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
              {loading ? "…" : "Send"}
            </button>
          </div>
        </div>

        {/* Config sidebar */}
        <div className="christopher-config">
          <div className="config-section-title">Connection</div>

          <div className="config-row">
            <div className="config-label">llama.cpp Endpoint</div>
            <input
              className="config-input"
              value={endpoint}
              onChange={e => setEndpoint(e.target.value)}
              placeholder="http://100.65.9.40:8080"
            />
          </div>

          <button className="test-btn" onClick={checkConnection}>
            Test Connection
          </button>

          <hr className="config-divider" />

          <div className="config-section-title">System Prompt</div>
          <div className="config-row">
            <textarea
              className="config-input"
              rows={4}
              value={sysPrompt}
              onChange={e => setSysPrompt(e.target.value)}
              style={{ resize: "vertical", lineHeight: 1.5 }}
            />
          </div>

          <hr className="config-divider" />

          <div className="config-section-title">Stack Info</div>
          <div className="model-info">
            {modelInfo ? (
              <>
                {Object.entries(modelInfo).map(([k, v]) => (
                  <div key={k}>{k}: {String(v)}</div>
                ))}
              </>
            ) : (
              <>
                <div>ASR: whisper.cpp</div>
                <div>LLM: llama.cpp (CUDA)</div>
                <div>GPU: GTX 1050 Ti</div>
                <div>TTS: Piper</div>
                <div>Host: T3610 / just2awesome</div>
                <div>Tailscale: 100.65.9.40</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────
export default function App() {
  const [serviceStates, setServiceStates] = useState(
    SERVICES.map(s => ({ ...s, status: "checking", latency: null, code: null }))
  );
  const [alerts, setAlerts] = useState([
    { id: "boot-1", type: "info", message: "Command Center initializing health checks…", timestamp: "just now" }
  ]);
  const [metricsHistory, setMetricsHistory] = useState([]);
  const pollRef = useRef(null);
  const prevStatesRef = useRef(null);

  const pushAlert = useCallback((alert) => {
    setAlerts(prev => [{ ...alert, id: Date.now().toString(), timestamp: new Date().toLocaleTimeString() }, ...prev.slice(0, 19)]);
  }, []);

  const runHealthChecks = useCallback(async () => {
    const results = await Promise.all(
      SERVICES.map(async svc => {
        const t0 = performance.now();
        let status = "offline", latency = null, code = null;
        try {
          const res = await fetch(
            svc.url ?? `https://${svc.subdomain}${svc.healthPath}`,
            { signal: AbortSignal.timeout(2500) }
          );
          latency = Math.round(performance.now() - t0);
          code = res.status;
          status = res.ok ? "online" : "warning";
        } catch {
          // latency stays null
        }
        return { ...svc, status, latency, code };
      })
    );

    const prev = prevStatesRef.current;
    if (prev) {
      prev.forEach((old, i) => {
        const nw = results[i];
        if (old.status !== "checking" && old.status !== nw.status) {
          pushAlert({
            type: nw.status === "online" ? "success" : nw.status === "offline" ? "error" : "warning",
            message: `${nw.name} → ${nw.status.toUpperCase()}`,
            server: nw.subdomain,
          });
        }
      });
    }
    prevStatesRef.current = results;
    setServiceStates(results);

    const latencies = results.map(r => r.latency).filter(Boolean);
    const avgLatency = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;
    const onlineCount = results.filter(r => r.status === "online").length;

    const now = new Date();
    const timeLabel = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    setMetricsHistory(prev => [
      ...prev.slice(-29),
      { time: timeLabel, avgLatency, online: onlineCount },
    ]);
  }, [pushAlert]);

  useEffect(() => {
    const timer = setTimeout(runHealthChecks, 0);
    pollRef.current = setInterval(runHealthChecks, 3000);
    return () => { clearTimeout(timer); clearInterval(pollRef.current); };
  }, [runHealthChecks]);

  return (
    <>
      <style>{css}</style>
      <div className="cc-root">
        {/* Header */}
        <div className="cc-header">
          <div className="cc-header-left">
            <div className="logo-mark">F∞</div>
            <div>
              <div className="cc-title">MCP Command Center</div>
              <div className="cc-subtitle">FusionAL Infrastructure · gateway.fusional.dev</div>
            </div>
          </div>
          <div className="live-badge">
            <div className="pulse-dot" />
            <span>Live · 3s poll</span>
          </div>
        </div>

        {/* Overview */}
        <SystemOverview servers={serviceStates} />

        {/* Chart + Alerts */}
        <div className="two-col">
          <MetricsChart data={metricsHistory} />
          <AlertsFeed alerts={alerts} />
        </div>

        {/* Service Cards */}
        <div className="servers-grid">
          {serviceStates.map(s => (
            <ServerCard key={s.key} {...s} />
          ))}
        </div>

        {/* Christopher-AI */}
        <ChristopherAI />
      </div>
    </>
  );
}
