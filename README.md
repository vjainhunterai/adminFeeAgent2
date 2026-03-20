Windows Setup (Step-by-Step)
Prerequisites
Tool	Version	Download
Python	3.10+	https://www.python.org (check "Add to PATH")
Node.js	18+	https://nodejs.org (LTS version)
Git	any	https://git-scm.com
Step 1: Clone the Repo
git clone https://github.com/vjainhunterai/adminFeeAgent2.git
cd adminFeeAgent2

Step 2: Configure Environment
copy .env.example .env
notepad .env

Set your real OPENAI_API_KEY in the .env file.

Step 3: One-Click Start
start.bat

This automatically:

Checks Python & Node.js are installed
pip install -r backend\requirements.txt
cd frontend && npm install
Opens Backend in a new CMD window (port 8000)
Opens Frontend in a new CMD window (port 3000)
Step 4: Open Browser
http://localhost:3000

Or Manual Start (two terminals)
Terminal 1 - Backend:

cd adminFeeAgent2
set OPENAI_API_KEY=your-key-here
pip install -r backend\requirements.txt
python run_backend.py

Terminal 2 - Frontend:

cd adminFeeAgent2\frontend
npm install
npm run dev

What's Cross-Platform
Component	Windows	Linux
FastAPI backend	python run_backend.py	python run_backend.py
React frontend	npm run dev	npm run dev
Path handling	pathlib.Path (auto)	pathlib.Path (auto)
.env loading	Auto-loaded by backend	Auto-loaded by backend
Airflow trigger	SSH via Paramiko	Local subprocess
Startup script	start.bat	./start.sh
The existing trigger_airflow_dag.py already handles Windows via Paramiko SSH (using the PEM key at C:\Users\jvineet\Desktop\Cust_t00041.pem). On Linux it runs locally via subprocess. No changes needed there.
