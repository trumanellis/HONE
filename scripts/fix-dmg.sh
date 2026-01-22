#!/bin/bash
# Fix .VolumeIcon.icns visibility in DMG

set -e

DMG_PATH="src-tauri/target/release/bundle/dmg/HONE_1.0.0_aarch64.dmg"
VOLUME_NAME="HONE"
TMP_DMG="/tmp/hone_rw.dmg"

echo "Fixing DMG..."

# Clean up any previous state
hdiutil detach /Volumes/$VOLUME_NAME 2>/dev/null || true
rm -f "$TMP_DMG"

# Convert to read-write
hdiutil convert "$DMG_PATH" -format UDRW -o "$TMP_DMG"

# Mount
hdiutil attach "$TMP_DMG" -mountpoint /Volumes/$VOLUME_NAME

# Set hidden flag on .VolumeIcon.icns
if [ -f "/Volumes/$VOLUME_NAME/.VolumeIcon.icns" ]; then
    chflags hidden "/Volumes/$VOLUME_NAME/.VolumeIcon.icns"
    echo "Hidden flag set on .VolumeIcon.icns"
fi

# Unmount with retry
sync
sleep 1
hdiutil detach /Volumes/$VOLUME_NAME || hdiutil detach /Volumes/$VOLUME_NAME -force
sleep 1

# Convert back to compressed read-only
rm "$DMG_PATH"
hdiutil convert "$TMP_DMG" -format UDZO -o "$DMG_PATH"
rm "$TMP_DMG"

echo "Done: $DMG_PATH"
