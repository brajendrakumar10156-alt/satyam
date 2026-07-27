@echo off
cd /d "C:\Users\satya\OneDrive\Documents\Desktop\satyam\backend"
venv\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8000 --reload
