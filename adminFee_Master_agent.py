import os
import re
import time

from adminfee_processing_agent import run_processing_agent
from contract_analyst_agent_cot import contract_analysis
from typing import Callable

def get_user_choice() -> str:
    """Prompt user to choose workflow option."""

    while True:

        print("\nHow would you lke to proceed?\n")
        print("1. Process NEW contracts")
        print("2. Process EXISTING contracts")

        choice = input("Enter option (1 or 2): ").strip()

        if choice in {"1","2"}:
            return choice

        print("\nInvalid option. Please select 1 or 2.")

def ask_yes_no(question: str) -> bool:
    """Prompt user yes/no confirmation."""

    while True:

        response = input(question).strip().lower()

        if response in {"yes","y"}:
            return True

        if response in {"no", "n"}:
            return False

        print("Invalid input. Please enter 'yes' or 'no'")

def track_executable_time(task: Callable) -> None:
    """Track execution time of a task."""

    start_time = time.time()
    task()
    end_time = time.time()

    duration = round(end_time - start_time, 2)

    print(f"\nProcessing completed in {duration} seconds.\n")

def process_new_contracts() -> None:
    """Run AdminFee processing workflow."""

    print("\nStarting AdminFee Processing Agent....")
    track_executable_time(run_processing_agent)

    performance_analysis = ask_yes_no(
        "Do you want to perform future analysis on processed contracts? (yes/no): "
    )

    if performance_analysis:
        contract_analysis()
    else:
        print("\nProcessing workflow completed.")

def analyze_existing_contracts() -> None:
    """Run contract analyst workflow."""
    print("\nStarting Contract analyst agent.....\n")
    contract_analysis()

def adminfee_master_agent() -> None:
    """Main orchestration controller."""
    print("\n===============================================================================================")
    print("                        hunterAI AdminFee Automation - Master Agent")
    print("===============================================================================================\n")

    print("Welcome! This agent will help you process or analyze AdminFee contracts.\n")

    while True:
        choice = get_user_choice()

        if choice =="1":
            print("choise 1")
            process_new_contracts()
        elif choice == "2":
            print("choise 2")
            contract_analysis()
        restart = ask_yes_no(
            "\nDo you want to start another workflow? (yes/no): "
        )

        if restart:
            print("\nRestarting workflow....\n")

        else:
            print("\nThank you for using hunterAI AdminFee Automation.\n")
            break

if __name__ == "__main__":
    adminfee_master_agent()


