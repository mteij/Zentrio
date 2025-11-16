#!/bin/bash

echo "🚀 Starting Zentrio on iOS Simulator..."
echo ""

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Xcode not found. Please install Xcode from the App Store."
    echo "📖 See CAPACITOR.md for instructions."
    exit 1
fi

echo "✅ Xcode found"

# Check if CocoaPods is installed
if ! command -v pod &> /dev/null; then
    echo "❌ CocoaPods not found. Installing now..."
    sudo gem install cocoapods
    echo "✅ CocoaPods installed"
fi

# Build the app
echo ""
echo "🔨 Building Zentrio..."
cd "$(dirname "$0")/.."
bun run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Install iOS dependencies
echo ""
echo "📦 Installing iOS dependencies..."
cd ios/App
pod install
cd ../..

if [ $? -ne 0 ]; then
    echo "❌ Pod install failed"
    exit 1
fi

# Sync with Capacitor
echo ""
echo "🔄 Syncing with Capacitor..."
bunx cap sync ios
if [ $? -ne 0 ]; then
    echo "❌ Sync failed"
    exit 1
fi

# Run the app
echo ""
echo "🎯 Running Zentrio on iOS Simulator..."
bunx cap run ios

echo ""
echo "✅ Zentrio should now be running on your iOS simulator!"