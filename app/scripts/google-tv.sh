#!/usr/bin/env bash
set -e

ACTION="${1:-build}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -n "$ANDROID_HOME" ]]; then
  SDK_ROOT="$ANDROID_HOME"
elif [[ -d "$HOME/Android/Sdk" ]]; then
  SDK_ROOT="$HOME/Android/Sdk"
elif [[ -d "$HOME/Library/Android/sdk" ]]; then
  SDK_ROOT="$HOME/Library/Android/sdk"
else
  echo "Android SDK not found. Set ANDROID_HOME." >&2
  exit 1
fi

ADB="$SDK_ROOT/platform-tools/adb"
EMULATOR="$SDK_ROOT/emulator/emulator"
AVD_NAME="ZentrioGoogleTV"
TAURI_TARGET="i686"
UNIVERSAL_DEBUG_APK="$APP_ROOT/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk"

get_running_serial() {
  while IFS=$' \t' read -r serial rest; do
    [[ "$serial" =~ ^emulator- ]] || continue
    [[ "$rest" =~ device ]] || continue
    name=$("$ADB" -s "$serial" emu avd name 2>/dev/null | grep -v '^OK' | head -1 | xargs)
    if [[ "$name" == "$AVD_NAME" ]]; then
      echo "$serial"
      return 0
    fi
  done < <("$ADB" devices | tail -n +2)
  return 1
}

start_emulator() {
  local serial
  serial=$(get_running_serial) && { echo "$serial"; return 0; } || true

  "$EMULATOR" "@$AVD_NAME" >/dev/null 2>&1 &
  echo "Starting $AVD_NAME..." >&2

  until serial=$(get_running_serial); do sleep 2; done
  "$ADB" -s "$serial" wait-for-device >/dev/null

  local boot=""
  until [[ "$boot" == "1" ]]; do
    sleep 2
    boot=$("$ADB" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '[:space:]') || true
  done

  echo "Emulator ready on $serial" >&2
  echo "$serial"
}

case "$ACTION" in
  build)
    cd "$APP_ROOT"
    bunx tauri android build --debug --target "$TAURI_TARGET" --apk true --aab false --ci
    if [[ ! -f "$UNIVERSAL_DEBUG_APK" ]]; then
      echo "Expected APK not found at $UNIVERSAL_DEBUG_APK" >&2
      exit 1
    fi
    echo "Built Google TV APK: $UNIVERSAL_DEBUG_APK"
    ;;
  install)
    serial=$(start_emulator)
    if [[ ! -f "$UNIVERSAL_DEBUG_APK" ]]; then
      echo "APK not found. Run build first." >&2
      exit 1
    fi
    "$ADB" -s "$serial" install -r "$UNIVERSAL_DEBUG_APK"
    ;;
  dev)
    serial=$(start_emulator)
    cd "$APP_ROOT"
    bun run android:ports
    bunx tauri android dev "$serial"
    ;;
  logcat)
    serial=$(get_running_serial) || { echo "No Google TV emulator running" >&2; exit 1; }
    "$ADB" -s "$serial" logcat 2>&1 | grep -E 'com.zentrio.mteij|AndroidRuntime|chromium|Tauri|tauri|RustStdoutStderr|WebView|net::'
    ;;
  *)
    echo "Usage: $0 {build|install|dev|logcat}" >&2
    exit 1
    ;;
esac
