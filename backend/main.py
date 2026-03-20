"""FastAPI backend for hunterAI AdminFee Automation System."""

import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Add parent directory for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
    title="hunterAI AdminFee API",
    description="API for AdminFee contract processing and analysis",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response Models ────────────────────────────────────────────────


class ProcessContractsRequest(BaseModel):
    contracts: list[str]
    delivery_name: str
    input_type: str = "manual"


class AnalysisQuestionRequest(BaseModel):
    question: str
    delivery: str
    contracts: Optional[list[str]] = None


class StatusQuestionRequest(BaseModel):
    question: str
    delivery: str


class SQLQueryRequest(BaseModel):
    query: str


class DeliveryRequest(BaseModel):
    delivery: str


# ─── Dashboard Endpoints ─────────────────────────────────────────────────────


@app.get("/api/dashboard/stats")
def dashboard_stats():
    """Get overall dashboard statistics."""
    try:
        status = get_processing_status()
        deliveries = get_deliveries()
        return {
            "processing_status": status,
            "total_deliveries": len(deliveries),
            "deliveries": deliveries[:20],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dashboard/recent-activity")
def recent_activity():
    """Get recent audit activity."""
    try:
        data = get_audit_data()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Contract Processing Endpoints ───────────────────────────────────────────


@app.post("/api/processing/submit")
def submit_contracts(req: ProcessContractsRequest):
    """Submit contracts for processing - inserts into metadata table."""
    try:
        insert_contracts_metadata(req.contracts, req.delivery_name)
        return {
            "status": "success",
            "message": f"Submitted {len(req.contracts)} contracts for delivery '{req.delivery_name}'",
            "contracts": req.contracts,
            "delivery": req.delivery_name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/processing/trigger-pipeline")
def trigger_pipeline():
    """Trigger the Airflow processing pipeline."""
    try:
        from trigger_airflow_dag import trigger_airflow_dag

        trigger_airflow_dag()
        return {"status": "TRIGGERED", "message": "Pipeline triggered successfully"}
    except Exception as e:
        return {"status": "FAILED", "message": str(e)}


@app.get("/api/processing/status")
def processing_status():
    """Get current processing status summary."""
    try:
        status = get_processing_status()
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/processing/contracts")
def processing_contracts():
    """Get all contract processing details."""
    try:
        return get_contract_details()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/processing/status-question")
def ask_status_question(req: StatusQuestionRequest):
    """Ask a natural language question about processing status."""
    try:
        sql = generate_status_query(req.question, req.delivery)
        db_result = run_sql(sql)
        interpretation = interpret_status_result(req.question, db_result)
        return {
            "question": req.question,
            "sql_generated": sql,
            "raw_result": db_result,
            "answer": interpretation,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Contract Analysis Endpoints ─────────────────────────────────────────────


@app.get("/api/analysis/deliveries")
def list_deliveries():
    """Get all available deliveries."""
    try:
        return {"deliveries": get_deliveries()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analysis/normalize-delivery")
def normalize_delivery_name(req: DeliveryRequest):
    """Normalize a delivery name using AI."""
    try:
        normalized = normalize_delivery(req.delivery)
        return {"original": req.delivery, "normalized": normalized}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analysis/contracts")
def get_contracts_for_delivery(req: DeliveryRequest):
    """Get contracts for a specific delivery."""
    try:
        contracts = get_contract_for_delivery(req.delivery)
        return {"delivery": req.delivery, "contracts": contracts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analysis/ask")
def ask_analysis_question(req: AnalysisQuestionRequest):
    """Ask a natural language question about contracts."""
    try:
        contracts = req.contracts
        if not contracts:
            contracts = get_contract_for_delivery(req.delivery)

        if not contracts:
            raise HTTPException(status_code=404, detail="No contracts found for this delivery")

        # Step 1: Generate SQL
        sql = generate_analysis_sql(req.question, contracts)

        # Step 2: Execute SQL
        data = run_sql(sql)
        results = [{"result": data}]

        # Step 3: Analyze results
        analysis = analyze_results(req.question, results)

        # Step 4: Format response
        formatted = format_response(analysis)

        return {
            "question": req.question,
            "contracts": contracts,
            "sql_generated": sql,
            "raw_result": data,
            "analysis": analysis,
            "formatted_answer": formatted,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Reports Endpoints ───────────────────────────────────────────────────────


@app.post("/api/reports/summary")
def contract_summary_report(req: DeliveryRequest):
    """Get reconciliation summary for a delivery's contracts."""
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
    """Get audit data for reports."""
    try:
        return get_audit_data(delivery)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/reports/custom-query")
def custom_query(req: SQLQueryRequest):
    """Execute a custom SQL query (read-only)."""
    query = req.query.strip().upper()
    if not query.startswith("SELECT"):
        raise HTTPException(status_code=400, detail="Only SELECT queries are allowed")
    try:
        return run_sql(req.query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Health Check ─────────────────────────────────────────────────────────────


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "hunterAI AdminFee API"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
