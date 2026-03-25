# High-Level Design (HLD) Document

## hunterAI GPO AdminFee Reconciliation Agent

| Field            | Value                              |
|------------------|------------------------------------|
| **Project Name** | hunterAI GPO AdminFee Agent        |
| **Version**      | 1.0.0                              |
| **Date**         | March 2026                         |
| **Author**       | hunterAI Engineering Team          |
| **Status**       | Development                        |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Overview](#2-system-overview)
3. [Architecture Diagram](#3-architecture-diagram)
4. [Technology Stack](#4-technology-stack)
5. [Component Overview](#5-component-overview)
6. [Data Flow](#6-data-flow)
7. [Database Design (High Level)](#7-database-design-high-level)
8. [API Design (High Level)](#8-api-design-high-level)
9. [Security Architecture](#9-security-architecture)
10. [Deployment Architecture](#10-deployment-architecture)
11. [Non-Functional Requirements](#11-non-functional-requirements)

---

## 1. Introduction

### 1.1 Purpose

This document describes the High-Level Design (HLD) of the **hunterAI GPO AdminFee Reconciliation Agent** — an AI-powered web application that automates Group Purchasing Organization (GPO) contract processing, real-time monitoring, and data analysis using conversational AI agents.

### 1.2 Scope

The system covers:
- Automated contract ingestion (manual entry or S3 file upload)
- ETL pipeline orchestration via Apache Airflow
- Real-time processing status monitoring with AI-powered Q&A
- Contract spend reconciliation and natural language analytics
- Multi-panel web interface for end-to-end workflow

### 1.3 Intended Audience

- Solution Architects
- Development Team
- QA Engineers
- Project Managers
- Business Analysts

### 1.4 Glossary

| Term       | Description                                        |
|------------|----------------------------------------------------|
| GPO        | Group Purchasing Organization                      |
| AdminFee   | Administrative fee charged on GPO contracts        |
| PO         | Purchase Order                                     |
| Delivery   | A batch processing run identifier                  |
| LangGraph  | Agent orchestration framework by LangChain         |
| DAG        | Directed Acyclic Graph (Airflow pipeline unit)     |
| Reconciliation | Comparing PO spend vs AdminFee report spend   |

---

## 2. System Overview

The system is a **three-panel web application** that provides an end-to-end workflow for GPO AdminFee contract reconciliation:

```
+-------------------------------------------------------------------+
|                      hunterAI AdminFee Agent                       |
+-------------------------------------------------------------------+
|                        HEADER BAR                                  |
|                  (Active Delivery Display)                         |
+---------------------+-------------------+-------------------------+
|     PANEL 1         |     PANEL 2       |       PANEL 3           |
|  Processing Agent   |  Status Monitor   |   Analysis Chat         |
|                     |                   |                         |
|  - Contract Input   |  - Progress Bar   |  - Delivery Selection   |
|  - Delivery Name    |  - Contract Table |  - Reconciliation       |
|  - Pipeline Trigger |  - AI Status Q&A  |  - NL Question Answer   |
|  - Confirmation     |  - Auto-Refresh   |  - SQL + Raw Data View  |
+---------------------+-------------------+-------------------------+
```

### 2.1 Key Capabilities

1. **Conversational Contract Processing** — Step-by-step guided workflow via chat interface
2. **Automated Pipeline Orchestration** — Triggers Airflow DAGs for ETL processing
3. **Real-Time Status Monitoring** — Auto-refreshing dashboard with AI-powered Q&A
4. **LLM-Powered Analytics** — Natural language to SQL generation for contract analysis
5. **Spend Reconciliation** — Automated PO vs AdminFee report comparison

---

## 3. Architecture Diagram

### 3.1 System Architecture

```
                           +------------------+
                           |   End User       |
                           |   (Browser)      |
                           +--------+---------+
                                    |
                                    | HTTP (Port 3000)
                                    v
                          +-------------------+
                          |  React Frontend   |
                          |  (Vite Dev Server) |
                          |  - AgentChatPanel |
                          |  - StatusMonitor  |
                          |  - AnalysisPanel  |
                          +--------+----------+
                                   |
                                   | /api/* (Proxy to :8000)
                                   v
                          +-------------------+
                          |  FastAPI Backend  |
                          |  (Uvicorn ASGI)   |
                          |  - REST Endpoints |
                          |  - Session Mgmt   |
                          |  - LLM Service    |
                          +---+------+--------+
                              |      |
                 +------------+      +------------+
                 |                                |
                 v                                v
      +-------------------+            +-------------------+
      |  OpenAI GPT-4.1   |            |  MySQL (AWS RDS)  |
      |  (via LangChain)  |            |  - joblog_metadata|
      |  - SQL Generation |            |  - admin_fee      |
      |  - Analysis       |            +-------------------+
      |  - Formatting     |
      +-------------------+
                                       +-------------------+
                                       |  Apache Airflow   |
                                       |  (EC2 Instance)   |
                                       |  - ETL DAGs       |
                                       +-------------------+

                                       +-------------------+
                                       |  AWS S3           |
                                       |  - Input Files    |
                                       |  - Output Reports |
                                       +-------------------+
```

### 3.2 Communication Patterns

| From           | To              | Protocol     | Purpose                     |
|----------------|-----------------|--------------|-----------------------------|
| Browser        | React App       | HTTP/3000    | Serve frontend              |
| React App      | FastAPI         | HTTP/8000    | REST API calls (proxied)    |
| FastAPI        | OpenAI API      | HTTPS        | LLM inference               |
| FastAPI        | MySQL RDS       | TCP/3306     | Database queries            |
| FastAPI        | Airflow (EC2)   | SSH/22       | Trigger DAG execution       |
| FastAPI        | AWS S3          | HTTPS        | File upload/download        |

---

## 4. Technology Stack

### 4.1 Frontend

| Component       | Technology        | Version  |
|-----------------|-------------------|----------|
| UI Library      | React             | 18.3     |
| Build Tool      | Vite              | 5.4      |
| Styling         | Custom CSS        | -        |
| State Mgmt      | React Hooks       | -        |
| HTTP Client     | Fetch API         | Native   |

### 4.2 Backend

| Component       | Technology        | Version  |
|-----------------|-------------------|----------|
| Web Framework   | FastAPI           | 0.115.0  |
| ASGI Server     | Uvicorn           | 0.30.0   |
| ORM             | SQLAlchemy        | 2.0.35   |
| DB Driver       | PyMySQL           | 1.1.1    |
| LLM Integration | LangChain-OpenAI  | 0.2.0    |
| Agent Framework | LangGraph         | 0.2.0    |
| Data Processing | Pandas            | 2.2.2    |
| Excel Handling  | Openpyxl          | 3.1.5    |
| Validation      | Pydantic          | 2.9.0    |
| Encryption      | Cryptography      | 43.0.0   |
| SSH Client      | Paramiko          | 3.4.0    |
| AWS SDK         | Boto3             | 1.35.0   |
| WebSockets      | websockets        | 12.0     |

### 4.3 Infrastructure

| Component       | Technology        |
|-----------------|-------------------|
| Database        | AWS RDS (MySQL)   |
| File Storage    | AWS S3            |
| Pipeline Engine | Apache Airflow    |
| Compute         | AWS EC2           |
| LLM Provider    | OpenAI GPT-4.1-mini |

---

## 5. Component Overview

### 5.1 Frontend Components

```
App.jsx (Root)
├── AgentChatPanel.jsx      ← Panel 1: Guided contract processing
├── StatusMonitorPanel.jsx   ← Panel 2: Real-time status dashboard
├── AnalysisPanel.jsx        ← Panel 3: NL analysis & reconciliation
├── MarkdownRenderer.jsx     ← Shared: Markdown-to-HTML renderer
└── services/api.js          ← Shared: API client layer
```

| Component            | Responsibility                                         |
|----------------------|--------------------------------------------------------|
| **AgentChatPanel**   | Step-by-step chat to submit contracts and trigger pipeline |
| **StatusMonitorPanel** | Auto-refreshing status cards, progress bar, contract table, AI Q&A |
| **AnalysisPanel**    | Delivery selection, reconciliation reports, NL question answering |
| **MarkdownRenderer** | Parse markdown (bold, code, tables, lists) into HTML   |
| **api.js**           | Centralized API call functions with error handling      |

### 5.2 Backend Modules

| Module              | Responsibility                                          |
|---------------------|---------------------------------------------------------|
| **main.py**         | FastAPI app, REST endpoints, session management         |
| **database.py**     | SQLAlchemy connection pool, query execution, DB helpers  |
| **llm_service.py**  | LLM orchestration — SQL gen, analysis, formatting       |
| **prompts/**        | System prompt templates for each LLM task               |

### 5.3 CLI Agents (Standalone)

| Module                          | Responsibility                                |
|---------------------------------|-----------------------------------------------|
| **adminFee_Master_agent.py**    | CLI menu — routes to processing or analysis   |
| **adminfee_processing_agent.py**| LangGraph workflow — full processing pipeline |
| **contract_analyst_agent_cot.py** | LangGraph workflow — NL analysis loop       |

### 5.4 Utilities

| Module                       | Responsibility                          |
|------------------------------|-----------------------------------------|
| **tools.py**                 | Shared SQL execution helpers            |
| **trigger_airflow_dag.py**   | SSH/subprocess Airflow DAG trigger      |
| **extract_input_template_S3.py** | Download contract input from S3     |
| **readEncryptedConfig.py**   | Decrypt database credentials            |
| **readMetadata.py**          | Read AWS credentials from DB            |
| **decryption.py**            | Fernet symmetric decryption utility     |

---

## 6. Data Flow

### 6.1 End-to-End Processing Flow

```
Step 1: CONTRACT SUBMISSION (Panel 1)
  User → selects input type (manual/file)
       → enters contract names (or uploads from S3)
       → provides delivery name
       → confirms details
       → triggers pipeline

Step 2: METADATA UPDATE
  Backend → TRUNCATE admin_fee_metadata
          → INSERT contracts with STATUS = 1

Step 3: PIPELINE EXECUTION
  Backend → SSH to Airflow EC2
          → Trigger DAG: execute_adminFee_Data_Pipeline_v1
          → Airflow processes contracts
          → STATUS: 1 → 2 (SQL done) → 0 (completed)

Step 4: STATUS MONITORING (Panel 2)
  Frontend → polls /api/status/summary every 30 seconds
           → displays progress bar + contract table
           → user can ask AI questions about status
           → fires callback when all STATUS = 0

Step 5: ANALYSIS & RECONCILIATION (Panel 3)
  Auto-triggered when processing completes:
  → Normalize delivery name via LLM
  → Fetch contracts for delivery
  → Run reconciliation query (PO vs Report)
  → Display summary with spend comparison
  → Accept follow-up NL questions
```

### 6.2 LLM Interaction Flow

```
User Question
     │
     ▼
┌─────────────────────┐
│ SQL Generation       │  (sql_generator.txt prompt)
│ NL → MySQL SELECT    │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ SQL Execution        │  (SQLAlchemy → MySQL)
│ Returns {cols, rows} │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Result Analysis      │  (contract_analyst_prompt.txt)
│ Raw data → Insights  │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│ Response Formatting  │  (response_formatter.txt)
│ Technical → Business │
└──────────┬──────────┘
           ▼
   Formatted Answer
```

---

## 7. Database Design (High Level)

### 7.1 Database Instances

| Database           | Purpose                              |
|--------------------|--------------------------------------|
| **joblog_metadata**| System metadata, audit, config       |
| **admin_fee**      | Contract data, PO masters, reports   |

### 7.2 Key Tables

| Table                              | Database         | Purpose                          |
|------------------------------------|------------------|----------------------------------|
| `admin_fee_metadata`               | joblog_metadata  | Processing status tracking       |
| `adminfee_audit_data`              | joblog_metadata  | Audit trail with file paths      |
| `metadata_table_database`          | joblog_metadata  | AWS credential storage           |
| `PO_Master_{CONTRACT}_{VERSION}`   | admin_fee        | Per-contract spend data          |
| `admin_fee_report`                 | admin_fee        | Aggregated report data           |

### 7.3 Status State Machine

```
  ┌───────────┐     Pipeline      ┌───────────┐     Excel Gen    ┌───────────┐
  │ STATUS = 1│ ───────────────►  │ STATUS = 2│ ──────────────► │ STATUS = 0│
  │  Ready    │     Processing    │  SQL Done │    Complete      │ Completed │
  └───────────┘                   └───────────┘                  └───────────┘
```

---

## 8. API Design (High Level)

### 8.1 Endpoint Groups

| Group        | Base Path          | Purpose                       |
|--------------|--------------------|-------------------------------|
| Agent        | `/api/agent/*`     | Processing chat workflow      |
| Status       | `/api/status/*`    | Live status monitoring        |
| Analysis     | `/api/analysis/*`  | NL contract analysis          |
| Reports      | `/api/reports/*`   | Reconciliation & audit        |
| Health       | `/api/health`      | Service health check          |

### 8.2 Endpoint Summary

| Method | Endpoint                       | Description                     |
|--------|--------------------------------|---------------------------------|
| POST   | `/api/agent/start`             | Start new processing session    |
| POST   | `/api/agent/chat`              | Continue chat conversation      |
| GET    | `/api/status/summary`          | Get status counts               |
| GET    | `/api/status/contracts`        | Get contract-level details      |
| POST   | `/api/status/ask`              | AI-powered status Q&A           |
| GET    | `/api/analysis/deliveries`     | List available deliveries       |
| POST   | `/api/analysis/setup`          | Initialize analysis session     |
| POST   | `/api/analysis/ask`            | NL question answering           |
| POST   | `/api/reports/reconciliation`  | Generate reconciliation report  |
| GET    | `/api/reports/audit`           | Get audit trail                 |
| GET    | `/api/health`                  | Health check                    |

---

## 9. Security Architecture

### 9.1 Credential Management

```
┌──────────────┐     Read Key     ┌──────────────┐
│  Paths.xls   │ ──────────────►  │ Fernet Key   │
│ (key path)   │                  │ (on disk)    │
└──────────────┘                  └──────┬───────┘
                                         │ Decrypt
                                         ▼
                                  ┌──────────────┐
                                  │ Encrypted CSV│
                                  │ (DB creds)   │
                                  └──────┬───────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │ {host, user, │
                                  │  password,   │
                                  │  database}   │
                                  └──────────────┘
```

### 9.2 Security Controls

| Layer         | Mechanism                                      |
|---------------|------------------------------------------------|
| Encryption    | Fernet symmetric encryption for credentials    |
| SSH           | PEM key-based authentication for Airflow       |
| DB Connection | SQLAlchemy connection pooling with pre-ping     |
| API           | CORS middleware (configurable origins)          |
| Queries       | Parameterized queries via SQLAlchemy            |

---

## 10. Deployment Architecture

### 10.1 Runtime Environment

```
┌─────────────────────────────────────────────────────────┐
│                   Application Server                     │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────────────┐   │
│  │  Vite Dev Server  │    │  Uvicorn ASGI Server     │   │
│  │  Port: 3000       │───►│  Port: 8000              │   │
│  │  (React Frontend) │    │  (FastAPI Backend)       │   │
│  └──────────────────┘    └──────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
           │                          │
           │                 ┌────────┴────────┐
           │                 │                 │
           ▼                 ▼                 ▼
     ┌───────────┐   ┌───────────┐    ┌──────────────┐
     │  AWS S3   │   │ AWS RDS   │    │ EC2 Airflow  │
     │  Bucket   │   │ MySQL     │    │  Instance    │
     └───────────┘   └───────────┘    └──────────────┘
```

### 10.2 Startup

| Platform | Script       | Process                                |
|----------|--------------|----------------------------------------|
| Linux    | `start.sh`   | Runs backend + frontend in background  |
| Windows  | `start.bat`  | Validates deps, opens separate windows |

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Metric                  | Target               |
|-------------------------|----------------------|
| API Response Time       | < 2 seconds          |
| LLM Response Time       | < 10 seconds         |
| Status Polling Interval | 30 seconds           |
| DB Connection Pool      | Recycled every 3600s |

### 11.2 Scalability

- Session-based state (in-memory) — suitable for single-instance deployment
- Database connection pooling for concurrent queries
- Stateless API design (except session store)

### 11.3 Availability

- Health check endpoint for monitoring
- Database pre-ping for connection validation
- Graceful error handling with user-friendly messages

### 11.4 Maintainability

- Prompt templates externalized in `/prompts` directory
- Modular backend (database, LLM, API layers separated)
- Reusable frontend components

---

*End of HLD Document*
