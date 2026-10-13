@echo off
setlocal
cd /d "%~dp0.."

where docker >nul 2>&1
if errorlevel 1 (
  echo Docker was not found. Install and start Docker Desktop, then try again.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop is not running. Start it and wait until it is ready.
  pause
  exit /b 1
)

docker compose version >nul 2>&1
if errorlevel 1 (
  echo Docker Compose is unavailable. Update Docker Desktop, then try again.
  pause
  exit /b 1
)

echo Building and starting the local workshop. The first run can take several minutes...
docker compose up -d --build --wait
if errorlevel 1 (
  echo Startup did not complete. See the facilitator troubleshooting guide.
  pause
  exit /b 1
)

echo.
echo Workshop ready: http://localhost:8080
echo Grafana dashboard: http://localhost:3000
echo.
pause
