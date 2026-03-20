"""
FastAPI backend for hunterAI GPO AdminFee Reconciliation Agent.

Three main workflows exposed as conversational APIs:
  1. Processing Agent Chat - step-by-step contract submission & pipeline trigger
  2. Status Monitor - live processing status + AI-powered status Q&A
  3. Contract Analysis Chat - natural language Q&A on existing contracts
"""

import os
import sys
import uuid
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Ensure project root is on path (works on both Windows and Linux)
PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
sys.path.insert(0, PROJECT_ROOT)

# Load .env file if it exists (for Windows local dev)
env_file = Path(PROJECT_ROOT) / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

from backend.database import (
    run_sql,
    get_contract_for_delivery,
    get_processing_status,
    get_contract_details,
    get_deliveries,
    insert_contracts_metadata,
    get_contract_summary,
    get_audit_data,
)
from backend.llm_service import (
    normalize_delivery,
    generate_analysis_sql,
    analyze_results,
    format_response,
    generate_status_query,
    interpret_status_result,
    format_summary,
)

app = FastAPI(
    title="hunterAI GPO AdminFee Reconciliation API",
    description="Conversational API for GPO AdminFee contract processing, monitoring, and analysis",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-Memory Session Store ─────────────────────────────────────────────────
# Tracks conversational state for each active processing session
sessions = {}


# ─── Request Models ───────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    session_id: Optional[str] = None
    message: str


class StatusQuestion(BaseModel):
    question: str
    delivery: str


class AnalysisSetup(BaseModel):
    delivery: str


class AnalysisQuestion(BaseModel):
    question: str
    delivery: str
    contracts: Optional[list[str]] = None


class SubmitContracts(BaseModel):
    contracts: list[str]
    delivery_name: str
    input_type: str = "manual"


# ─── PANEL 1: Processing Agent Chat ──────────────────────────────────────────
# Mirrors the conversational flow of adminfee_processing_agent.py
# Steps: greeting -> input_type -> contracts -> delivery -> confirm -> submit -> trigger

@app.post("/api/agent/start")
def agent_start():
    """Start a new processing agent session. Returns greeting and first prompt."""
    session_id = str(uuid.uuid4())[:8]
    sessions[session_id] = {
        "step": "input_type",
        "input_type": None,
        "contracts": None,
        "contracts_list": [],
        "delivery_name": None,
        "job_status": None,
    }
    return {
        "session_id": session_id,
        "agent_message": (
            "Hi! I am the **AdminFee Automation Agent**.\n\n"
            "I will help you process GPO contracts and generate reconciliation reports.\n\n"
            "How would you like to provide the contract information?\n\n"
            "Type **manual** to enter contract names directly, or **file** to upload from S3."
        ),
        "step": "input_type",
        "expecting": "manual or file",
    }


@app.post("/api/agent/chat")
def agent_chat(msg: ChatMessage):
    """
    Continue the processing agent conversation.
    The agent walks the user through each step, just like the CLI.
    """
    sid = msg.session_id
    if not sid or sid not in sessions:
        raise HTTPException(status_code=400, detail="Invalid session. Please start a new session.")

    session = sessions[sid]
    user_input = msg.message.strip()
    step = session["step"]

    # ── Step 1: Input Type ────────────────────────────────────────────────
    if step == "input_type":
        choice = user_input.lower()
        if choice not in ("manual", "file"):
            return {
                "session_id": sid,
                "agent_message": "Invalid choice. Please type **manual** or **file**.",
                "step": "input_type",
                "expecting": "manual or file",
            }
        session["input_type"] = choice

        if choice == "file":
            session["step"] = "contracts_file"
            return {
                "session_id": sid,
                "agent_message": (
                    "Please place your Excel file in the S3 bucket:\n\n"
                    "```\ns3://etlhunter/adminfee_input/contracts.xlsx\n```\n\n"
                    "**Requirements:**\n"
                    "1. File name must be exactly: `contracts.xlsx`\n"
                    "2. File should be closed (not open in Excel)\n"
                    "3. Column name should be: `contract_name`\n\n"
                    "After placing the file, type **done**. Or enter contract names manually below:"
                ),
                "step": "contracts_file",
                "expecting": "done or contract names",
            }
        else:
            session["step"] = "contracts_manual"
            return {
                "session_id": sid,
                "agent_message": (
                    "Please enter the contract names.\n\n"
                    "You can enter multiple contracts separated by commas.\n\n"
                    "**Example:** `PP-OR-123, PP-NS-345, PP-QQ-678`"
                ),
                "step": "contracts_manual",
                "expecting": "contract names (comma separated)",
            }

    # ── Step 2a: Contracts - File mode ────────────────────────────────────
    if step == "contracts_file":
        if user_input.lower() == "done":
            session["contracts"] = "FILE_INPUT"
            session["step"] = "delivery"
            return {
                "session_id": sid,
                "agent_message": "File noted. I'll read contracts from the S3 file.\n\nPlease enter the **delivery name**:",
                "step": "delivery",
                "expecting": "delivery name",
            }
        else:
            # User typed contracts manually even in file mode
            contracts_list = [c.strip() for c in user_input.split(",") if c.strip()]
            if not contracts_list:
                return {
                    "session_id": sid,
                    "agent_message": "No valid contracts found. Please enter contracts separated by commas, or type **done** if file is ready.",
                    "step": "contracts_file",
                    "expecting": "done or contract names",
                }
            session["contracts"] = user_input
            session["contracts_list"] = contracts_list
            session["step"] = "delivery"
            return {
                "session_id": sid,
                "agent_message": f"Got **{len(contracts_list)} contracts**: {', '.join(contracts_list)}\n\nPlease enter the **delivery name**:",
                "step": "delivery",
                "expecting": "delivery name",
            }

    # ── Step 2b: Contracts - Manual mode ──────────────────────────────────
    if step == "contracts_manual":
        contracts_list = [c.strip() for c in user_input.split(",") if c.strip()]
        if not contracts_list:
            return {
                "session_id": sid,
                "agent_message": "No valid contracts found. Please enter at least one contract name.",
                "step": "contracts_manual",
                "expecting": "contract names (comma separated)",
            }
        session["contracts"] = user_input
        session["contracts_list"] = contracts_list
        session["step"] = "delivery"
        return {
            "session_id": sid,
            "agent_message": f"Got **{len(contracts_list)} contracts**: {', '.join(contracts_list)}\n\nPlease enter the **delivery name**:",
            "step": "delivery",
            "expecting": "delivery name",
        }

    # ── Step 3: Delivery Name ─────────────────────────────────────────────
    if step == "delivery":
        if not user_input:
            return {
                "session_id": sid,
                "agent_message": "Delivery name cannot be empty. Please enter the delivery name:",
                "step": "delivery",
                "expecting": "delivery name",
            }
        session["delivery_name"] = user_input
        session["step"] = "confirm"

        contracts_display = ', '.join(session["contracts_list"]) if session["contracts_list"] else session["contracts"]
        return {
            "session_id": sid,
            "agent_message": (
                "**Please confirm the details:**\n\n"
                f"| Field | Value |\n"
                f"|-------|-------|\n"
                f"| Input Type | {session['input_type']} |\n"
                f"| Contracts | {contracts_display} |\n"
                f"| Delivery Name | {session['delivery_name']} |\n\n"
                "Type **yes** to submit and trigger the pipeline, or **no** to start over."
            ),
            "step": "confirm",
            "expecting": "yes or no",
        }

    # ── Step 4: Confirmation ──────────────────────────────────────────────
    if step == "confirm":
        if user_input.lower() in ("yes", "y"):
            # Submit to database
            try:
                contracts_to_insert = session["contracts_list"]
                if not contracts_to_insert and session["contracts"] == "FILE_INPUT":
                    # In real flow, would read from S3 here
                    return {
                        "session_id": sid,
                        "agent_message": "File mode: contracts would be loaded from S3. For now, please provide contracts manually.",
                        "step": "contracts_file",
                        "expecting": "contract names",
                    }

                insert_contracts_metadata(contracts_to_insert, session["delivery_name"])
                session["step"] = "trigger"

                return {
                    "session_id": sid,
                    "agent_message": (
                        "**Contracts submitted to metadata table successfully!**\n\n"
                        f"Inserted {len(contracts_to_insert)} contracts for delivery `{session['delivery_name']}`.\n\n"
                        "Type **trigger** to start the Airflow processing pipeline, or **skip** to skip."
                    ),
                    "step": "trigger",
                    "expecting": "trigger or skip",
                }
            except Exception as e:
                return {
                    "session_id": sid,
                    "agent_message": f"Error submitting contracts: {str(e)}\n\nPlease try again or type **restart** to start over.",
                    "step": "confirm",
                    "expecting": "yes or no or restart",
                }
        elif user_input.lower() in ("no", "n", "restart"):
            sessions[sid] = {
                "step": "input_type",
                "input_type": None,
                "contracts": None,
                "contracts_list": [],
                "delivery_name": None,
                "job_status": None,
            }
            return {
                "session_id": sid,
                "agent_message": "Restarting...\n\nHow would you like to provide the contract information?\n\nType **manual** or **file**.",
                "step": "input_type",
                "expecting": "manual or file",
            }
        else:
            return {
                "session_id": sid,
                "agent_message": "Please type **yes** to confirm or **no** to start over.",
                "step": "confirm",
                "expecting": "yes or no",
            }

    # ── Step 5: Trigger Pipeline ──────────────────────────────────────────
    if step == "trigger":
        if user_input.lower() == "trigger":
            try:
                from trigger_airflow_dag import trigger_airflow_dag
                trigger_airflow_dag()
                session["job_status"] = "TRIGGERED"
                session["step"] = "done"
                return {
                    "session_id": sid,
                    "agent_message": (
                        "**Pipeline triggered successfully!**\n\n"
                        f"Delivery: `{session['delivery_name']}`\n"
                        f"Status: TRIGGERED\n\n"
                        "You can now switch to the **Status Monitor** panel to track processing progress.\n\n"
                        "Once processing completes, use the **Analysis** panel to query your contract data."
                    ),
                    "step": "done",
                    "expecting": None,
                    "delivery": session["delivery_name"],
                    "contracts": session["contracts_list"],
                }
            except Exception as e:
                session["job_status"] = "FAILED"
                session["step"] = "done"
                return {
                    "session_id": sid,
                    "agent_message": f"Pipeline trigger failed: {str(e)}\n\nPlease check Airflow manually. You can still use the **Status Monitor** to check progress.",
                    "step": "done",
                    "expecting": None,
                    "delivery": session["delivery_name"],
                }
        elif user_input.lower() == "skip":
            session["step"] = "done"
            return {
                "session_id": sid,
                "agent_message": (
                    "Pipeline trigger skipped.\n\n"
                    "Contracts have been inserted into the metadata table.\n"
                    "You can trigger the pipeline manually or use the **Status Monitor** panel."
                ),
                "step": "done",
                "expecting": None,
                "delivery": session["delivery_name"],
            }
        else:
            return {
                "session_id": sid,
                "agent_message": "Type **trigger** to start the pipeline, or **skip** to skip.",
                "step": "trigger",
                "expecting": "trigger or skip",
            }

    # ── Done ──────────────────────────────────────────────────────────────
    if step == "done":
        return {
            "session_id": sid,
            "agent_message": (
                "This session is complete. You can:\n\n"
                "- Use the **Status Monitor** panel to check processing progress\n"
                "- Use the **Analysis** panel to query processed contracts\n"
                "- Click **New Session** to process more contracts"
            ),
            "step": "done",
            "expecting": None,
        }

    return {
        "session_id": sid,
        "agent_message": "Something went wrong. Please start a new session.",
        "step": "error",
    }


# ─── PANEL 2: Status Monitor ─────────────────────────────────────────────────
# Mirrors ai_status_monitor_node - polling status + AI Q&A

@app.get("/api/status/summary")
def status_summary():
    """Get current processing status (total, completed, in_progress)."""
    try:
        return get_processing_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/status/contracts")
def status_contracts():
    """Get detailed contract-level status."""
    try:
        return get_contract_details()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/status/ask")
def status_ask(req: StatusQuestion):
    """Ask a natural language question about processing status (AI-powered)."""
    try:
        sql = generate_status_query(req.question, req.delivery)
        db_result = run_sql(sql)
        answer = interpret_status_result(req.question, db_result)
        return {
            "question": req.question,
            "sql_generated": sql,
            "raw_data": db_result,
            "answer": answer,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── PANEL 3: Contract Analysis Chat ─────────────────────────────────────────
# Mirrors contract_analyst_agent_cot.py - delivery selection + NL Q&A

@app.get("/api/analysis/deliveries")
def list_deliveries():
    """Get all available deliveries for analysis."""
    try:
        return {"deliveries": get_deliveries()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analysis/setup")
def analysis_setup(req: AnalysisSetup):
    """
    Set up analysis session: normalize delivery name + fetch contracts.
    Mirrors ask_delivery_node + fetch_contracts_node.
    """
    try:
        # Step 1: Normalize delivery name via LLM
        normalized = normalize_delivery(req.delivery)

        # Step 2: Fetch contracts for this delivery
        contracts = get_contract_for_delivery(normalized)

        if not contracts:
            return {
                "delivery_original": req.delivery,
                "delivery_normalized": normalized,
                "contracts": [],
                "message": f"No contracts found for delivery '{normalized}'.",
            }

        return {
            "delivery_original": req.delivery,
            "delivery_normalized": normalized,
            "contracts": contracts,
            "message": f"Found {len(contracts)} contracts for delivery '{normalized}'.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analysis/ask")
def analysis_ask(req: AnalysisQuestion):
    """
    Ask a natural language question about contracts.
    Mirrors the 3-step pipeline: SQL Generation -> Analysis -> Formatting.
    """
    try:
        contracts = req.contracts
        if not contracts:
            contracts = get_contract_for_delivery(req.delivery)
        if not contracts:
            raise HTTPException(status_code=404, detail="No contracts found for this delivery")

        # Step 1: SQL Generation (LLM)
        sql = generate_analysis_sql(req.question, contracts)

        # Step 2: SQL Execution
        data = run_sql(sql)
        results = [{"result": data}]

        # Step 3: Analysis (LLM)
        analysis = analyze_results(req.question, results)

        # Step 4: Response Formatting (LLM)
        formatted = format_response(analysis)

        return {
            "question": req.question,
            "contracts": contracts,
            "sql_generated": sql,
            "raw_data": data,
            "analysis": analysis,
            "formatted_answer": formatted,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Reports / Reconciliation ────────────────────────────────────────────────

@app.post("/api/reports/reconciliation")
def reconciliation_report(req: AnalysisSetup):
    """
    Generate reconciliation summary: PO Master vs AdminFee Report.
    Mirrors contract_summary_node + summary_report_node.
    """
    try:
        contracts = get_contract_for_delivery(req.delivery)
        if not contracts:
            raise HTTPException(status_code=404, detail="No contracts found for this delivery")

        summary = get_contract_summary(contracts)
        formatted = format_summary(summary)

        return {
            "delivery": req.delivery,
            "contracts": contracts,
            "summary": summary,
            "formatted_report": formatted,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports/audit")
def audit_report(delivery: Optional[str] = None):
    """Get audit trail data."""
    try:
        return get_audit_data(delivery)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "healthy", "service": "hunterAI GPO AdminFee Reconciliation API", "version": "2.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
