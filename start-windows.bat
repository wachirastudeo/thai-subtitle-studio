@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo First setup on this machine...
  powershell -ExecutionPolicy Bypass -File "%~dp0setup-windows.ps1"
  if errorlevel 1 pause & exit /b 1
)

powershell -ExecutionPolicy Bypass -File "%~dp0run-windows.ps1"
pause
