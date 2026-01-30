# PowerShell script to restart Supabase local instance
Write-Host "Restarting Supabase local instance..." -ForegroundColor Yellow

# Stop first
& "$PSScriptRoot\stop-supabase.ps1"

# Wait a moment
Start-Sleep -Seconds 2

# Start
& "$PSScriptRoot\start-supabase.ps1"
