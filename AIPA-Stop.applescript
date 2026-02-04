#!/usr/bin/osascript

-- AIPA Stop AppleScript
-- This stops all AIPA services

on run
    set projectPath to "/Users/tornikeminadze/Desktop/Getting-my-life-back/XX8/aipa"
    set stopScript to projectPath & "/scripts/stop-aipa.sh"
    
    -- Make script executable and run
    do shell script "chmod +x " & quoted form of stopScript
    do shell script quoted form of stopScript
    
    display notification "AIPA services have been stopped" with title "AIPA" sound name "Glass"
end run
