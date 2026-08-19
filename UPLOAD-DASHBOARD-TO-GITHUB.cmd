@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo ============================================================
echo  GUSTAVO'S COINTAB DASHBOARD - PUBLISH TO GITHUB
echo ============================================================
where gh >nul 2>nul
if errorlevel 1 (
  echo GitHub CLI ^(gh^) is not installed or not in PATH.
  echo Install/login to gh first, then run this again.
  pause
  exit /b 1
)
gh auth status >nul 2>nul
if errorlevel 1 (
  echo GitHub CLI is not logged in.
  echo Starting one-time login...
  gh auth login
  if errorlevel 1 exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$src=(Get-Location).Path;" ^
  "$tmp=Join-Path $env:TEMP ('gustavos-cointab-dashboard-publish-'+[guid]::NewGuid().ToString('N'));" ^
  "Write-Host 'Cloning christianjoy00/gustavos-cointab-download...' -ForegroundColor Cyan;" ^
  "gh repo clone christianjoy00/gustavos-cointab-download $tmp -- --depth 1 | Out-Host;" ^
  "$git=Join-Path $tmp '.git';" ^
  "Get-ChildItem -LiteralPath $tmp -Force | Where-Object {$_.Name -ne '.git'} | Remove-Item -Recurse -Force;" ^
  "$exclude=@('.git','github-latest');" ^
  "Get-ChildItem -LiteralPath $src -Force | Where-Object {$exclude -notcontains $_.Name} | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $tmp -Recurse -Force };" ^
  "Push-Location $tmp;" ^
  "git add -A;" ^
  "$changes=git status --porcelain;" ^
  "if(-not $changes){ Write-Host 'No dashboard changes to upload.' -ForegroundColor Yellow; Pop-Location; Remove-Item $tmp -Recurse -Force; exit 0 };" ^
  "git -c user.name='Gustavos CoinTab Publisher' -c user.email='cointab-publisher@users.noreply.github.com' commit -m ('Dashboard update '+(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) | Out-Host;" ^
  "git push origin HEAD:main | Out-Host;" ^
  "Pop-Location; Remove-Item $tmp -Recurse -Force;" ^
  "Write-Host ''; Write-Host 'Dashboard uploaded to GitHub. GitHub Pages will update automatically.' -ForegroundColor Green"
if errorlevel 1 (
  echo.
  echo UPLOAD FAILED.
  pause
  exit /b 1
)
echo.
echo DONE.
pause
