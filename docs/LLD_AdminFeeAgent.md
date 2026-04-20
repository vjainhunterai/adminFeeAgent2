# Low-Level Design (LLD) — AdminFee Agent

> Detailed LLD for the **AdminFee Reconciliation Agent** — an agentic AI application that automates retrieval, processing, and reconciliation of administrative fee delivery files for Voya Financial.

---

## Document Status

| Field | Value |
|-------|-------|
| Application | AdminFee Reconciliation Agent |
| Owner | AdminFee Engineering Team |
| Version | 1.0 (Draft) |
| Last Updated | 2026-04-20 |
| Status | Draft — Section 1 Complete |

---

# Part I — Strategy & Identity

## 1. Product Vision & Problem Statement

### 1.1 Mission

**Applicable — Detailed**

The AdminFee Agent automates the end-to-end reconciliation of administrative fee delivery files by orchestrating Airflow pipelines, retrieving processed data from AWS S3, and generating conversational analysis reports — eliminating the manual effort operations analysts spend on tracking, validating, and summarizing daily fee deliveries.

**One-line mission statement:**
> *"Turn a multi-hour manual admin-fee reconciliation process into a conversational, self-service workflow that completes in minutes."*

**Problem Today (Pre-Agent):**
- Operations analysts manually trigger Airflow DAGs through the Airflow UI for each delivery (e.g., `VRIAC_PRPS1_D`, `VRIAC_JH_D`).
- After jobs complete, analysts manually download output files from S3, open them in Excel, and compute expected vs. actual fee totals.
- Reconciliation summaries are hand-written in email threads; follow-up investigation requires SQL queries against MySQL and repeated S3 browsing.
- Knowledge of which delivery IDs map to which Airflow DAGs lives in tribal memory and spreadsheets.

**Problem Solved by the Agent:**
- Natural-language request → agent normalizes delivery ID → triggers correct Airflow DAG via SSH → monitors task states in real-time → pulls output from S3 → generates reconciliation summary → supports follow-up Q&A all in a single chat session.
- Session-based state persists Airflow run IDs, S3 paths, and delivery metadata so follow-up questions never need re-entry of context.

---

### 1.2 Target Users

**Applicable — Detailed**

#### Primary Persona: Administrative Fee Operations Analyst

| Attribute | Detail |
|-----------|--------|
| **Role** | Operations Analyst, AdminFee Processing Team |
| **Technical Level** | Intermediate — comfortable with Airflow UI, basic SQL, Excel; not a developer |
| **Daily Jobs-to-be-Done** | Trigger ~10–30 daily admin-fee deliveries; reconcile totals; investigate discrepancies; report status to fund accounting |
| **Pain Points Today** | Slow manual DAG triggering; constant context-switching between Airflow, S3 console, Excel, MySQL Workbench; no unified audit trail; errors in copy-pasting delivery IDs |
| **Value from Agent** | Single chat surface; auto-normalization of delivery IDs; real-time status; instant reconciliation summary; natural-language follow-ups |

#### Secondary Persona: AdminFee Team Lead / Supervisor

| Attribute | Detail |
|-----------|--------|
| **Role** | Operations Lead |
| **Technical Level** | Business user |
| **Daily Jobs-to-be-Done** | Oversee batch completion; investigate failed deliveries; report to leadership |
| **Pain Points Today** | No single pane of glass for delivery status; depends on analyst for ad-hoc queries |
| **Value from Agent** | Unified status monitor panel; analysis panel exportable summaries; audit of who-triggered-what |

#### Tertiary Persona: Engineering / DevOps (Observer Only)

| Attribute | Detail |
|-----------|--------|
| **Role** | Platform engineer supporting the agent |
| **Technical Level** | Developer |
| **Jobs-to-be-Done** | Monitor agent health, rotate Fernet keys, debug LLM/Airflow failures |
| **Value from Agent** | Structured logs, session replay, backend FastAPI health endpoints |

---

### 1.3 Success Metrics

**Applicable — Detailed**

#### North-Star Metric

| Metric | Target |
|--------|--------|
| **Mean Time to Reconciliation (MTTR)** per delivery | ≤ 5 minutes (from analyst request to summary rendered), vs. baseline 30–60 minutes |

#### Leading Indicators

| Metric | Target | Measurement |
|--------|--------|-------------|
| Delivery-ID normalization accuracy | ≥ 98% | LLM-extracted delivery ID matches canonical DB record |
| Airflow DAG trigger success rate | ≥ 99% | Successful DAG run IDs returned via SSH/Paramiko |
| Auto-analysis trigger success rate | ≥ 99% | AnalysisPanel auto-fires after StatusMonitor completion event |
| Session persistence reliability | ≥ 99.9% | Session state retrievable across panel switches |

#### Guardrail Metrics

| Metric | Threshold |
|--------|-----------|
| LLM hallucination rate on reconciliation summary | < 1% (validated against S3 source of truth) |
| Unauthorized Airflow DAG triggers | 0 (all triggers must come through authenticated FastAPI endpoint) |
| S3 data egress outside allowed buckets | 0 |
| Mean LLM cost per session | < $0.10 (LLaMA 3.1 8B on-prem / bedrock) |

#### User-Experience Metrics

| Metric | Target |
|--------|--------|
| First-reply latency (chat) | < 2 seconds |
| Full reconciliation E2E (trigger → summary) | < 5 minutes |
| Auto-analysis trigger latency after Airflow completion | < 3 seconds |

---

### 1.4 Non-Goals

**Applicable — Detailed**

The following are explicitly **out of scope** for v1.0 to prevent scope creep:

1. **NOT a general-purpose financial assistant.** The agent is scoped to AdminFee delivery reconciliation only — it will not answer questions about trade settlements, NAV calculations, corporate actions, or other fund-accounting workflows.
2. **NOT a replacement for Airflow authoring.** The agent triggers existing, pre-authored DAGs; it does not create, edit, or deploy Airflow DAGs.
3. **NOT a BI / reporting platform.** Summaries are conversational and per-delivery; no cross-delivery analytics, trend charts, or dashboards.
4. **NOT multi-tenant.** Single Voya tenant; no per-client data isolation beyond existing DB schema.
5. **NOT a data correction tool.** The agent reads S3 outputs and database records; it will never mutate fee data, override DAG outputs, or reprocess bad files. Any discrepancy is flagged for human action.
6. **NOT a mobile app.** Desktop browser only (Chrome/Edge latest two versions); no PWA, no native iOS/Android.
7. **NOT a persistent long-term memory system (v1).** Memory is session-scoped; no cross-user learning or cross-session episodic memory in the first release.
8. **NOT a voice interface.** Text chat only; no speech-to-text / TTS.
9. **NOT external-facing.** Internal Voya analysts only; no customer-facing deployment.
10. **NOT a workflow-approval system.** No approval gates, no multi-user sign-off; single analyst owns the full flow.

---

### 1.5 Competitive & Strategic Context

**Applicable — Detailed**

#### Adjacent Products / Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|----------------|
| **Keep Airflow UI + Excel (status quo)** | Manual, slow, error-prone; no conversational layer; no session audit trail |
| **Power BI / Tableau dashboard** | Reporting only; cannot trigger jobs; no natural-language interface |
| **Custom React portal without LLM** | Requires analysts to remember exact delivery IDs and DAG names; no flexibility for ad-hoc questions |
| **Third-party agent platforms (e.g., Moveworks, Aisera)** | Would require sharing AdminFee data externally; enterprise licensing cost; limited domain customization |
| **Slack bot** | No structured 3-panel UI; limited rich rendering for reconciliation tables |

#### Differentiators (Why This Agent Wins)

1. **Domain-specialized normalization** — `VRIAC_PRPS1`, `VRIAC_PRPS1_D`, `prps1 daily`, `PRPS1` all map to the same canonical delivery via LLM + regex fallback.
2. **Three-panel architecture** — simultaneous chat, live Airflow status monitor, and analysis panel (most agents show only chat).
3. **Auto-trigger flow** — zero-click transition from "Airflow done" to "reconciliation summary shown."
4. **Built on open tech** — LangGraph + LLaMA 3.1 8B + FastAPI; avoids vendor lock-in.
5. **Tight integration with existing Voya AdminFee infrastructure** — uses the same MySQL RDS, same S3 buckets, same Airflow DAGs already in production.

#### Strategic Moat

- **Data moat**: Proprietary mapping between analyst-spoken delivery names and canonical DAG IDs, refined over time from real usage logs.
- **Workflow moat**: Deep, opinionated integration with the specific Voya AdminFee pipeline (SSH trigger pattern, S3 naming convention, MySQL schema) that a generic agent cannot replicate without the same domain investment.
- **Trust moat**: Auditable tool-call log for every Airflow trigger — critical for financial-services compliance.

#### Strategic Risk

| Risk | Mitigation |
|------|------------|
| Airflow DAG contract changes break the agent | Canonical DAG registry table; version tolerance in normalization |
| LLaMA 3.1 8B accuracy regression | Regex fallback (`_fallback_normalize_delivery`) and model-swap abstraction layer (§5.3) |
| Analysts over-trust summaries | Every summary cites S3 source path + DAG run ID for human verification |

---

## 2. Agent Identity, Persona & Voice

### 2.1 Persona Definition

**Applicable — Detailed**

| Attribute | Value |
|-----------|-------|
| **Name** | AdminFee Agent (internal) / "Fee Assistant" (UI label) |
| **Role** | Operations copilot for administrative-fee delivery reconciliation |
| **Expertise Level** | Senior operations analyst — knows DAG catalog, S3 folder conventions, reconciliation rules |
| **Tone** | Professional, factual, calm; domain-aware but not jargon-heavy |
| **Register** | Business-formal; uses plain English over acronyms where possible |
| **Primary Skill** | Normalizing delivery names → triggering DAGs → summarizing S3 outputs |

### 2.2 Voice & Style Guide

**Applicable — Detailed**

| Rule | Guideline |
|------|-----------|
| Sentence length | Short, declarative; 1–2 sentences per chat reply unless summarizing |
| Formality | Formal but warm; no slang, no sarcasm |
| Humor | None — financial reconciliation context demands seriousness |
| Emojis | None in agent output |
| Numbers | Always render money with currency symbol + 2 decimals (`$1,234,567.89`) |
| Tables | Used for reconciliation summaries (delivery ID, expected, actual, delta, status) |
| Code blocks | Used only for raw S3 paths, DAG run IDs, and SQL snippets |
| Citations | Every data point includes source: `(S3: s3://voya-adminfee/.../file.csv)` or `(DAG run: manual__2026-04-20T...)` |

### 2.3 Communication Principles

**Applicable — Detailed**

1. **Honesty-first**: If the agent cannot normalize a delivery ID, it asks rather than guesses.
2. **Epistemic humility**: Reconciliation summaries always state "Based on S3 output at [path], last modified [timestamp]" — never claim certainty the source doesn't support.
3. **Uncertainty handling**: Confidence-aware language — "This appears to match delivery `VRIAC_PRPS1_D`. Should I proceed?" when LLM normalization confidence < threshold.
4. **Pushback style**: Refuses to proceed when delivery is ambiguous; refuses to fabricate totals when S3 file is missing.
5. **Brevity**: No pleasantries in tool-chaining turns; pleasantries allowed on greeting and sign-off.

### 2.4 Brand Alignment

**Applicable — Brief**

- Voya internal product — follows Voya operations-tooling tone: professional, trustworthy, compliance-aware.
- No consumer branding elements; the UI uses Voya's standard internal-tooling design tokens.
- No marketing copy; all agent output is functional.

### 2.5 Example Interactions

**Applicable — Detailed**

**Example 1 — Happy path**
```
User:   run prps1 daily
Agent:  Matched delivery VRIAC_PRPS1_D. Triggering Airflow DAG
        adminfee_vriac_prps1_daily. Run ID: manual__2026-04-20T14:30:22.
        I'll show live status in the Status Monitor panel.
[Status Monitor shows task progression]
[Auto-trigger fires on completion]
Agent:  Reconciliation complete for VRIAC_PRPS1_D (2026-04-20).
        Expected fee total: $1,245,678.90
        Actual fee total:   $1,245,678.90
        Delta: $0.00 — MATCH
        Source: s3://voya-adminfee/prps1/2026-04-20/output.csv
        Any follow-up?
```

**Example 2 — Ambiguous delivery**
```
User:   run john hancock
Agent:  I found two John Hancock deliveries: VRIAC_JH_D (daily) and
        VRIAC_JH_M (monthly). Which one should I trigger?
```

**Example 3 — Failure mode**
```
User:   why is prps1 delta $500 off?
Agent:  Investigating. Pulling MySQL fee records for VRIAC_PRPS1_D on
        2026-04-20...
        Found 3 records with status='PENDING_REVIEW' totaling $500.00.
        These were excluded from the actual total. See:
        (DB: adminfee.fee_records WHERE delivery_id='VRIAC_PRPS1_D'
        AND status='PENDING_REVIEW')
        Recommend: route to fund-accounting queue for manual review.
```

---

# Part II — Architecture & Models

## 3. System Architecture Overview

### 3.1 High-Level Diagram

**Applicable — Detailed**

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER (Chrome/Edge)                       │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ AgentChat    │  │ StatusMonitor    │  │ AnalysisPanel        │  │
│  │ Panel        │  │ Panel            │  │                      │  │
│  └──────┬───────┘  └────────┬─────────┘  └──────────┬───────────┘  │
│         │                   │                        │              │
│         │     React 18 + Vite (App.jsx state)        │              │
└─────────┼───────────────────┼────────────────────────┼──────────────┘
          │ POST /chat         │ GET /airflow/status    │ POST /analysis
          ▼                    ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   FastAPI BACKEND (Uvicorn, Python 3.11)             │
│  ┌────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │ /chat router   │  │ /airflow router  │  │ /analysis router   │  │
│  └───────┬────────┘  └────────┬─────────┘  └──────────┬─────────┘  │
│          │                    │                         │            │
│          ▼                    ▼                         ▼            │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              LangGraph StateGraph (Agent Core)                  │ │
│  │   normalize → trigger_airflow → monitor → pull_s3 → summarize  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│          │              │              │              │              │
│          ▼              ▼              ▼              ▼              │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│   │ llm_svc  │   │ airflow_ │   │ s3_svc   │   │ db_svc   │        │
│   │(LLaMA8B) │   │ svc(SSH) │   │(Boto3)   │   │(SQLAlch) │        │
│   └─────┬────┘   └─────┬────┘   └─────┬────┘   └─────┬────┘        │
└─────────┼──────────────┼──────────────┼──────────────┼─────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
     ┌────────┐    ┌──────────┐   ┌──────────┐   ┌───────────┐
     │ LLaMA  │    │ Airflow  │   │ AWS S3   │   │ MySQL RDS │
     │ 3.1 8B │    │ (Paramiko│   │ Buckets  │   │ adminfee  │
     │Endpoint│    │   SSH)   │   │          │   │  schema   │
     └────────┘    └──────────┘   └──────────┘   └───────────┘
```

### 3.2 Component Inventory

**Applicable — Detailed**

| Component | Owner | Responsibility |
|-----------|-------|----------------|
| **Frontend — App.jsx** | Frontend team | Root state; wires 3 panels; owns `activeDelivery`, `processingComplete` |
| **AgentChatPanel** | Frontend | User text input; renders LangGraph turn responses |
| **StatusMonitorPanel** | Frontend | Polls `/airflow/status/{run_id}`; detects completion; fires `onProcessingComplete` |
| **AnalysisPanel** | Frontend | Auto-triggers `analysisSetup()` then `getReconciliation()` on delivery change |
| **FastAPI app** | Backend | HTTP entrypoint; CORS; request validation |
| **/chat router** | Backend | Invokes LangGraph agent with session state |
| **/airflow router** | Backend | Status polling endpoint; wraps `airflow_service` |
| **/analysis router** | Backend | Reconciliation setup + summary endpoints |
| **LangGraph StateGraph** | Backend | Node orchestration: normalize → trigger → monitor → summarize |
| **llm_service.py** | Backend | LLaMA 3.1 8B client; `_fallback_normalize_delivery()` regex |
| **airflow_service.py** | Backend | Paramiko SSH to Airflow scheduler host; triggers DAGs; polls status |
| **s3_service.py** | Backend | Boto3 S3 client; list/get objects under delivery prefix |
| **db_service.py** | Backend | SQLAlchemy session factory; delivery lookup queries |
| **session_store** | Backend | In-memory dict keyed by `session_id` (v1); Redis-ready |
| **crypto_service** | Backend | Fernet encrypt/decrypt for DB-stored credentials |

### 3.3 Request Lifecycle

**Applicable — Detailed**

End-to-end trace for "run prps1 daily":

1. **User types** in AgentChatPanel → `POST /chat {session_id, message}`.
2. **FastAPI /chat** retrieves session state, invokes LangGraph with message.
3. **Node: normalize_delivery** → calls `llm_service.normalize()` → LLaMA 3.1 8B returns `VRIAC_PRPS1_D`. On LLM failure, `_fallback_normalize_delivery()` regex matches.
4. **Node: lookup_delivery** → `db_service` queries `adminfee.delivery_catalog` for DAG ID.
5. **Node: trigger_airflow** → `airflow_service.trigger_dag()` opens Paramiko SSH, runs `airflow dags trigger adminfee_vriac_prps1_daily`, captures `run_id`.
6. **Response to frontend** → chat message + `active_delivery` payload with `run_id`.
7. **Frontend App.jsx** sets `activeDelivery` state → StatusMonitorPanel begins polling `/airflow/status/{run_id}` every 3s.
8. **StatusMonitorPanel** detects all tasks `success` → gates on `processingStartedRef` → fires `onProcessingComplete(delivery)`.
9. **App.jsx** sets `processingComplete=true` → AnalysisPanel `useEffect` triggers.
10. **AnalysisPanel** → `POST /analysis/setup` → backend lists S3 files under delivery prefix.
11. **AnalysisPanel** → `POST /analysis/reconciliation` → backend reads S3 output, computes totals, LLM summarizes, returns structured response.
12. **AnalysisPanel renders** reconciliation table; follow-up Q&A uses same session.

### 3.4 Technology Stack

**Applicable — Detailed**

| Layer | Technology | Version | Reason |
|-------|-----------|---------|--------|
| Frontend framework | React | 18 | Team familiarity, ecosystem |
| Bundler | Vite | 5 | Fast HMR, simple config |
| HTTP client | Fetch API | native | No extra dep |
| Backend framework | FastAPI | 0.110+ | Async, Pydantic validation, OpenAPI free |
| ASGI server | Uvicorn | 0.27+ | Standard FastAPI pair |
| Agent framework | LangGraph | 0.0.40+ | Explicit state machine, better than free-form LangChain |
| LLM client wrapper | LangChain | 0.1+ | Adapter abstraction |
| Primary LLM | LLaMA 3.1 8B | — | On-prem / cost control (replaced GPT-4.1-mini) |
| ORM | SQLAlchemy | 2.0 | Mature, type-aware |
| DB driver | PyMySQL | 1.1 | Pure Python, no C deps |
| Database | MySQL on AWS RDS | 8.0 | Existing Voya standard |
| SSH client | Paramiko | 3.4 | Trigger Airflow via scheduler host |
| Workflow engine | Apache Airflow | 2.8 (external) | Existing AdminFee pipeline |
| Object storage | AWS S3 via Boto3 | 1.34 | Existing delivery output location |
| Crypto | cryptography / Fernet | 42.0 | Symmetric key at rest |
| Python | 3.11 | — | Typing, performance |

### 3.5 Key Architectural Decisions

**Applicable — Detailed (ADR style)**

| ADR | Decision | Rationale | Trade-off |
|-----|----------|-----------|-----------|
| **ADR-001** | Use LangGraph StateGraph (not free-form ReAct) | Explicit nodes = auditable, testable, easy to gate financial actions | More code than simple ReAct agent |
| **ADR-002** | Trigger Airflow via SSH/Paramiko (not REST API) | Voya Airflow REST API not exposed internally; SSH is available | Tighter coupling to scheduler host |
| **ADR-003** | Replace OpenAI GPT-4.1-mini with LLaMA 3.1 8B | Data-residency + cost; financial data must not leave Voya network | Lower raw quality; mitigated by structured tool-calling |
| **ADR-004** | 3-panel UI (chat + monitor + analysis) | Analysts need simultaneous context, not sequential screens | Higher frontend complexity |
| **ADR-005** | Session state in memory (v1), Redis later | Single instance for v1; defer Redis until multi-instance | Session loss on restart |
| **ADR-006** | Regex fallback for delivery normalization | LLM failures must not block operations | Regex must be kept in sync with catalog |
| **ADR-007** | Auto-trigger analysis on Airflow completion | Removes a click; matches existing manual analyst flow | Requires careful ref-gating to prevent premature fires |

---

## 4. Multi-Agent Topology & Roles

### 4.1 Agent Roster

**Partially Applicable**

v1.0 uses a **single supervisor graph** rather than multiple specialized agents. Within the graph, each node has a focused responsibility that mimics an "agent role":

| Node (Logical Role) | Purpose | Input | Output | Tool Used |
|---------------------|---------|-------|--------|-----------|
| `normalize_delivery` | Map fuzzy user input → canonical delivery ID | `user_message` | `delivery_id` | LLM + regex fallback |
| `lookup_delivery` | Retrieve DAG ID and metadata from DB | `delivery_id` | `dag_id, s3_prefix` | `db_service` |
| `trigger_airflow` | Start the DAG run | `dag_id` | `run_id` | `airflow_service` (SSH) |
| `monitor_airflow` | Poll DAG run status | `run_id` | `task_states` | `airflow_service` |
| `fetch_s3_output` | Pull delivery output file | `s3_prefix` | `file_content` | `s3_service` |
| `reconcile` | Compute expected vs. actual totals | `file_content, db_records` | `reconciliation_summary` | pandas + LLM |
| `answer_followup` | Handle post-reconciliation Q&A | `question, session_state` | `answer` | LLM + tools |

### 4.2 Coordination Pattern

**Applicable — Brief**

**Pattern: Single Supervisor with Conditional Edges** (LangGraph).

- The graph is the supervisor; no separate "supervisor agent."
- Conditional edges route based on state fields (e.g., `if delivery_id is None → ask_clarification`).
- Chosen over multi-agent swarm because: (a) workflow is deterministic enough, (b) debugging is simpler, (c) financial-actions audit trail is clearer with explicit nodes.

### 4.3 Handoff Protocol

**Applicable — Brief**

- State is passed as a single `AgentState` TypedDict across all nodes — no marshalling between agents.
- Each node reads/writes named fields; no ambiguity about what transfers.
- No cross-agent tool calls; all tools are invoked from within the graph.

### 4.4 Conflict Resolution

**NA** — Single supervisor graph has no competing agents; no arbitration needed in v1.

### 4.5 Scaling Rules

**Partially Applicable**

- Nodes run **sequentially** within a session (financial-action safety).
- Multiple sessions run **concurrently** across FastAPI workers (Uvicorn).
- No parallel node execution in v1; future: parallelize `fetch_s3_output` + `db_service` lookup.

---

## 5. LLM Strategy & Model Selection

### 5.1 Model Portfolio

**Applicable — Detailed**

| Role | Model | Cost | Latency | Quality Notes |
|------|-------|------|---------|---------------|
| **Primary** | LLaMA 3.1 8B (self-hosted / Bedrock) | Low (on-prem) or ~$0.0003/1k tok | ~500ms first token | Sufficient for normalization + summarization; structured output works |
| **Fallback (normalization only)** | Regex rules in `_fallback_normalize_delivery()` | Zero | <10ms | Deterministic; covers top ~20 delivery patterns |
| **Future — escalation** | LLaMA 3.1 70B (reserved) | Higher | ~2s | For complex multi-delivery reconciliation Q&A |
| **Embeddings (future RAG)** | `sentence-transformers/all-MiniLM-L6-v2` | Free (CPU) | ~20ms/doc | For delivery catalog semantic search |

### 5.2 Routing Logic

**Applicable — Detailed**

| Condition | Route |
|-----------|-------|
| Short classification / normalization | LLaMA 3.1 8B with 256-tok cap |
| Reconciliation summary (structured output) | LLaMA 3.1 8B with JSON-mode + schema |
| LLM call fails (timeout, 5xx) | Regex fallback for normalization; error-message for summary |
| Ambiguous delivery (confidence < 0.7) | Do NOT call primary — ask clarifying question |
| Long follow-up question | LLaMA 3.1 8B with session-state context |

### 5.3 Provider Abstraction

**Applicable — Brief**

- `llm_service.py` exposes a thin interface: `normalize(text)`, `summarize(facts)`, `answer(question, context)`.
- Underlying client is swappable: OpenAI, Anthropic, Bedrock, local vLLM — all behind the same service methods.
- Swapping from GPT-4.1-mini → LLaMA 3.1 8B required changing only `llm_service.py` client init; no node code changed.

### 5.4 Fine-Tuning & Adaptation

**Applicable — Brief**

- **v1: No fine-tuning.** Prompt engineering + regex fallback + structured output are sufficient.
- **Future trigger for fine-tuning**: normalization accuracy drops below 95% on real traffic, OR when delivery catalog exceeds 200 entries (too many for single prompt).
- **Adaptation today**: few-shot examples of delivery-name patterns in the system prompt; updated when new deliveries are onboarded.

### 5.5 Evaluation & Swap Criteria

**Applicable — Detailed**

| Metric | Threshold to Swap Model |
|--------|-------------------------|
| Normalization accuracy (golden set) | < 95% → escalate to 70B or fine-tune |
| Summary faithfulness (LLM-judge vs. S3 truth) | < 98% → swap |
| P95 latency | > 3s sustained → swap or quantize |
| Cost per session | > $0.25 sustained → swap to smaller model |
| Refusal / safety violations on red-team suite | Any regression > 1% → block release |

**Swap process**: update `llm_service.py` client init → run golden set → shadow in staging for 48h → cut over.

---

# Part III — Behavior & Knowledge

## 6. Prompt Engineering & System Prompts

### 6.1 System Prompt Structure

**Applicable — Detailed**

The agent uses a single canonical system prompt with the following sections, injected at the start of every LangGraph run:

| Block | Content |
|-------|---------|
| **Identity** | "You are the AdminFee Agent, an internal Voya operations copilot for administrative-fee delivery reconciliation." |
| **Capabilities** | Normalize delivery IDs; trigger Airflow DAGs; read S3 outputs; compute reconciliation; answer follow-up questions |
| **Constraints** | Never fabricate fee totals; never trigger DAGs not in the catalog; always cite S3 path or DAG run ID; refuse off-topic requests |
| **Tone** | Short, formal, factual; no emojis; currency as `$x,xxx.xx` |
| **Output format** | JSON-schema for node outputs; plain text for chat replies |
| **Few-shot examples** | 3 normalization examples + 1 reconciliation example (see §6.3) |

Per-node prompts extend the system prompt with the node's specific task (e.g., normalization node adds the delivery catalog snippet).

### 6.2 Prompt Templates & Variables

**Applicable — Detailed**

Templates live in `backend/prompts/` as Python f-strings wrapped by a `PromptTemplate` helper. Variables are injected from `AgentState`.

| Template | File | Key Variables |
|----------|------|---------------|
| `normalize_delivery.md` | `prompts/normalize.py` | `{user_message}`, `{delivery_catalog_snippet}` |
| `reconcile_summary.md` | `prompts/reconcile.py` | `{delivery_id}`, `{expected_total}`, `{actual_total}`, `{file_path}` |
| `followup_answer.md` | `prompts/followup.py` | `{session_history}`, `{question}`, `{tool_results}` |
| `clarification.md` | `prompts/clarify.py` | `{ambiguous_input}`, `{candidate_matches}` |

Templates are versioned via filename suffix (`normalize_v2.md`) — active version configured in `settings.yaml`.

### 6.3 Few-Shot Example Library

**Applicable — Brief**

- **Location**: `backend/prompts/examples/` (plain markdown files, one per pattern).
- **Selection**: Static — the top 3 canonical examples are always included for normalization. Dynamic selection deferred to v2.
- **Refresh**: Analyst-curated — new examples added when a novel delivery-naming pattern produces misclassification in production logs.
- **Sample entries**: `"run prps1 daily" → VRIAC_PRPS1_D`, `"john hancock monthly" → VRIAC_JH_M`, `"PRPS1" → VRIAC_PRPS1_D`.

### 6.4 Prompt Versioning

**Applicable — Brief**

- Each prompt file has a header: `version: 1.2`, `last_updated: 2026-04-15`, `owner: adminfee-eng`.
- Active version pinned in `settings.yaml` under `prompts:`.
- Rollback: change setting value, no code deploy required (hot-reload on boot).
- A/B testing **NA in v1** — single-user ops tool; not enough traffic for statistical A/B.

### 6.5 Anti-Patterns

**Applicable — Brief**

Patterns explicitly avoided in our prompts:

| Anti-Pattern | Why Avoided |
|--------------|-------------|
| Negation overload ("don't do X, don't do Y, don't Z") | LLaMA 8B handles affirmative instructions more reliably |
| Conflicting instructions across blocks | Removes ambiguity in financial-action refusal |
| Long preambles before the task | Wastes tokens; increases latency |
| Asking the LLM to guess when uncertain | Replaced by explicit "if confidence < 0.7, ask clarifying question" |
| Freeform JSON output | Replaced with schema-constrained output via LangChain structured output |

---

## 7. Tool Use & Function Calling

### 7.1 Tool Catalog

**Applicable — Detailed**

| Tool | Schema Summary | Side Effects | Latency | Cost | Owner |
|------|----------------|--------------|---------|------|-------|
| `lookup_delivery(delivery_id)` | in: `str` → out: `{dag_id, s3_prefix, schedule}` | Read-only (MySQL) | ~50ms | ~0 | db_service |
| `trigger_airflow_dag(dag_id)` | in: `str` → out: `{run_id, triggered_at}` | **Writes** — starts Airflow run | 1–3s | ~0 | airflow_service |
| `get_airflow_status(run_id)` | in: `str` → out: `{state, task_states[]}` | Read-only (SSH) | ~500ms | ~0 | airflow_service |
| `list_s3_objects(prefix)` | in: `str` → out: `[{key, size, last_modified}]` | Read-only (S3) | ~200ms | ~$0.0004/1k req | s3_service |
| `get_s3_object(key)` | in: `str` → out: `bytes` | Read-only (S3) | ~500ms | ~$0.0004/1k req + data | s3_service |
| `query_fee_records(delivery_id, date)` | in: `(str, date)` → out: `list[FeeRecord]` | Read-only (MySQL) | ~100ms | ~0 | db_service |
| `compute_reconciliation(file_bytes, db_records)` | in: `(bytes, list)` → out: `ReconciliationResult` | Pure function (pandas) | ~200ms | 0 | reconcile_service |

### 7.2 Tool Schema Conventions

**Applicable — Brief**

| Rule | Convention |
|------|-----------|
| Naming | `verb_noun` (e.g., `trigger_airflow_dag`, `get_s3_object`) |
| Parameters | Primitives + Pydantic models; no free-form dicts |
| Error shape | `{error_code, message, retryable: bool}` |
| Idempotency | Read tools are idempotent; `trigger_airflow_dag` is NOT — deduped by caller via `run_id` check |
| Timeouts | Every tool has explicit timeout; defaults: 5s read, 10s SSH, 30s S3 large read |

### 7.3 Tool Selection Heuristics

**Applicable — Brief**

- LangGraph nodes call tools **deterministically** — the LLM does not choose which tool to call in v1. This is an explicit safety decision for financial actions.
- The LLM is used **inside** nodes to interpret inputs (e.g., normalize text) or generate outputs (summary), not to route between tools.
- Future v2: enable LLM tool-calling for follow-up Q&A only, where the action space is safe (read-only tools).

### 7.4 Parallel vs. Sequential Execution

**Applicable — Brief**

- **Sequential** within a session: normalize → lookup → trigger → monitor → fetch → reconcile.
- Rationale: financial-action ordering matters; each step depends on the previous.
- **Parallel candidates (future)**: `list_s3_objects` + `query_fee_records` can run concurrently once `delivery_id` is known.

### 7.5 Tool Failure Handling

**Applicable — Detailed**

| Tool | Failure Mode | Response |
|------|--------------|----------|
| `lookup_delivery` | Delivery not in catalog | Ask clarifying question; suggest nearest match |
| `trigger_airflow_dag` | SSH timeout / DAG not found | Surface raw error; prompt user to retry; log incident |
| `get_airflow_status` | Transient SSH failure | Retry 3× with exponential backoff (2s/4s/8s); then degrade to "status unavailable" |
| `get_s3_object` | 404 | Tell user the DAG run may not have produced output yet; suggest waiting |
| `get_s3_object` | 403 | Alert — likely credential issue; do NOT retry |
| `compute_reconciliation` | Schema mismatch in CSV | Fail loudly with first bad row; do not silently skip |
| LLM call (`normalize`) | 5xx / timeout | Regex fallback (`_fallback_normalize_delivery`) |
| LLM call (`summarize`) | 5xx / timeout | Return raw numbers + note "LLM summary unavailable" |

---

## 8. Memory Architecture

### 8.1 Memory Types

**Partially Applicable**

| Memory Type | Status in v1 | Detail |
|-------------|-------------|--------|
| **Short-term (context window)** | Applicable | LangGraph `AgentState` carries the full turn's data; context window ~8k tokens |
| **Session memory** | Applicable | In-process dict keyed by `session_id`: `{active_delivery, run_id, s3_paths, last_reconciliation, chat_history}` |
| **Long-term memory** | NA (v1) | No persistence across sessions; deferred to v2 (Redis or MySQL-backed) |
| **Episodic memory** | NA (v1) | No cross-user learning from past interactions |
| **Semantic memory** | Partial | Static delivery catalog in MySQL serves as read-only semantic memory |

### 8.2 Write Path

**Applicable — Brief**

- After every node, updated `AgentState` is written back to the session store via `session_store.update(session_id, state)`.
- Sensitive fields (e.g., SSH keys) are **never** written — they live only in environment variables.
- No user PII is intentionally stored; the agent operates on delivery IDs, DAG IDs, and fee totals only.

### 8.3 Read Path

**Applicable — Brief**

- On every `/chat` request, `session_store.get(session_id)` restores prior state.
- Read is O(1) in memory; no ranking or retrieval logic needed in v1.
- Follow-up Q&A uses the full session state (last delivery, last reconciliation) as injected context.

### 8.4 Forgetting & Expiry

**Applicable — Brief**

- **TTL**: Session state expires after **2 hours of inactivity** (sliding window).
- **Process restart**: In-memory store is cleared; sessions lost (acceptable for v1 ops use).
- **User-initiated reset**: "New session" button in UI clears the session client-side and backend-side.
- **Compliance purge**: Not required in v1 — no PII stored.

### 8.5 Privacy Boundaries

**Applicable — Brief**

- Sessions are isolated by `session_id` (UUID generated client-side).
- No cross-session leakage possible — session store lookup is strict key match.
- Multi-user concurrency: each analyst gets their own session; no shared mutable state.
- Authorization: single-tenant Voya deployment; network-level ACLs limit who can reach FastAPI.

---

## 9. Retrieval-Augmented Generation (RAG)

### 9.1 Corpus & Sources

**Partially Applicable**

v1 does **not** use embedding-based RAG. However, two structured retrieval sources function as RAG-adjacent:

| Source | Type | Purpose |
|--------|------|---------|
| `adminfee.delivery_catalog` (MySQL) | Structured | Delivery ID → DAG ID, S3 prefix, schedule |
| `adminfee.fee_records` (MySQL) | Structured | Per-delivery fee rows for reconciliation |
| S3 output files | Blob | Source of truth for actual fee totals |

### 9.2 Ingestion Pipeline

**NA** — No document-chunking pipeline in v1; data is retrieved live from MySQL and S3 per request.

### 9.3 Embedding Strategy

**NA (v1)** — Future v2 may embed delivery catalog descriptions for fuzzier normalization when catalog exceeds ~200 entries.

### 9.4 Retrieval & Ranking

**Partially Applicable**

- **Today**: SQL `SELECT` with `LIKE` / exact match on delivery ID.
- **Ranking**: Single result expected; tie-breaking by `schedule='D'` preferred over `'M'` when user says "daily" (implied).
- **No vector search, no BM25, no reranker** in v1.

### 9.5 Context Assembly

**Applicable — Brief**

- Retrieved catalog row and fee records are serialized as a small JSON block and injected into the reconciliation prompt.
- Context budget: <1k tokens for retrieved facts; the rest of the 8k window is system prompt + chat history + output.
- Citation: every fact in the summary carries a source tag (`S3:...` or `DB:adminfee.fee_records`).

### 9.6 Evaluation

**Partially Applicable**

- **Recall@k**: NA (deterministic lookup, not retrieval).
- **Faithfulness**: Measured via LLM-judge against S3 source on a golden set of 20 reconciliation cases (target ≥98%).
- **Groundedness**: Every summary must cite S3 path; automated check flags summaries without citation.
- **Answer relevance**: Manual spot-check by ops lead weekly.

---

## 10. Orchestration & Control Flow

### 10.1 Agent Loop

**Applicable — Detailed**

LangGraph StateGraph executes a bounded, explicit loop:

```
START
  │
  ▼
[normalize_delivery] ──(confidence < 0.7)──► [ask_clarification] ──► END (await user)
  │ (confidence ≥ 0.7)
  ▼
[lookup_delivery] ──(not found)──► [report_not_found] ──► END
  │ (found)
  ▼
[trigger_airflow]
  │
  ▼
[monitor_airflow] ◄──┐  (poll loop, max 60 iterations × 5s = 5 min)
  │ (all success)    │
  ▼                  │
[fetch_s3_output]    │
  │                  │
  ▼                  │
[reconcile]          │
  │                  │
  ▼                  │
[summarize] ─────────┘ (only on completion)
  │
  ▼
END
```

Step limits:
- Max 60 monitor iterations (5 min cap) before "timed out — check Airflow manually".
- Max 3 retry attempts on any tool failure.

### 10.2 Planning Strategies

**Partially Applicable**

- **Used**: Explicit state machine (LangGraph) — the plan is pre-encoded in graph edges.
- **Not used**: ReAct (too free-form for financial actions), Plan-and-Execute (unnecessary — workflow is fixed), Tree-of-Thoughts (no branching exploration needed).
- Rationale: the workflow is well-known and deterministic; explicit beats inferred for auditability.

### 10.3 State Machine

**Applicable — Detailed**

`AgentState` TypedDict:
```python
class AgentState(TypedDict):
    session_id: str
    user_message: str
    delivery_id: Optional[str]
    dag_id: Optional[str]
    run_id: Optional[str]
    s3_prefix: Optional[str]
    task_states: Optional[dict]
    file_content: Optional[bytes]
    reconciliation: Optional[ReconciliationResult]
    chat_history: list[ChatTurn]
    errors: list[str]
    next_node: str  # for conditional routing
```

Terminal conditions: `next_node == "END"`, max iterations reached, unrecoverable error.

### 10.4 Interruption & Human-in-the-Loop

**Applicable — Brief**

- **Clarification gate**: when normalization confidence is low, graph halts and emits a clarifying question to the user — user reply re-enters the graph.
- **Explicit approval gate**: **NA in v1** — triggering a DAG is considered safe (triggers an existing, idempotent pipeline). v2 may add approval for destructive operations.
- **Human handoff**: on unrecoverable error, agent outputs a message with the run ID, error, and instructs analyst to open a ticket.

### 10.5 Determinism Levers

**Applicable — Brief**

| Lever | Setting |
|-------|---------|
| Temperature (normalization) | 0.0 |
| Temperature (summary) | 0.2 |
| Temperature (follow-up Q&A) | 0.3 |
| Seed | Fixed `42` for reproducible tests; random in prod |
| Structured output | JSON schema enforced via LangChain `with_structured_output()` on normalize + reconcile |
| Max tokens | 256 (normalize), 1024 (summary), 2048 (follow-up) |

---

_Sections 1–10 complete. Awaiting confirmation to proceed to Section 11._
