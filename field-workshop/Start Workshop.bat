@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "%~dp0compose.yaml" goto not_extracted

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
"%DOCKER_EXE%" compose -f "%~dp0compose.yaml" --profile load up --build -d --wait
if errorlevel 1 goto start_failed

echo.
echo Workshop ready: http://localhost:8088
start "" "http://localhost:8088"
exit /b 0

:no_docker
echo Docker Desktop was not found. Install and start Docker Desktop, then run this file again.
goto failed

:not_extracted
echo The workshop files are not together in this folder.
echo In File Explorer, right-click the ZIP and choose "Extract All...".
echo Open the extracted folder, then double-click "Start Workshop.bat" there.
echo Do not run the launcher from inside the ZIP preview.
goto failed

:docker_not_ready
echo Docker Desktop is not running yet. Start it, wait until the engine is ready, then run this file again.
goto failed

:start_failed
echo The workshop could not start. Check Docker Desktop for container errors, then try again.

:failed
echo.
pause
exit /b 1
