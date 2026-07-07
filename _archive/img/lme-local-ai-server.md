# Self-Hosted Local AI Server for LME

**Project type:** Personal infrastructure / Lab project
**Author:** Simon Max
**Context:** BTS Cloud Computing — 2nd year
**Date:** June 2026

---

## 1. Project Goal

Build a fully self-hosted AI assistant for LME (`lme.lu`) that runs entirely on local hardware, with no dependency on commercial APIs or cloud providers. The system must be able to:

- Answer technical questions about the LME infrastructure stack (Proxmox, Coolify, Docker, Laravel, Bash).
- Use **Retrieval-Augmented Generation (RAG)** over private documentation (e.g. the Proxmox VE Administration Guide, internal infrastructure notes).
- Operate offline, with full data sovereignty — no prompts or documents leaving the machine.

Out of scope for this stage (planned as a follow-up): a messenger-based personal assistant (Signal / Telegram) with note-taking and reminder capabilities, orchestrated via n8n.

---

## 2. Hardware

| Component   | Specification                                          |
| ----------- | ------------------------------------------------------ |
| Chassis     | Supermicro server                                      |
| CPU         | Intel Xeon, 12 cores                                   |
| RAM         | 16 GB DDR4 ECC                                         |
| GPU         | NVIDIA RTX 2060, 6 GB VRAM (Turing, Compute 7.5)       |
| PSU         | FSP 550 W                                              |
| GPU power   | Cable Matters 2× Molex → 8-pin PCIe, two separate rails |
| OS          | Ubuntu Server 22.04 LTS                                |

**Note on power delivery.** The RTX 2060 draws ~160 W. The Molex-to-PCIe adapter was wired across **two independent Molex rails** rather than daisy-chained on a single rail — this is the correct and safe configuration for adapter-based GPU power.

---

## 3. Software Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Ubuntu 22.04 LTS                       │
│                                                             │
│  ┌────────────────────────┐      ┌────────────────────────┐ │
│  │       Ollama           │      │     AnythingLLM        │ │
│  │  (native, systemd)     │◄─────┤   (Docker container)   │ │
│  │                        │ HTTP │                        │ │
│  │  - llama3.1:8b         │11434 │  - Chat UI             │ │
│  │  - qwen2.5-coder:7b    │      │  - Document ingest     │ │
│  │  - nomic-embed-text    │      │  - LanceDB (vectors)   │ │
│  └───────────┬────────────┘      │  - Native embedder     │ │
│              │ CUDA               └────────────┬───────────┘ │
│              ▼                                  │            │
│        ┌──────────┐                             │ HTTP       │
│        │ RTX 2060 │                             │ 3001       │
│        │  (6 GB)  │                             ▼            │
│        └──────────┘                       Web browser        │
└─────────────────────────────────────────────────────────────┘
```

**Design choices and rationale:**

- **Ollama runs natively (not containerised).** Direct access to the NVIDIA driver, simpler GPU scheduling, lower overhead. Docker would have added an unnecessary layer (NVIDIA Container Toolkit) without measurable benefit for a single-host setup.
- **AnythingLLM runs in Docker.** Easier upgrade path, isolated storage volume (`~/anythingllm/storage`), and clean separation between the LLM runtime (Ollama) and the application layer.
- **LanceDB** as vector store — embedded, no extra service to maintain, sufficient for the document volume in scope.
- **Native embedder** (`Xenova/nomic-embed-text-v1` inside the AnythingLLM container) chosen over Ollama-based embedding to keep VRAM exclusively available for the language model. With a 6 GB GPU, every megabyte matters.

---

## 4. Deployment Walkthrough

### 4.1 NVIDIA driver

```bash
sudo apt update && sudo apt upgrade -y
sudo ubuntu-drivers install
sudo reboot
nvidia-smi   # verification
```

### 4.2 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 4.3 Ollama (native)

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Critical configuration — by default Ollama binds to `127.0.0.1`, which is unreachable from the AnythingLLM container (in a container, `127.0.0.1` resolves to the container itself, not the host). A systemd drop-in fixes this:

```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/override.conf > /dev/null <<'EOF'
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_FLASH_ATTENTION=1"
Environment="OLLAMA_KV_CACHE_TYPE=q8_0"
EOF
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

Verification:

```bash
sudo ss -tlnp | grep 11434     # must show *:11434, not 127.0.0.1:11434
```

### 4.4 Model selection

Two models pulled, each for a distinct purpose:

```bash
ollama pull llama3.1:8b          # general-purpose, multilingual (DE/EN), Q&A
ollama pull qwen2.5-coder:7b     # code generation (Bash, Laravel, configs)
ollama pull nomic-embed-text     # embedding (currently unused — see §5)
```

### 4.5 AnythingLLM

```bash
mkdir -p ~/anythingllm/storage
docker run -d \
  --name anythingllm \
  --restart unless-stopped \
  -p 3001:3001 \
  --cap-add SYS_ADMIN \
  --add-host=host.docker.internal:host-gateway \
  -v ~/anythingllm/storage:/app/server/storage \
  -e STORAGE_DIR=/app/server/storage \
  mintplexlabs/anythingllm
```

The `--add-host=host.docker.internal:host-gateway` flag is the bridge that allows the container to reach the natively-running Ollama on the host.

In the AnythingLLM web UI (`http://<server-ip>:3001`):

- LLM provider: **Ollama**, Base URL `http://host.docker.internal:11434`
- Embedder: **AnythingLLM Native** (`nomic-embed-text-v1`)
- Vector DB: **LanceDB** (default)

---

## 5. Problems Encountered and Solutions

This section documents the real obstacles hit during deployment, not a sanitised retrospective. Each one taught a transferable lesson.

### 5.1 Ollama bound to loopback — UI stuck on "loading models"

**Symptom.** AnythingLLM's model dropdown was stuck on "--loading available models--" indefinitely. `curl http://localhost:11434/api/tags` from the host worked fine and returned the model list.

**Diagnosis.** `curl` against `localhost` follows the loopback interface and succeeds even when the service is bound only to `127.0.0.1`. The Docker container, however, reaches the host via the Docker bridge (`host.docker.internal` → ~`172.17.0.1`), where nothing was listening.

```bash
sudo ss -tlnp | grep 11434
# LISTEN  127.0.0.1:11434  ...  ← the problem
```

**Resolution.** The systemd drop-in in §4.3. After restart, the bind address changed to `*:11434` and the dropdown populated immediately.

**Lesson.** `localhost` is not a sufficient connectivity test when the consumer lives in a different network namespace.

### 5.2 Model spilling to CPU — degraded throughput

**Symptom.** Initial generation speed was ~11–16 tok/s with `qwen2.5-coder:7b`, well below the 30+ tok/s the RTX 2060 should deliver for a 7B model.

**Diagnosis.**

```bash
ollama ps
# qwen2.5-coder:7b  5.8 GB  18%/82% CPU/GPU  16384
```

The 7B model itself is ~4.7 GB (Q4_K_M), but with the default context window of 16384 tokens the KV cache pushed the total VRAM requirement past the card's usable 6 GB. Excess layers were offloaded to system RAM, and every generated token had to wait on the slow CPU layers.

**Resolution.** Two-step.

1. Enable KV-cache quantisation in Ollama (`OLLAMA_FLASH_ATTENTION=1` + `OLLAMA_KV_CACHE_TYPE=q8_0`). This cut total VRAM use from 5.8 GB to 5.4 GB and raised GPU share to 88 %.
2. Reduce the context window from 16384 to 8192 in the AnythingLLM provider settings. Final state: 4.8 GB, `100% GPU`.

```
NAME              ID            SIZE    PROCESSOR    CONTEXT    UNTIL
qwen2.5-coder:7b  dae161e27b0e  4.8 GB  100% GPU     8192       2 minutes from now
```

**Lesson.** The model size on disk is not the VRAM footprint. KV cache scales linearly with context length and can silently push a "fitting" model out of VRAM.

### 5.3 Wrong model for the task

**Symptom.** When the user wrote in German, `qwen2.5-coder:7b` replied: *"I'm sorry, I don't understand German. Could you please repeat your question in English?"* For a simple "how fast are you?" it emitted raw tool-call JSON instead of an answer.

**Diagnosis.** `qwen2.5-coder` is a **code-specialised** model. Training data is overwhelmingly code and English; multilingual conversational ability and robust tool-calling are explicitly not its strengths.

**Resolution.** Switched the default workspace model to `llama3.1:8b`, which is a general-purpose multilingual model. `qwen2.5-coder` remains available for code-only workspaces.

**Lesson.** Model selection is task selection. A coder model is not a "stronger" general model — it is a *different* model.

### 5.4 OOM kill during document embedding

**Symptom.** Uploading the 685-page Proxmox VE Administration Guide as a single Markdown file caused the AnythingLLM embedding worker to be killed mid-process:

```
[backend] warn: Child process exited with code null and signal SIGKILL
[bg-worker][Error] error: Worker for job "embedding-worker-..." exited with code null
```

System memory at the time: `15.48 GB used / 15.50 GB total`, with swap also saturated.

**Diagnosis.** The container log revealed the actual cause:

```
[RecursiveSplitter] Will split with { chunkSize: 16000, ... }
```

The chunk size was set to **16 000 characters**, far above the embedder's effective window (~2 048 tokens / ~8 000 characters). Attention memory grows quadratically with input length; a single chunk of that size required several GB of RAM to embed, exceeding what was available.

**Resolution.**

- Reduce **Text Chunk Size** to `1 000`, overlap `100` (AnythingLLM → Settings → Text Splitter & Chunking Preferences).
- Split the source PDF into 21 per-chapter Markdown files. Smaller files also produce cleaner RAG citations ("from Chapter 7" rather than "from the Proxmox guide").
- Stop the LLM (`ollama stop llama3.1:8b`) during heavy embedding jobs to free RAM, since the LLM and the embedder otherwise compete for the same 16 GB.

**Lesson.** Chunk size and context window are different settings with different consequences. Conflating them is a fast path to an OOM kill.

### 5.5 PDF-to-Markdown conversion for RAG quality

**Side problem.** Feeding the raw 685-page PDF directly to AnythingLLM produced poor retrieval, because the document structure was lost in extraction.

**Solution.** Pre-processed the PDF with `pymupdf4llm` and a custom cleanup script that:

- Promoted only numbered headings (`1.`, `1.2`, `1.2.3`) to real Markdown headings, demoted the ~3 000 false positives (bold phrases, command names) to bold text.
- Wrapped command-line prompts (`# command`) in ` ```bash ` fenced code blocks instead of letting them be parsed as H1 headings.
- Converted Note/Caution/Warning boxes to blockquotes.
- Regenerated a clean table of contents with anchor links.

Result: 22 H1, 206 H2, 415 H3 headings — a structure the chunker can split on cleanly.

---

## 6. Current State

- Ollama running natively, exposed on `0.0.0.0:11434`, with Flash Attention and q8\_0 KV cache.
- `llama3.1:8b` as default model — runs at `100% GPU` with 8 192 context.
- AnythingLLM in Docker, web UI on port 3001.
- LanceDB workspace populated with the 21-chapter Proxmox documentation set.
- RAG queries return contextually relevant answers in German and English.

---

## 7. Next Steps

1. **Messenger integration.** Add an n8n instance (deployed via Coolify) to bridge the assistant to Signal (`signal-cli-rest-api`) and Telegram (native node). n8n will own the deterministic logic (scheduling, reminders, note persistence in PostgreSQL); Ollama is invoked only for language understanding and response phrasing. This split is deliberate — 7-8B local models are unreliable as fully autonomous agents but work well as a language frontend to fixed logic.
2. **Expand the knowledge base.** Add Coolify documentation, the LME infrastructure notes (`lme-infrastructure.md`), and Laravel framework references as further workspaces.
3. **Monitoring.** Add a small Node.js / Prometheus exporter that scrapes `nvidia-smi` and `ollama ps`, so VRAM pressure and processor split are visible historically rather than only on demand.

---

## 8. Technical Skills Demonstrated

- Linux system administration: systemd unit overrides, network namespace debugging (`ss`, `curl`, Docker bridge), driver installation.
- GPU resource management: VRAM budgeting, KV-cache quantisation, context-window tuning.
- Container orchestration: Docker networking with `host.docker.internal`, volume management, container–host service integration.
- LLM operations: model selection by task (code vs general vs embedding), RAG pipeline design, chunking strategy.
- Document engineering: PDF-to-Markdown conversion with structural cleanup, chunking for retrieval quality.
- Methodical troubleshooting: reading logs to identify root cause (`SIGKILL` → OOM → chunk size) rather than treating symptoms.
