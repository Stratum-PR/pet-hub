# PowerShell script to stop Supabase local instance
Write-Host "Stopping Supabase local instance..." -ForegroundColor Yellow

# Stop Supabase using CLI
supabase stop

# Kill any remaining Supabase processes (Windows)
Get-Process | Where-Object { $_.ProcessName -like "*supabase*" -or $_.ProcessName -like "*postgres*" -or $_.ProcessName -like "*kong*" } | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Supabase stopped." -ForegroundColor Green
