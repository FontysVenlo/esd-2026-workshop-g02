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
echo Stopping the Northstar Supply workshop...
"%DOCKER_EXE%" compose -f "%~dp0compose.yaml" --profile load down
if errorlevel 1 goto stop_failed
echo Workshop stopped. Browser notes remain saved in your browser.
exit /b 0

:no_docker
echo Docker Desktop was not found.
goto failed

:not_extracted
echo The workshop files are not together in this folder.
echo Extract the ZIP first, then run "Stop Workshop.bat" from the extracted folder.
goto failed

:stop_failed
echo The workshop could not be stopped. Check Docker Desktop for container errors.

:failed
echo.
pause
exit /b 1
