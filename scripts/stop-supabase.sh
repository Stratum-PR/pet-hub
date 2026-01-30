#!/bin/bash
# Bash script to stop Supabase local instance
echo "Stopping Supabase local instance..."

supabase stop

# Kill any remaining Supabase processes (Linux/Mac)
pkill -f supabase || true
pkill -f postgres || true
pkill -f kong || true

echo "Supabase stopped."
