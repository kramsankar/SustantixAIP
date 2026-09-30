@echo off
setlocal EnableExtensions EnableDelayedExpansion
rem ==========================================================================
rem  Sustantix AIP - one-time signing-key setup (Windows)
rem  Confidential - Sustantix.
rem
rem  1. Checks prerequisites (Git, Node.js 20+, pnpm, .NET 8 SDK)
rem  2. Clones the private repo to C:\SustantixAIP (branch below)
rem  3. Installs dependencies and builds the license library
rem  4. Creates the license signing key + plug-in strong-name key in
rem     %USERPROFILE%\sustantix-vault  (OUTSIDE the repo - never committed)
rem  5. Writes the PUBLIC key to config\license\trusted-keys.json,
rem     commits and pushes it after you confirm
rem
rem  Safe to re-run: existing keys are reused, never overwritten.
rem ==========================================================================

set "REPO_URL=https://github.com/kramsankar/SustantixAIP.git"
set "BRANCH=claude/festive-archimedes-dvk5n1"
set "REPO_DIR=C:\SustantixAIP"
set "VAULT=%USERPROFILE%\sustantix-vault"
set "KID=sx-prod-2026"
set "KEYSET=%REPO_DIR%\config\license\trusted-keys.json"

echo.
echo === Sustantix AIP signing-key setup ===
echo Repo  : %REPO_DIR%  (%BRANCH%)
echo Vault : %VAULT%
echo.

rem ---- 1. Prerequisites ---------------------------------------------------
where git >nul 2>&1 || (echo [X] Git not found. Install from https://git-scm.com/download/win & goto :fail)
where node >nul 2>&1 || (echo [X] Node.js not found. Install Node.js 22 LTS from https://nodejs.org & goto :fail)
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%v"
if !NODE_MAJOR! LSS 20 (echo [X] Node.js !NODE_MAJOR! found - version 20 or newer is required. & goto :fail)
where pnpm >nul 2>&1 || (
  echo [i] pnpm not found - installing pnpm 10 globally...
  call npm install -g pnpm@10 || (echo [X] Could not install pnpm. & goto :fail)
)
where dotnet >nul 2>&1 || (echo [X] .NET SDK not found. Install .NET 8 SDK from https://dotnet.microsoft.com/download/dotnet/8.0 & goto :fail)
dotnet --list-sdks | findstr /r "^8\." >nul || (echo [X] .NET 8 SDK not found. Install it from https://dotnet.microsoft.com/download/dotnet/8.0 & goto :fail)
echo [OK] Git, Node.js !NODE_MAJOR!, pnpm, .NET 8 SDK

rem ---- 2. Clone or update the repository ---------------------------------
if exist "%REPO_DIR%\.git" (
  echo [i] Repository exists - updating...
  git -C "%REPO_DIR%" fetch origin || goto :fail
  git -C "%REPO_DIR%" checkout "%BRANCH%" || goto :fail
  git -C "%REPO_DIR%" pull --ff-only origin "%BRANCH%" || goto :fail
) else (
  if exist "%REPO_DIR%" (echo [X] %REPO_DIR% exists but is not a git repository. Remove or rename it first. & goto :fail)
  echo [i] Cloning private repository - sign in to GitHub if prompted...
  git clone --branch "%BRANCH%" "%REPO_URL%" "%REPO_DIR%" || goto :fail
)
echo [OK] Repository ready

rem ---- 3. Dependencies and license library -------------------------------
pushd "%REPO_DIR%" || goto :fail
echo [i] Installing dependencies (first run takes a few minutes)...
call pnpm install --frozen-lockfile || goto :failpop
call pnpm --filter @sustantix/license build || goto :failpop
echo [OK] Dependencies installed, license library built

rem ---- 4. Keys in the vault (outside the repo) ----------------------------
if not exist "%VAULT%" mkdir "%VAULT%" || goto :failpop

if exist "%VAULT%\%KID%.private.pem" (
  echo [i] Signing key %KID% already exists - reusing it.
  call pnpm --silent --filter @sustantix/license-cli sx-license pubkey --key "%VAULT%\%KID%.private.pem" --kid %KID% --keyset "%KEYSET%" || goto :failpop
) else (
  echo [i] Generating RSA-4096 license signing key %KID%...
  call pnpm --silent --filter @sustantix/license-cli sx-license keygen --kid %KID% --out "%VAULT%" --keyset "%KEYSET%" || goto :failpop
)

if exist "%VAULT%\aip-plugin.snk" (
  echo [i] Plug-in strong-name key already exists - reusing it.
) else (
  echo [i] Generating plug-in strong-name key...
  dotnet run --project tools\snkgen -- "%VAULT%\aip-plugin.snk" || goto :failpop
)

rem Lock the vault to the current user only.
icacls "%VAULT%" /inheritance:r /grant:r "%USERNAME%:(OI)(CI)F" >nul 2>&1

echo.
echo [OK] Vault contents:
dir /b "%VAULT%"
echo.
echo [OK] Public keyset (safe to share):
type "%KEYSET%"
echo.

rem ---- 5. Commit and push the PUBLIC key only ----------------------------
git diff --quiet -- config/license/trusted-keys.json
if not errorlevel 1 (
  echo [i] trusted-keys.json unchanged - nothing to commit.
  goto :done
)
git status --porcelain | findstr /i /r "\.pem \.snk" >nul && (echo [X] A private key appears inside the repo - aborting commit. & goto :failpop)

choice /c YN /m "Commit and push config\license\trusted-keys.json (public key only)"
if errorlevel 2 (
  echo [i] Skipped. Commit it later with:
  echo     git add config\license\trusted-keys.json ^&^& git commit -m "Add license public key %KID%" ^&^& git push
  goto :done
)
for /f "delims=" %%e in ('git config user.email') do set "GIT_EMAIL=%%e"
if not defined GIT_EMAIL (
  git config user.name "Karthikram S"
  git config user.email "kr@a-squaretechnologies.com"
)
git add config/license/trusted-keys.json || goto :failpop
git commit -m "Add production license public key %KID%" || goto :failpop
git push origin "%BRANCH%" || goto :failpop
echo [OK] Public key committed and pushed.

:done
popd
echo.
echo === Done ===
echo  BACK UP %VAULT% to a secure location (password manager / encrypted drive).
echo  Losing %KID%.private.pem means no further licenses can be issued with this key.
echo  Never copy the .pem or .snk files into the repository.
echo.
pause
endlocal
exit /b 0

:failpop
popd
:fail
echo.
echo === Setup stopped - fix the message above and run this file again. ===
pause
endlocal
exit /b 1
