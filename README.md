# Mini ISE

A small zero-trust network access service. Simulated devices ask for access, a decision service answers allow, deny or quarantine in under a millisecond, and admins manage policies in a React console. Claude drafts policies from plain English; a person approves them before they go live.

**AI drafts, a person approves, deterministic code enforces.** The LLM is never on the decision path: decisions must be reproducible for audits, must not depend on an external API being up, and must not be exposed to prompt injection from device data.

## Architecture

```
browser ──> console (React + nginx) ──> policy-api (FastAPI) ──> Postgres
                                              │                    ▲
                                              └──> Claude API      │
simulator (fake devices) ──> decision-service (FastAPI, N pods) ───┘
```

| Component | What it does |
|---|---|
| `decision-service` | Evaluates access requests against policies held in memory. Refreshes policies every 3s, writes the decision log in batches. Keeps deciding if Postgres goes away. |
| `policy-api` | Policy CRUD, AI drafting, decision log and stats for the console. |
| `simulator` | Sends realistic access requests on a fast simulated clock. |
| `console` | Live decisions, stats per pod, policy list, "describe a rule" drafter. |

## Kubernetes features shown

- **Horizontal autoscaling:** the decision service scales from 2 to 6 pods on CPU (`make load-high`).
- **Self-healing:** delete a pod and Kubernetes replaces it while traffic keeps flowing (`make kill-decision-pod`).
- **Readiness:** a decision pod gets traffic only after its policies are loaded.
- **NetworkPolicy:** default deny inside the namespace; the decision service can reach only Postgres and DNS.
- **Hardened pods:** non-root, read-only root filesystem, all capabilities dropped.

## Run it

Needs Docker, kind and kubectl. Easiest in GitHub Codespaces (this repo includes a devcontainer).

```bash
cp .env.example .env        # add ANTHROPIC_API_KEY, or set it as a Codespaces secret
make up                     # cluster, images, metrics-server, secret, deploy
```

Open http://localhost:8080 (in Codespaces, open forwarded port 8080).

```bash
make status                 # pods per node and autoscaler state
make load-high              # watch pods scale up in the console
make load-normal
make kill-decision-pod      # watch a replacement pod appear
make down                   # delete the cluster
```

## Site and slides

`site/` is a static React app: a landing page where you can run the policy engine in the browser, and the talk slides at `#/slides` (arrow keys to move, `N` for speaker notes, `F` for full screen, `#/slides/print` to save as PDF).

`TALK-NOTES.md` is the spoken script. `Mini-ISE-talk.pptx` is the same deck as a PowerPoint file, rebuilt with `cd scripts && npm install && npm run build`.

The browser engine (`site/src/engine.ts`) and the Python engine (`backend/src/mini_ise/rules.py`) both run the shared cases in `fixtures/policy-cases.json`, so they can't quietly disagree.

```bash
cd site && npm install
npm test          # shared cases + ordering rules
npm run dev       # http://localhost:5173
npm run build     # type-check and build to site/dist
```

## Local development without Kubernetes

```bash
docker compose up -d                                   # Postgres on :5433
cd backend && uv run uvicorn mini_ise.policy_api:app --port 8001 --env-file ../.env
cd backend && uv run uvicorn mini_ise.decision_service:app --port 8000
cd backend && uv run mini-ise-simulator --rps 10
cd frontend && npm install && npm run dev              # http://localhost:5173
```

Tests: `make test`
