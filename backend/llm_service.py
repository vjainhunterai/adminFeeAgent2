"""LLM service for SQL generation and contract analysis."""

import os
import re
from pathlib import Path

from langchain_openai import ChatOpenAI

BASE_DIR = Path(__file__).resolve().parent.parent
PROMPT_DIR = BASE_DIR / "prompts"

# Load prompts
DELIVERY_PROMPT = (PROMPT_DIR / "delivery_normalizer.txt").read_text()
SQL_PROMPT = (PROMPT_DIR / "sql_generator.txt").read_text()
ANALYST_PROMPT = (PROMPT_DIR / "contract_analyst_prompt.txt").read_text()
FORMAT_PROMPT = (PROMPT_DIR / "response_formatter.txt").read_text()
STATUS_SYSTEM_MESSAGE = (PROMPT_DIR / "status_tracker.txt").read_text()
SUMMARY_MESSAGE = (PROMPT_DIR / "contract_summary.txt").read_text()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
if OPENAI_API_KEY:
    os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY

llm = ChatOpenAI(model="gpt-4.1-mini")


def extract_sql_query(llm_response: str) -> str:
    """Extract SQL query from LLM response text."""
    if not llm_response:
        raise ValueError("Empty response")

    text = llm_response.strip()

    code_block = re.search(r"```sql(.*?)```", text, re.IGNORECASE | re.DOTALL)
    if code_block:
        return code_block.group(1).strip()

    prefixes = ["sql_query:", "sql:", "query:", "sql_statement:", "sql statement:"]
    lower_text = text.lower()
    for prefix in prefixes:
        if prefix in lower_text:
            idx = lower_text.find(prefix)
            text = text[idx + len(prefix) :].strip()

    sql_keywords = ["select", "insert", "update", "delete", "with"]
    pattern = r"(?i)\b(" + "|".join(sql_keywords) + r")\b"
    match = re.search(pattern, text)
    if not match:
        raise ValueError("No SQL keyword found in response")

    sql_part = text[match.start() :].strip()
    semicolon_match = re.search(r";", sql_part)
    if semicolon_match:
        sql_query = sql_part[: semicolon_match.end()]
    else:
        sql_query = sql_part

    return sql_query.replace("\n", " ").replace("`", "").strip()


def normalize_delivery(user_input: str) -> str:
    """Normalize delivery name using LLM."""
    prompt = DELIVERY_PROMPT.format(delivery=user_input)
    response = llm.invoke(prompt)
    return response.content.strip().lower()


def generate_analysis_sql(question: str, contracts: list) -> str:
    """Generate SQL from a natural language question about contracts."""
    prompt = SQL_PROMPT.format(question=question, contracts=contracts)
    response = llm.invoke(prompt)
    return extract_sql_query(response.content)


def analyze_results(question: str, results: list) -> str:
    """Analyze SQL results using LLM."""
    analysis_prompt = ANALYST_PROMPT.format(question=question, result=results)
    analysis_response = llm.invoke(analysis_prompt)
    return analysis_response.content


def format_response(analysis: str) -> str:
    """Format analysis for business users."""
    format_prompt = FORMAT_PROMPT.format(analysis=analysis)
    final_response = llm.invoke(format_prompt)
    return final_response.content


def generate_status_query(question: str, delivery: str) -> str:
    """Generate SQL for status monitoring questions."""
    sql_prompt = f"""
    {STATUS_SYSTEM_MESSAGE}

    User Question: {question}
    Delivery Name: {delivery}
    """
    llm_response = llm.invoke(sql_prompt).content.strip()
    return extract_sql_query(llm_response)


def interpret_status_result(question: str, db_result) -> str:
    """Interpret status query results for the user."""
    prompt = f"""
    {STATUS_SYSTEM_MESSAGE}

    User Question: {question}
    SQL Result: {db_result}

    Provide user friendly answer.
    """
    return llm.invoke(prompt).content


def format_summary(summary_data) -> str:
    """Format contract summary using LLM."""
    prompt = SUMMARY_MESSAGE.format(summary_data=summary_data)
    response = llm.invoke(prompt)
    return response.content
