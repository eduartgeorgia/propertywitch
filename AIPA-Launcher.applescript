#!/usr/bin/osascript

-- AIPA Launcher AppleScript
-- This creates a clickable app for macOS

on run
    set projectPath to "/Users/tornikeminadze/Desktop/Getting-my-life-back/XX8/aipa"
    set launcherScript to projectPath & "/scripts/launcher.sh"
    
    -- Make script executable and run in Terminal
    do shell script "chmod +x " & quoted form of launcherScript
    
    tell application "Terminal"
        activate
        do script "cd " & quoted form of projectPath & " && ./scripts/launcher.sh"
    end tell
end run
