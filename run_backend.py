"""
Start the FastAPI backend server.
Works on both Windows and Linux.
"""
import sys
import os
from pathlib import Path

# Ensure we're running from project root
os.chdir(Path(__file__).resolve().parent)
sys.path.insert(0, str(Path(__file__).resolve().parent))

import uvicorn

if __name__ == "__main__":
    print("Starting hunterAI AdminFee API server...")
    print(f"  OS: {sys.platform}")
    print(f"  Python: {sys.version}")
    print(f"  Working dir: {os.getcwd()}")
    print()
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
