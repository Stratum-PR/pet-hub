#!/bin/bash
# Bash script to kill processes using port 8080
echo "Checking for processes using port 8080..."

# Find processes using port 8080
PIDS=$(lsof -ti :8080 2>/dev/null)

if [ -z "$PIDS" ]; then
    echo "No processes found using port 8080."
    exit 0
fi

echo "Found processes using port 8080:"
for PID in $PIDS; do
    PROCESS_NAME=$(ps -p $PID -o comm= 2>/dev/null)
    echo "Killing process: $PROCESS_NAME (PID: $PID)"
    kill -9 $PID 2>/dev/null || true
done

echo "Port 8080 should now be free."
