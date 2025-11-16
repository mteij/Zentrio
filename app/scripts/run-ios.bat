@echo off
echo 🚀 Starting Zentrio iOS Setup...
echo.

REM Check if Xcode is installed (this will only work on macOS)
echo 🔍 Checking for Xcode...
where xcodebuild >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Xcode not found. iOS development requires a Mac with Xcode installed.
    echo 📖 See CAPACITOR.md for instructions.
    echo.
    echo 💡 If you're on Windows, you can still:
    echo    1. Build the app with: bun run build
    echo    2. Sync with: bun run cap:sync
    echo    3. Transfer the project to a Mac for final iOS build
    pause
    exit /b 1
)

echo ✅ Xcode found

REM Build the app
echo.
echo 🔨 Building Zentrio...
cd /d "%~dp0.."
call bun run build
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

REM Install iOS dependencies
echo.
echo 📦 Installing iOS dependencies...
cd ios\App
call pod install
cd ..\..

if %errorlevel% neq 0 (
    echo ❌ Pod install failed
    pause
    exit /b 1
)

REM Sync with Capacitor
echo.
echo 🔄 Syncing with Capacitor...
call bunx cap sync ios
if %errorlevel% neq 0 (
    echo ❌ Sync failed
    pause
    exit /b 1
)

REM Open Xcode
echo.
echo 📱 Opening Xcode...
echo.
echo 📋 Instructions:
echo 1. Xcode will open with the Zentrio project
echo 2. Select your simulator from the device dropdown
echo 3. Click the run button to build and run the app
echo.
echo 🎯 Your app will be deployed to the simulator!
echo.

call bunx cap open ios

echo ✅ Xcode is opening...
echo 💡 Follow the instructions above to run Zentrio on your iOS simulator.
pause