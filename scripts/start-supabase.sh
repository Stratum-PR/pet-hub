#!/bin/bash
# Bash script to start Supabase local instance (only if not already running)
echo "Checking if Supabase is already running..."

# Check if Supabase is already running
if supabase status > /dev/null 2>&1; then
    echo "Supabase is already running!"
    supabase status
    exit 0
fi

echo "Starting Supabase local instance..."
supabase start

if [ $? -eq 0 ]; then
    echo "Supabase started successfully!"
    supabase status
else
    echo "Failed to start Supabase. Make sure ports are available."
    exit 1
fi
