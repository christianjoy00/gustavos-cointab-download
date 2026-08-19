@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo  GUSTAVO'S COINTAB DASHBOARD - DOWNLOAD LATEST FROM GITHUB
echo ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$url='https://github.com/christianjoy00/gustavos-cointab-download/archive/refs/heads/main.zip';" ^
  "$zip=Join-Path $PWD 'github-latest.zip';" ^
  "$out=Join-Path $PWD 'github-latest';" ^
  "if(Test-Path $zip){Remove-Item $zip -Force}; if(Test-Path $out){Remove-Item $out -Recurse -Force};" ^
  "Write-Host 'Downloading latest dashboard from GitHub...' -ForegroundColor Cyan;" ^
  "Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip;" ^
  "Expand-Archive -Path $zip -DestinationPath $out -Force;" ^
  "Remove-Item $zip -Force;" ^
  "Write-Host ''; Write-Host ('Latest dashboard downloaded to: '+$out) -ForegroundColor Green"
if errorlevel 1 (
  echo.
  echo DOWNLOAD FAILED.
  pause
  exit /b 1
)
echo.
echo DONE.
pause
