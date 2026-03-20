"""Database connection and query utilities for the AdminFee API."""

import os
from sqlalchemy import create_engine, text

DB_URI = os.getenv(
    "DB_URI",
    "mysql+pymysql://kishore:Gpohealth!#!@dev-db-test.c969yoyq9cyy.us-east-1.rds.amazonaws.com:3306/joblog_metadata",
)

engine = create_engine(DB_URI, pool_pre_ping=True, pool_recycle=3600)

TABLE_NAME = "admin_fee_metadata"


def run_sql(query: str):
    """Execute a SQL query and return columns + rows."""
    with engine.begin() as conn:
        result = conn.execute(text(query))
        rows = result.fetchall()
        cols = list(result.keys())
    return {"columns": cols, "rows": [list(r) for r in rows]}


def run_sql_params(query: str, params: dict):
    """Execute a parameterized SQL query."""
    with engine.begin() as conn:
        result = conn.execute(text(query), params)
        rows = result.fetchall()
        cols = list(result.keys())
    return {"columns": cols, "rows": [list(r) for r in rows]}


def get_contract_for_delivery(delivery: str):
    """Get contracts list for a given delivery."""
    sql = "SELECT contract_name FROM joblog_metadata.adminfee_audit_data WHERE delivery = :delivery"
    with engine.begin() as conn:
        result = conn.execute(text(sql), {"delivery": delivery})
        rows = result.fetchall()
    return [r[0] for r in rows]


def get_processing_status():
    """Get current processing status summary."""
    sql = f"""
    SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN STATUS = 0 THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN STATUS != 0 THEN 1 ELSE 0 END) AS in_progress
    FROM {TABLE_NAME}
    """
    with engine.begin() as conn:
        result = conn.execute(text(sql)).fetchone()
    if result:
        return {"total": result[0] or 0, "completed": result[1] or 0, "in_progress": result[2] or 0}
    return {"total": 0, "completed": 0, "in_progress": 0}


def get_contract_details():
    """Get all contract records with status."""
    sql = f"SELECT CONTRACT_NAME, DELIVERY, STATUS FROM {TABLE_NAME}"
    with engine.begin() as conn:
        result = conn.execute(text(sql))
        rows = result.fetchall()
        cols = list(result.keys())
    return {"columns": cols, "rows": [list(r) for r in rows]}


def get_deliveries():
    """Get all unique deliveries from audit data."""
    sql = "SELECT DISTINCT delivery FROM joblog_metadata.adminfee_audit_data ORDER BY delivery"
    with engine.begin() as conn:
        result = conn.execute(text(sql))
        rows = result.fetchall()
    return [r[0] for r in rows]


def insert_contracts_metadata(contracts: list, delivery: str):
    """Truncate and insert contracts into metadata table."""
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE TABLE {TABLE_NAME}"))
        for contract in contracts:
            conn.execute(
                text(f"INSERT INTO {TABLE_NAME}(CONTRACT_NAME, DELIVERY) VALUES(:contract, :delivery)"),
                {"contract": contract, "delivery": delivery},
            )
    return True


def get_contract_summary(contracts: list):
    """Get reconciliation summary for contracts."""
    summary = []
    for contract in contracts:
        contract2 = contract.replace("-", "_").strip()
        table = f"admin_fee.PO_Master_{contract2}_v1"

        po_sql = f"""
        SELECT SUM(PO_Base_Spend_actual) AS PO_SPEND,
               SUM(INV_Extended_Spend_actual) AS INV_SPEND
        FROM {table}"""

        report_sql = """
        SELECT SUM(Sales_Volume) AS SALES_VOLUME
        FROM admin_fee.admin_fee_report
        WHERE `Contract ID`=:contract_id"""

        try:
            with engine.begin() as conn:
                po_result = conn.execute(text(po_sql)).mappings().fetchone()
                report_result = conn.execute(text(report_sql), {"contract_id": contract}).mappings().fetchone()

            po_spend = float(po_result["PO_SPEND"] or 0)
            inv_spend = float(po_result["INV_SPEND"] or 0)
            selected_spend = max(po_spend, inv_spend)

            report_spend = None
            if report_result:
                report_spend = float(report_result["SALES_VOLUME"] or 0) if report_result["SALES_VOLUME"] else None

            if report_spend is None:
                status = "Contract not found in adminFee report"
                difference = None
            elif selected_spend > report_spend:
                status = "PO Master is high"
                difference = abs(selected_spend - report_spend)
            elif selected_spend < report_spend:
                status = "Report higher"
                difference = abs(selected_spend - report_spend)
            else:
                status = "MATCH"
                difference = 0

            summary.append({
                "contract": contract,
                "report_spend": report_spend,
                "po_spend": po_spend,
                "inv_spend": inv_spend,
                "selected_spend": selected_spend,
                "difference": difference,
                "status": status,
            })
        except Exception as e:
            summary.append({
                "contract": contract,
                "error": str(e),
                "report_spend": None,
                "po_spend": 0,
                "inv_spend": 0,
                "selected_spend": 0,
                "difference": None,
                "status": f"Error: {str(e)}",
            })

    return summary


def get_audit_data(delivery: str = None):
    """Get audit data, optionally filtered by delivery."""
    if delivery:
        sql = """SELECT contract_name, delivery, excel_file_path, status, record_cnt, insrt_date
                 FROM joblog_metadata.adminfee_audit_data WHERE delivery = :delivery ORDER BY insrt_date DESC"""
        with engine.begin() as conn:
            result = conn.execute(text(sql), {"delivery": delivery})
            rows = result.fetchall()
            cols = list(result.keys())
    else:
        sql = """SELECT contract_name, delivery, excel_file_path, status, record_cnt, insrt_date
                 FROM joblog_metadata.adminfee_audit_data ORDER BY insrt_date DESC LIMIT 100"""
        with engine.begin() as conn:
            result = conn.execute(text(sql))
            rows = result.fetchall()
            cols = list(result.keys())
    return {"columns": cols, "rows": [list(r) for r in rows]}
