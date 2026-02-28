#!/bin/bash
set -e

echo "=> Fetching latest Zentrio release..."

# Get the latest release JSON from GitHub API
LATEST_RELEASE=$(curl -s https://api.github.com/repos/mteij/Zentrio/releases/latest)

# Extract the .deb asset download URL
DEB_URL=$(echo "$LATEST_RELEASE" | grep -o '"browser_download_url": "[^"]*\.deb"' | cut -d '"' -f 4 | head -n 1)

if [ -z "$DEB_URL" ]; then
    echo "Error: Could not find a .deb package for the latest release."
    exit 1
fi

echo "=> Downloading $DEB_URL..."
TMP_FILE=$(mktemp /tmp/zentrio_XXXXXX.deb)
curl -L -o "$TMP_FILE" "$DEB_URL"

echo "=> Installing package..."
if command -v sudo >/dev/null 2>&1; then
    sudo dpkg -i "$TMP_FILE" || sudo apt-get install -f -y
else
    dpkg -i "$TMP_FILE" || apt-get install -f -y
fi

# Clean up
rm "$TMP_FILE"
echo "=> Zentrio installed successfully!"
