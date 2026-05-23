---
name: fusional-ops
description: >
  Check, fix, and report the status of all FusionAL services on the T3610 host (just2awesome).
  Use this whenever the user asks about service status, something is down or unreachable,
  Christopher-AI or the dashboard isn't working, a Docker container stopped, llama-server
  needs restarting, the wrong host binding is active, or anything is wrong with the FusionAL
  or OpenClaw stack. Also use when the user says "check t3610", "is everything up", "restart X",
  or asks why the AI or any service isn't responding.
---

# fusional-ops

Operate the FusionAL + Christopher-AI infrastructure on T3610.

## Host access

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 -i ~/.ssh/id_ed25519 jrm_fusional@100.65.9.40
```

Tailscale IP: `100.65.9.40`. Hostname: `just2awesome`. User: `jrm_fusional`.

---

## Service registry

| Key | Name | Type | Expected |
|-----|------|------|----------|
| `gateway` | FusionAL Gateway | Docker: `fusional-fusional-1` | Up, port 8089 |
| `bi-mcp` | Business Intelligence MCP | Docker: `business-intelligence-mcp` | Up, port 8101 |
| `api-hub` | API Integration Hub | Docker: `api-integration-hub` | Up, port 8102 |
| `content-mcp` | Content Automation MCP | Docker: `content-automation-mcp` | Up, port 8103 |
| `intel-mcp` | Intelligence MCP | Docker: `intelligence-mcp` | Up, port 8104 |
| `christopher-ai` | llama-server (Christopher) | systemd user: `llama-server.service` | `0.0.0.0:8080`, `-ngl 99` |
| `fusional-manage` | Management API | systemd user: `fusional-manage.service` | `0.0.0.0:8099` |
| `openclaw` | OpenClaw Gateway | systemd user: `openclaw-gateway.service` | Active |

---

## Status check

Run this single SSH command to get a full picture in one shot:

```bash
ssh -o BatchMode=yes -i ~/.ssh/id_ed25519 jrm_fusional@100.65.9.40 "
echo '=== DOCKER ===' && docker ps -a --format 'table {{.Names}}\t{{.Status}}'
echo '=== PORTS ===' && ss -tlnp | grep -E ':8080|:8089|:8099|:810[0-9]'
echo '=== LLAMA PROCESS ===' && ps aux | grep llama-server | grep -v grep | awk '{print \$11,\$12,\$13,\$14,\$15,\$16,\$17}'
echo '=== SYSTEMD ===' && systemctl --user is-active llama-server fusional-manage openclaw-gateway 2>/dev/null
" 2>&1
```

Parse the output to build a status table. Flag any of these as problems:
- Docker container shows `Exited` instead of `Up`
- Port missing from `ss` output
- llama-server process has `--host 127.0.0.1` (should be `0.0.0.0`) or `-ngl 0` (should be `-ngl 99`)
- systemd service shows `inactive` or `failed`

---

## Fixing common issues

### Docker container stopped
```bash
docker start <container-name>
# Verify:
docker ps | grep <container-name>
```

### llama-server wrong host or ngl=0
The systemd unit controls this. Check and fix:
```bash
cat ~/.config/systemd/user/llama-server.service
```
The `ExecStart` line must have `--host 0.0.0.0` and `-ngl 99`. If not:
```bash
# Find and kill the running process first
kill $(pgrep -x llama-server); sleep 2
# The systemd unit (already correct after today's fix) will auto-restart
systemctl --user restart llama-server
sleep 5 && ss -tlnp | grep 8080
```

### fusional-manage not running
```bash
systemctl --user start fusional-manage
sleep 2 && ss -tlnp | grep 8099
```

### openclaw-gateway stopped
```bash
systemctl --user restart openclaw-gateway
systemctl --user status openclaw-gateway --no-pager | head -5
```

### Everything down after reboot
User-level systemd services need `loginctl enable-linger jrm_fusional` to start without an active session. Check:
```bash
loginctl show-user jrm_fusional | grep Linger
```
If `Linger=no`, run: `loginctl enable-linger jrm_fusional`

---

## Output format

Always end with a status table like this:

```
Service                  Status    Notes
────────────────────────────────────────────────────
FusionAL Gateway         ✓ up      port 8089
Business Intelligence    ✓ up      port 8101
API Integration Hub      ✓ up      port 8102
Content Automation       ✓ up      port 8103
Intelligence MCP         ✓ up      port 8104
Christopher-AI           ✓ up      0.0.0.0:8080, ngl=99
Management API           ✓ up      0.0.0.0:8099
OpenClaw Gateway         ✓ up      active
```

Use `✓ up`, `✗ down`, or `⚠ degraded` for each. If you fixed something, append `(restarted)` to the notes. If something couldn't be fixed (e.g., needs sudo), explain why and what the user should run manually.
