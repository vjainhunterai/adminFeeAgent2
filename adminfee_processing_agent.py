import os
import re
import time
import platform as pf
from typing import TypedDict,Optional,List
from extract_input_template_S3 import extract_input_template
from trigger_airflow_dag import trigger_airflow_dag

from Tools.scripts.fixdiv import report
from langgraph.graph import StateGraph,END
from langchain_openai import ChatOpenAI
import subprocess
import pandas as pd
from openai import base_url, api_key
from sqlalchemy import create_engine,text
import openpyxl
import pymysql
from pathlib import Path
from langchain_ollama import ChatOllama
import xlrd



#-------------------------------------------------------------------------------------
# CONFIGURATION
#-------------------------------------------------------------------------------------
#set api key
os.environ["OPENAI_API_KEY"] = "xxx"
os.environ["NO_PROXY"] = "172.31.27.7"
os.environ["no_proxy"] = "172.31.27.7"

DB_URI = "mysql+pymysql://kishore:Gpohealth!#!@dev-db-test.c969yoyq9cyy.us-east-1.rds.amazonaws.com:3306/joblog_metadata"

engine = create_engine(DB_URI)

TABLE_NAME = "admin_fee_metadata"
FILE_PATH = r'adminfee_input/'
S3_BUCKET = 'etlhunter'
REMOTE_AIRFLOW_CMD = "/home/ubuntu/run_airflow.sh dags trigger execute_adminFee_Data_Pipeline_v1"
AIRFLOW_CMD = [
    "/home/ubuntu/run_airflow.sh",
    "dags",
    "trigger",
    "execute_adminfee_data_pipeline_v1"
]
UBUNTU_HOST = "ubuntu@172.31.25.132"
SSH_KEY_PATH = "C:\\Users\\jvineet\\Desktop\\Cust_t0004 1.pem"
BASE_DIR = Path(__file__).resolve().parent
STATUS_SYSTEM_MESSAGE = (
    BASE_DIR /"prompts" / "status_tracker.txt"
).read_text()

SUMMARY_MESSAGE = (
    BASE_DIR /"prompts" / "contract_summary.txt"
).read_text()
llm = ChatOpenAI(model="gpt-4.1-mini")

# llm2 = ChatOllama(
#     model = "llama3.1:8b",
#     base_url = "http://172.31.27.7:11434",
#     temperature = 0,
#     num_predict=200,
#     top_k=10,
#     top_p=0.8,
#     repeat_penalty=1.1,
#     timeout = 60
# )

#-------------------------------------------------------------------------------------
# STATE DEFINITION
#-------------------------------------------------------------------------------------

class AgentState(TypedDict, total=False):
    input_type: str
    contracts:str
    contracts_list:str
    delivery_name:str
    job_status: str
    is_completed:Optional[bool]
    contract_summary: str

#-------------------------------------------------------------------------------------
# HELPER FUNCTIONS
#-------------------------------------------------------------------------------------

def print_header():
    print("\n" + "=" *50)
    print("Adminfee automation agent")
    print("=" * 50)

def get_user_choice(prompt: str) -> str:
    """Safety capture user input """
    return input(prompt).strip().lower()

def extract_sql_query(llm_response: str) -> str:

    if not llm_response:
        raise ValueError("Empty response")

    text = llm_response.strip()

    code_block = re.search(f"```sql(.*?)```", text, re.IGNORECASE | re.DOTALL)
    if code_block:
        return code_block.group(1).strip()

    prefixes = [
        "sql_query:",
        "sql:",
        "query:",
        "sql_statement:",
        "sql statement:"
    ]
    lower_text = text.lower()
    for prefix in prefixes:
        if prefix in lower_text:
            idx = lower_text.find(prefix)
            text = text[idx + len(prefix):].strip()

    sql_keywords = ["select", "insert", "update", "delete", "with"]

    pattern = r"(?i)\b(" + "|".join(sql_keywords) + r")\b"

    match = re.search(pattern, text)
    if not match:
        raise ValueError("No SQL keyword found in response")

    start_idx = match.start()
    sql_part = text[start_idx:].strip()

    semicolon_match = re.search(r";", sql_part)

    if semicolon_match:
        sql_query = sql_part[:semicolon_match.end()]
    else:
        sql_query = sql_part

    return sql_query.strip()

def run_sql(query: str):
    engine = create_engine(DB_URI)

    with engine.begin() as conn:
        result = conn.execute(text(query)).fetchall()

    return result
#-------------------------------------------------------------------------------------
# NODES
#-------------------------------------------------------------------------------------

def greeting_node(state:AgentState) -> AgentState:
    """Display welcome message and capture inputs"""
    print_header()

    print("\nHi! I am Adminfee Automation Agent. ")
    print("I will help you process contracts and generate Excel outputs.\n")

    print("How would you like to provide the contract information?\n")
    print("Type:")
    print("* 'manual' - Enter contract names manually")
    print("* 'file' - Upload an Excel file\n")

    while True:
        choice = get_user_choice("Please choose (manual/file): ")

        if choice in ["manual", "file"]:
            state["input_type"] = choice
            break
        else:
            print("Invalid choice. Please type 'manual' or 'file'.")

    return state

def contract_input_node(state:AgentState) -> AgentState:
    """Collect contract infomration based on input type"""

    input_type = state.get("input_type")

    if input_type == "file":
        print(f"\nPlease place excel file in below location of s3 bucket{S3_BUCKET} :\n")
        print(FILE_PATH + "\n")

        print("requirements:")
        print("1. File name must be exactly: contracts.xlsx")
        print("2. File should be closed (not open in excel)")
        print("3. Column name should be: contract_name\n")

        input("After placing the file, type 'done' and press enter -> ")
        state["contracts"] = "FIle_INPUT"

    else:
        print("\nPlease enter the contract name: ")
        print("(You can enter multiple contracts separated by comma or new line)\n")

        print("Example:")
        print("PP-OR-123,PP-NS-345\n")

        contracts = input("Enter contracts: ").strip()
        state["contracts"] = contracts
    return state

def delivery_node(state: AgentState) -> AgentState:
    """Capture delivery name."""

    while True:
        delivery = input("\nPlease enter the delivery name: ").strip()
        if delivery:
            state["delivery_name"] = delivery
            break
        else:
            print("Delivery name cannot be empty.")

    return state

#-------------------------------------------------------------------------------------
# NODES PROCESSING
#-------------------------------------------------------------------------------------

def contract_loader_node(state: AgentState) -> AgentState:
    """Load contracts from manual inputs or file."""

    print("\n Loading contracts......")

    input_type = state.get("input_type")

    if input_type=="file":
        LOCAL_PATH = extract_input_template()
        df = pd.read_excel(LOCAL_PATH)
        contracts = df["contract_names"].dropna().tolist()

        state["contracts_list"] = contracts

    else:
        contracts = state.get("contracts", "")
        contract_list2 = [c.strip() for c in contracts.split(",") if c.strip()]

        state["contracts_list"] = contract_list2

    print(f"Contracts loaded: {state['contracts_list']}")

    return state

def metadata_update_node(state:AgentState) -> AgentState:
    """Truncate and insert metadata table."""

    print("\n Updating metadata table........")

    engine = create_engine(DB_URI)

    contracts = state.get("contracts_list",[])
    delivery = state.get("delivery_name")

    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE TABLE {TABLE_NAME}"))

        for contract in contracts:
            conn.execute(
                text(
                    f"""
                    INSERT INTO {TABLE_NAME}(CONTRACT_NAME,DELIVERY)
                    VALUES(:contract, :delivery)
                    """
                ),
                {"contract":contract,"delivery":delivery},
            )
    return state

def trigger_pipeline_node(state:AgentState) -> AgentState:
    """Trigger Airflow DAG."""
    print("\n Triggering Airflow pipeline....")

    try:
        trigger_airflow_dag()
        # os_type = pf.system()
        #
        # if os_type == "Linux":
        #     print("Running on Linx machine. Executing locally.")
        #     result = subprocess.run(
        #         AIRFLOW_CMD,
        #         check=True,
        #         capture_output=True,
        #         text=True
        #     )
        #
        # else:
        #     print("Running on Windows machine. Executing via SSH.")
        #
        #     ssh_cmd = [
        #         "ssh",
        #         "-i",
        #         SSH_KEY_PATH,
        #         UBUNTU_HOST,
        #         REMOTE_AIRFLOW_CMD
        #
        #     ]
        #
        #     result = subprocess.run(
        #         ssh_cmd,
        #         capture_output=True,
        #         text=True,
        #         check=True
        #     )


        #print("Output:", result.stdout)
        state["job_status"] = "TRIGGERED"

        print("Pipeline triggered successfully")

    except subprocess.CalledProcessError as e:
        print("Failed to trigger pipeline:", e.stderr)
        state["job_status"] = "FAILED"

    return state

def ai_status_monitor_node(state: AgentState):
    delivery = state["delivery_name"]

    print("\n Monitoring started for delivery:",delivery)

    while True:
        summary_query = f"""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN STATUS = 0 THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN STATUS != 0 THEN 1 ELSE 0 END) AS in_progress
        FROM {TABLE_NAME}
        """
        result = run_sql(summary_query)[0]

        total, completed, in_progress = result

        print("\n Status summary")
        print("------------------------------------")
        print(f"Total Contracts : {total}")
        print(f"Completed : {completed}")
        print(f"In Progress : {in_progress}")

        if in_progress == 0:
            print("\n ALL contracts completed")
            state["is_completed"] =True
            break

        print("\n You may ask any status questions (or press Enter to continue).")
        user_question = input("Ask: ").strip()

        if user_question:
            sql_prompt = f"""
            {STATUS_SYSTEM_MESSAGE}
            
            user Question:
            {user_question}
            
            Delivery Name: {delivery}
            """
            llm_response = llm.invoke(sql_prompt).content.strip()
            sql_query = extract_sql_query(llm_response)


            print("\nGenerated SQL:", sql_query)

            try:
                db_result = run_sql(sql_query)
            except Exception as e:
                print("Query error: ",e)
                db_result = []
            interpretation_prompt = f"""
            {STATUS_SYSTEM_MESSAGE}
            
            User Question: {user_question}
            
            SQL Result:
            {db_result}
            
            Provide user friendly answer.
            """

            response = llm.invoke(interpretation_prompt).content

            print("\n", response)
        print("\n Checking again in 60 seconds.... \n")
        time.sleep(60)

    return state

def completion_node(state: AgentState):

    delivery = state["delivery_name"]
    bukcet_name='etlhunter'

    output_path = f"adminfee_output/{delivery}"

    print(f"\n Admin Fee Processing Completed successfully! and files are uploaded into se bucket: {bukcet_name}")
    print("output Directory:", output_path)
    print("\nReady for analysis phase. ")

    return state


def confirmation_node(state: AgentState) -> AgentState:
    """Display collected information."""

    print("\nDetails Received Successfully")
    print("-" * 40)

    print(f"Input Type   :{state.get('input_type')}")
    print(f"Contracts   :{state.get('contracts')}")
    print(f"Delivery Name   :{state.get('delivery_name')}")
    #print(f"Job Status   :{state.get('job_status')}")

    print("\nNext Phase: Analysis Phase.")

    return state

def contract_summary_node(state: AgentState):
    print("\nContracts summary preparation started....")
    contracts = state["contracts_list"]
    summary = []

    for contract in contracts:
        contract2=contract.replace("-","_").strip()
        table = f"admin_fee.PO_Master_{contract2}_v1"

        po_sql = f"""
        SELECT SUM(PO_Base_Spend_actual) AS PO_SPEND,
        SUM(INV_Extended_Spend_actual) AS INV_SPEND
        FROM {table}"""



        report_sql = f"""
        SELECT SUM(`Sales_Volume`) AS SALES_VOLUME
        FROM admin_fee.admin_fee_report 
        WHERE `Contract ID`=:contract_id"""

        with engine.begin() as conn:
            po_result = conn.execute(text(po_sql)).mappings().fetchone()

            report_result = conn.execute(text(report_sql), {"contract_id":contract}).mappings().fetchone()

        po_spend = po_result["PO_SPEND"] or 0
        inv_spend = po_result["INV_SPEND"] or 0

        selected_spend = max(po_spend, inv_spend)
        if report_result:
            report_spend = report_result["SALES_VOLUME"] or 0
        else:
             report_spend = None
        if report_spend is None:
            status = "Contract not found in adminFee report"
        elif selected_spend > report_spend:
            status = "PO Master is high"
        elif selected_spend < report_spend:
            status = "report higher"
        else:
            status = "MATCH"

        if report_spend is None:
            difference = None
        else:
            difference = abs(selected_spend - report_spend)

        summary.append({
                "contract":contract,
                "report_spend": report_spend,
                "po_spend": po_spend,
                "inv_spend": inv_spend,
                "selected_spend": selected_spend,
                "difference": difference,
                "status": status
        })

    state["contract_summary"] = summary

    return state

def summary_report_node(state: AgentState):
    print("\nAgent is formatting Summary....")
    summary_data = state["contract_summary"]

    prompt = SUMMARY_MESSAGE.format(
        summary_data=summary_data
    )
    response = llm.invoke(prompt)

    print("\n============================CONTRACT SUMMARY===============================\n")
    print(response.content)
    return state

#-------------------------------------------------------------------------------------
# GRAPH BUILDING
#-------------------------------------------------------------------------------------

def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("greeting",greeting_node)
    graph.add_node("contract_input", contract_input_node)
    graph.add_node("delivery", delivery_node)
    graph.add_node("contract_loader", contract_loader_node)
    graph.add_node("metadata_update",metadata_update_node)
    graph.add_node("trigger_pipeline", trigger_pipeline_node)
    graph.add_node("confirmation", confirmation_node)
    graph.add_node("ai_status_monitor", ai_status_monitor_node)
    graph.add_node("completion", completion_node)
    graph.add_node("contract_summary", contract_summary_node)
    graph.add_node("summary_report", summary_report_node)


    graph.set_entry_point("greeting")

    graph.add_edge("greeting","contract_input")
    graph.add_edge("contract_input", "delivery")
    graph.add_edge("delivery", "contract_loader")
    graph.add_edge("contract_loader","metadata_update")
    graph.add_edge("metadata_update", "trigger_pipeline")
    graph.add_edge("trigger_pipeline","ai_status_monitor")
    graph.add_edge("ai_status_monitor", "completion")
    graph.add_edge("completion","confirmation")
    graph.add_edge("confirmation", "contract_summary")
    graph.add_edge("contract_summary", "summary_report")
    graph.add_edge("summary_report", END)

    return graph.compile()

def run_processing_agent():
    app = build_graph()
    app.invoke({})

#-------------------------------------------------------------------------------------
# MAIN
#-------------------------------------------------------------------------------------

if __name__ == "__main__":
    run_processing_agent()
