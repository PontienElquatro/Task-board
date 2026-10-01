@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est requis. Installez Node.js 22 LTS, puis relancez ce fichier.
  pause
  exit /b 1
)
node tools\serve-built.mjs --open
if errorlevel 1 pause
