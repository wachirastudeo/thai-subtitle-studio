$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
  Write-Error ".venv not found. Run: .\setup-windows.ps1"
}

$env:PYTHON = "$PWD\.venv\Scripts\python.exe"
npm run dev
