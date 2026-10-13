@echo off
setlocal
cd /d "%~dp0.."
where docker >nul 2>&1
if errorlevel 1 (
  echo Docker was not found. Stop Docker Desktop if the workshop is still running.
  pause
  exit /b 1
)
docker compose down
if errorlevel 1 (
  echo Could not stop the workshop. Check that Docker Desktop is running.
  pause
  exit /b 1
)
echo Workshop stopped.
pause
