# Christopher-AI Diagnosis — 2026-04-29

## Summary

**Current status: HEALTHY.** Christopher-AI (llama-server) is up and responding correctly as of the Apr 30 reboot. The "not working" report refers to a crash loop that ran from **Apr 5 through Apr 29** (6,000+ restart attempts), which resolved itself after the machine was rebooted on Apr 30.

---

## Root Cause

The crash loop originated on **Apr 5 at 23:28 UTC** with a hard CUDA error during inference:

```
ggml_cuda_init: found 1 CUDA devices (Total VRAM: 4037 MiB)
ggml-cuda.cu:98: CUDA error
ggml_cuda_pool_vmm::alloc — VRAM exhausted during matrix multiply (mul_mat_vec_q)
status=6/ABRT (core-dump)
```

The GTX 1050 Ti has 4 GiB VRAM. The model was mid-inference and exhausted GPU memory, causing llama-server to core-dump. Because the systemd unit has `Restart=always`, it kept restarting — but the VRAM was never fully freed between restart cycles, so every attempt failed immediately at the same CUDA init/alloc stage. This looped 6,119 times over ~24 days until the system rebooted on Apr 30.

After the reboot, VRAM was fully cleared, and llama-server started successfully on the first try.

---

## Current State (Post-Reboot)

- Process PID 1413, running for 18+ hours, stable
- Binding: `0.0.0.0:8080` (correct)
- Flags: `-ngl 99 -t 4 -c 2048` (correct)
- Health endpoint: `{"status":"ok"}`
- Test completion: responded with `"Hello."` in ~390ms
- VRAM in use: 2,480 MiB / 4,096 MiB (headroom: ~1,557 MiB)
- GPU: NVIDIA GeForce GTX 1050 Ti, CUDA 6.1
- Linger: enabled (`Linger=yes`) — service will survive session logout

---

## Notable Finding: Context Window Mismatch

The `.env` file has `LLAMA_CTX=16000`, but the running systemd unit uses `-c 2048`. A 16K context on this GPU would very likely trigger the same VRAM OOM that caused the original crash. The current 2048 setting is appropriate and safe for the 1050 Ti. **Do not increase `-c` without testing VRAM headroom first.**

---

## Actions Taken

No fix was required — the service recovered automatically after the Apr 30 reboot. No configuration changes were made.

---

## Service Status Table

```
Service                  Status      Notes
────────────────────────────────────────────────────────────────
FusionAL Gateway         ✓ up        port 8089
Business Intelligence    ✓ up        port 8101
API Integration Hub      ✓ up        port 8102
Content Automation       ✓ up        port 8103
Intelligence MCP         ✓ up        port 8104
Christopher-AI           ✓ up        0.0.0.0:8080, ngl=99, c=2048
Management API           ✓ up        0.0.0.0:8099
OpenClaw Gateway         ✓ up        active
```

> Note: `fusional-clean-fusional-1` shows `Exited (0)` — this is a separate clean/test compose stack, not part of the active service registry.

---

## Recommendations

1. **Investigate what caused the Apr 5 VRAM exhaustion.** The christopher.log shows the last session before the crash included LLM calls that returned `500 Internal Server Error` — likely the inference itself OOM'd mid-token. A long or malformed prompt may have caused VRAM fragmentation.

2. **Add a VRAM guard to the systemd unit.** Consider adding `StartLimitIntervalSec=60` and `StartLimitBurst=5` to the `[Unit]` section to prevent 6,000-restart loops. Without this, a future VRAM OOM will cause runaway restart storms again.

3. **Do not set `LLAMA_CTX=16000` in `.env` without testing.** At 16K context, the 3B model will likely exceed 4 GiB VRAM with ngl=99. If a larger context is needed, reduce `-ngl` (offload fewer layers to GPU) to make room.
