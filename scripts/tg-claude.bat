@echo off
:: tg-claude.bat — registra este terminal con nombre, rol y cwd, luego arranca claude
setlocal enabledelayedexpansion

if "%TERMINAL_GRID_SESSION_ID%"=="" (
    echo [tg-claude] TERMINAL_GRID_SESSION_ID not set. Running claude without registration.
    claude %*
    goto :eof
)

for %%I in ("%CD%") do set DEFAULT_NAME=%%~nxI

:: Auto-suggest orchestrator if at the git root
for /f "delims=" %%G in ('git rev-parse --show-toplevel 2^>nul') do set GIT_ROOT=%%G
set "GIT_ROOT_FWD=%GIT_ROOT:\=/%"
set "CWD_FWD=%CD:\=/%"
if "%CWD_FWD%"=="%GIT_ROOT_FWD%" (
    set DEFAULT_ROLE=orchestrator
) else (
    set DEFAULT_ROLE=agent
)

set /p INPUT_NAME=[tg-claude] Session name [%DEFAULT_NAME%]:
if "!INPUT_NAME!"=="" (set AGENT_NAME=%DEFAULT_NAME%) else (set AGENT_NAME=!INPUT_NAME!)

set /p INPUT_ROLE=[tg-claude] Role (orchestrator/agent) [%DEFAULT_ROLE%]:
if "!INPUT_ROLE!"=="" (set AGENT_ROLE=%DEFAULT_ROLE%) else (set AGENT_ROLE=!INPUT_ROLE!)
if not "!AGENT_ROLE!"=="orchestrator" if not "!AGENT_ROLE!"=="agent" set AGENT_ROLE=%DEFAULT_ROLE%

:: Use forward slashes to avoid JSON escaping issues
set "AGENT_CWD=%CD:\=/%"

curl.exe -s -X POST "http://localhost:8000/sessions/%TERMINAL_GRID_SESSION_ID%/name" ^
  -H "Content-Type: application/json" ^
  -d "{\"name\": \"%AGENT_NAME%\", \"role\": \"%AGENT_ROLE%\", \"cwd\": \"%AGENT_CWD%\"}" >nul 2>&1

echo [tg-claude] Registered as '%AGENT_NAME%' (%AGENT_ROLE%)
claude %*
