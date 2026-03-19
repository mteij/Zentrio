#!/bin/bash
set -euo pipefail

echo "=> Fetching latest Zentrio release..."
LATEST_RELEASE=$(curl -fsSL "https://api.github.com/repos/mteij/Zentrio/releases?per_page=1" | sed 's/^\[//;s/\]$//')
DMG_URL=$(echo "$LATEST_RELEASE" | grep -o '"browser_download_url": "[^"]*\.dmg"' | cut -d '"' -f 4 | head -n 1)

if [ -z "$DMG_URL" ]; then
  echo "Error: Could not find a macOS .dmg in the latest release."
  exit 1
fi

TMP_DMG=$(mktemp /tmp/zentrio_XXXXXX.dmg)
MOUNT_DIR=$(mktemp -d /tmp/zentrio_mount_XXXXXX)

cleanup() {
  hdiutil detach "$MOUNT_DIR" >/dev/null 2>&1 || true
  rm -f "$TMP_DMG"
  rmdir "$MOUNT_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "=> Downloading $DMG_URL..."
curl -L -o "$TMP_DMG" "$DMG_URL"

echo "=> Mounting DMG..."
hdiutil attach "$TMP_DMG" -mountpoint "$MOUNT_DIR" -nobrowse -quiet

APP_PATH=$(find "$MOUNT_DIR" -maxdepth 1 -type d -name "*.app" | head -n 1)
if [ -z "$APP_PATH" ]; then
  echo "Error: Could not find an app bundle inside the DMG."
  exit 1
fi

APP_NAME=$(basename "$APP_PATH")
TARGET_PATH="/Applications/$APP_NAME"

echo "=> Installing $APP_NAME to /Applications..."
if ! ditto "$APP_PATH" "$TARGET_PATH" 2>/dev/null; then
  if command -v sudo >/dev/null 2>&1; then
    sudo ditto "$APP_PATH" "$TARGET_PATH"
  else
    echo "Error: Permission denied writing to /Applications (and sudo is unavailable)."
    exit 1
  fi
fi

echo "=> Zentrio installed successfully!"
echo "=> You can launch it from Applications."
