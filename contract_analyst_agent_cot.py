import os
import re
from typing import TypedDict, List, Optional
from pathlib import Path

from langgraph.graph import StateGraph, END
from langchain_ollama import ChatOllama
from sqlalchemy import create_engine,text
from langchain_openai import ChatOpenAI

from tools import get_contract_for_delivery, run_sql


os.environ["NO_PROXY"] = "172.31.27.7"

os.environ["no_proxy"] = "172.31.27.7"

# ===============================================
# CONFIG
# ===============================================
BASE_DIR = Path(__file__).resolve().parent
PROMPT_DIR = BASE_DIR / "PROMPTS"

DELIVERY_PROMPT = (PROMPT_DIR/"delivery_normalizer.txt").read_text()
SQL_PROMPT = (PROMPT_DIR/"sql_generator.txt").read_text()
ANALYST_PROMPT = (PROMPT_DIR/"contract_analyst_prompt.txt").read_text()
FORMAT_PROMPT = (PROMPT_DIR/"response_formatter.txt").read_text()

#set api key
os.environ["OPENAI_API_KEY"] = "xxx"

DB_URI = "mysql+pymysql://kishore:Gpohealth!#!@dev-db-test.c969yoyq9cyy.us-east-1.rds.amazonaws.com:3306/joblog_metadata"

engine = create_engine(DB_URI)

llm = ChatOpenAI(model="gpt-4.1-mini")

# llm = ChatOllama(
#     model = "llama3.1:8b",
#     base_url = "http://172.31.27.7:11434",
#     temperature = 0.9,
#     timeout = 60,
#     model_kwargs={
#         "num_predict": 600,
#         "top_p":0.9
#     }
# )

class AgentState(TypedDict):
    delivery: str
    contracts: str
    question: str
    sql_result: List[dict]
    final_answer: Optional[str]

# ===============================================
# HELPERS
# ===============================================
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

    return sql_query.replace("\n", " ").replace("`","").strip()

def contract_to_table(contract: str) -> str:
    """
    Convert contract name to table name
    """

    table = contract.replace("-", "_")
    return f"admin_fee.PO_Master_{table}"


# ===============================================
# NODES
# ===============================================

def greeting_node(state: AgentState):
    print("\n===================================================")
    print("\nAdminfee Contract Analyst Agent ")
    print("\n===================================================")

    return state

def ask_delivery_node(state: AgentState):
    user_input = input("Please provide delivery name: ")

    prompt = DELIVERY_PROMPT.format(delivery=user_input)
    response = llm.invoke(prompt)

    normalized_delivery = response.content.strip().lower()

    print(f"\nNormalized Delivery: {normalized_delivery}")
    state["delivery"] = normalized_delivery

    return state

def fetch_contracts_node(state: AgentState):
    delivery = state["delivery"]

    contracts = get_contract_for_delivery(delivery)

    if not contracts:
        print("\nNo contracts found for this delivery.")
        state["contracts"] = []
        return state

    print("\nContracts Found:")
    print(contracts)

    state["contracts"] = contracts

    return state

def chat_loop_node(state: AgentState):

    contracts = state["contracts"]

    while True:

        question = input("\nAsk your question (type 'exit' to stop): ")

        if question.lower() == "exit":
            break

        results = []

        # ==================================================================
        # SQL GENERATION
        # ==================================================================

        # modified_contract = []
        # for contract in contracts:
        #
        #     table = contract_to_table(contract)
        #     modified_contract.append(table)

        prompt = SQL_PROMPT.format(
            question=question,
            contracts=contracts
        )

        response = llm.invoke(prompt)

        sql = extract_sql_query(response.content)

        print(f"\nGenerated SQL for {contracts}")
        print("----->",sql,"<-----")

        data = run_sql(sql)
        results.append(
            {
                "result": data
            }
        )

        # results.append({
        #     "contract": contract,
        #     "result": data
        # })

        print("~~~~~~~~~~~~~~~~~~~~~~~~~~ Sql execution and result capture c completed~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
        # ==================================================================
        # ANALYSIS
        # ==================================================================

        analysis_prompt = ANALYST_PROMPT.format(
            question=question,
            result=results
        )

        analysis_response = llm.invoke(analysis_prompt)

        print("~~~~~~~~~~~~~~~~~~~~~~~~~~ Analysis completed~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")

        # ==================================================================
        # RESPONSE FORMATTING
        # ==================================================================
        format_prompt = FORMAT_PROMPT.format(
               analysis=analysis_response.content
        )

        final_response = llm.invoke(format_prompt)

        print("\n----------------------------------------------------------------")
        print("Analysis Result")
        print("\n----------------------------------------------------------------")

        print(final_response.content)

    return state


# ===============================================
# GRAPH
# ===============================================

def build_graph():

    graph = StateGraph(AgentState)

    graph.add_node("greeting", greeting_node)
    graph.add_node("ask_delivery", ask_delivery_node)
    graph.add_node("fetch_contracts", fetch_contracts_node)
    graph.add_node("chat_loop", chat_loop_node)

    graph.set_entry_point("greeting")

    graph.add_edge("greeting", "ask_delivery")
    graph.add_edge("ask_delivery","fetch_contracts")
    graph.add_edge("fetch_contracts", "chat_loop")
    graph.add_edge("chat_loop", END)

    return graph.compile()

def contract_analysis():
    app = build_graph()
    app.invoke({})

if __name__ == "__main__":
    contract_analysis()
