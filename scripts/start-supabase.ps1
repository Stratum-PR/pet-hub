# PowerShell script to start Supabase local instance (only if not already running)
Write-Host "Checking if Supabase is already running..." -ForegroundColor Yellow

# Check if Supabase is already running by checking the status
$status = supabase status 2>&1
if ($LASTEXITCODE -eq 0 -and $status -match "API URL") {
    Write-Host "Supabase is already running!" -ForegroundColor Green
    supabase status
    exit 0
}

Write-Host "Starting Supabase local instance..." -ForegroundColor Yellow
supabase start

if ($LASTEXITCODE -eq 0) {
    Write-Host "Supabase started successfully!" -ForegroundColor Green
    supabase status
} else {
    Write-Host "Failed to start Supabase. Make sure ports are available." -ForegroundColor Red
    exit 1
}
