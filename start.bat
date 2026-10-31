@echo off
setlocal EnableExtensions
set "WORKSHOP_DIR=%~dp0"
if exist "%~dp0field-workshop\compose.yaml" set "WORKSHOP_DIR=%~dp0field-workshop\"
cd /d "%WORKSHOP_DIR%"

if not exist "%WORKSHOP_DIR%compose.yaml" goto not_extracted

set "DOCKER_EXE=docker.exe"
where docker.exe >nul 2>&1
if not errorlevel 1 goto docker_found
if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\resources\bin\docker.exe"
if exist "%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" set "DOCKER_EXE=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe"
if "%DOCKER_EXE%"=="docker.exe" goto no_docker

:docker_found
"%DOCKER_EXE%" info >nul 2>&1
if errorlevel 1 goto docker_not_ready

echo Starting the Northstar Supply workshop...
echo The first start downloads container images and may take several minutes.
echo Waiting for the workshop websites to be ready before opening your browser.
"%DOCKER_EXE%" compose -f "%WORKSHOP_DIR%compose.yaml" --profile load up --build -d --wait --wait-timeout 120
if errorlevel 1 goto start_failed

echo.
echo Workshop ready: http://localhost:8088
echo Opening the overview, Storefront, Network Faults, Grafana, and Prometheus...
start "" "http://localhost:8088"
start "" "http://localhost:8088/storefront"
start "" "http://localhost:8089"
start "" "http://localhost:3008/d/field-workshop/field-workshop"
start "" "http://localhost:9098"
exit /b 0

:no_docker
echo Docker Desktop was not found. Install and start Docker Desktop, then run this file again.
goto failed

:not_extracted
echo The workshop files are not together in this folder.
echo In File Explorer, right-click the ZIP and choose "Extract All...".
echo Open the extracted folder, then double-click "start.bat" there.
echo Do not run the launcher from inside the ZIP preview.
goto failed

:docker_not_ready
echo Docker Desktop is not running yet. Start it, wait until the engine is ready, then run this file again.
goto failed

:start_failed
"%DOCKER_EXE%" compose -f "%WORKSHOP_DIR%compose.yaml" --profile load ps -a
echo The workshop could not start. Check Docker Desktop for container errors, then try again.

:failed
echo.
pause
exit /b 1
