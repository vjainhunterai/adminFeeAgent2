from sqlalchemy import create_engine, text

DB_URI = "mysql+pymysql://kishore:Gpohealth!#!@dev-db-test.c969yoyq9cyy.us-east-1.rds.amazonaws.com:3306/joblog_metadata"

engine = create_engine(DB_URI)

def run_sql(query:str):
    print("entered into run sql block########")


    with engine.begin() as conn:
        result  = conn.execute(text(query))
        rows = result.fetchall()
        cols = result.keys()

    return {
        "columns": list(cols),
        "rows":[list(r) for r in rows]
    }

def get_contract_for_delivery(delivery: str):
    sql = """
    SELECT contract_name FROM joblog_metadata.adminfee_audit_data WHERE delivery = :delivery"""

    with engine.begin() as conn:
        result  =  conn.execute(text(sql), {"delivery":delivery})
        rows = result.fetchall()

    return [r[0] for r in rows]


# sql_query = 'SELECT SUM(PO_base_spend_actual) AS total_spend FROM admin_fee.PO_Master_PP_NS_1540_v1';
# result = run_sql(sql_query)
#
# print(result)