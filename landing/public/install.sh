#!/bin/bash
set -e

echo "=> Fetching latest Zentrio release..."

# Get the latest release JSON from GitHub API
LATEST_RELEASE=$(curl -s https://api.github.com/repos/mteij/Zentrio/releases/latest)

# Extract asset download URLs
DEB_URL=$(echo "$LATEST_RELEASE" | grep -o '"browser_download_url": "[^"]*\.deb"' | cut -d '"' -f 4 | head -n 1)
RPM_URL=$(echo "$LATEST_RELEASE" | grep -o '"browser_download_url": "[^"]*\.rpm"' | cut -d '"' -f 4 | head -n 1)

# Detect package manager
if command -v dpkg >/dev/null 2>&1; then
    PKG_MGR="dpkg"
    FILE_EXT=".deb"
    DOWNLOAD_URL="$DEB_URL"
elif command -v rpm >/dev/null 2>&1; then
    PKG_MGR="rpm"
    FILE_EXT=".rpm"
    DOWNLOAD_URL="$RPM_URL"
else
    echo "Error: Neither dpkg nor rpm found. Unsupported Linux distribution."
    exit 1
fi

if [ -z "$DOWNLOAD_URL" ]; then
    echo "Error: Could not find a $FILE_EXT package for the latest release."
    exit 1
fi

echo "=> Downloading $DOWNLOAD_URL..."
TMP_FILE=$(mktemp /tmp/zentrio_XXXXXX$FILE_EXT)
curl -L -o "$TMP_FILE" "$DOWNLOAD_URL"

echo "=> Installing package..."
if command -v sudo >/dev/null 2>&1; then
    if [ "$PKG_MGR" = "dpkg" ]; then
        sudo dpkg -i "$TMP_FILE" || sudo apt-get install -f -y
    else
        if command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y "$TMP_FILE"
        elif command -v yum >/dev/null 2>&1; then
            sudo yum install -y "$TMP_FILE"
        else
            sudo rpm -i "$TMP_FILE"
        fi
    fi
else
    if [ "$PKG_MGR" = "dpkg" ]; then
        dpkg -i "$TMP_FILE" || apt-get install -f -y
    else
        if command -v dnf >/dev/null 2>&1; then
            dnf install -y "$TMP_FILE"
        elif command -v yum >/dev/null 2>&1; then
            yum install -y "$TMP_FILE"
        else
            rpm -i "$TMP_FILE"
        fi
    fi
fi

# Clean up
rm "$TMP_FILE"
echo "=> Zentrio installed successfully!"
