# PowerShell script to help set up .env.local file
Write-Host "Setting up .env.local file..." -ForegroundColor Yellow

$envFile = ".env.local"
$envExample = ".env.local.example"

# Check if .env.local already exists
if (Test-Path $envFile) {
    Write-Host ".env.local already exists. Skipping creation." -ForegroundColor Yellow
    Write-Host "If you need to update it, edit it manually." -ForegroundColor Yellow
    exit 0
}

# Try to get Supabase local status
Write-Host "`nChecking for local Supabase instance..." -ForegroundColor Cyan
$supabaseStatus = npx supabase status 2>&1

if ($LASTEXITCODE -eq 0 -and $supabaseStatus -match "API URL") {
    Write-Host "Found local Supabase instance!" -ForegroundColor Green
    
    # Extract API URL
    $apiUrl = ($supabaseStatus | Select-String -Pattern "API URL:\s*(.+)").Matches.Groups[1].Value.Trim()
    
    # Extract anon key (look for "anon" or "service_role" key)
    $anonKey = ($supabaseStatus | Select-String -Pattern "anon key:\s*(.+)").Matches.Groups[1].Value.Trim()
    
    if ($apiUrl -and $anonKey) {
        Write-Host "`nCreating .env.local with local Supabase values..." -ForegroundColor Green
        
        @"
# Supabase Configuration (Local)
VITE_SUPABASE_URL=$apiUrl
VITE_SUPABASE_PUBLISHABLE_KEY=$anonKey

# App URL
VITE_APP_URL=http://localhost:8080
"@ | Out-File -FilePath $envFile -Encoding utf8
        
        Write-Host ".env.local created successfully!" -ForegroundColor Green
        Write-Host "`nValues:" -ForegroundColor Cyan
        Write-Host "  VITE_SUPABASE_URL=$apiUrl" -ForegroundColor Gray
        Write-Host "  VITE_SUPABASE_PUBLISHABLE_KEY=$anonKey" -ForegroundColor Gray
        Write-Host "`nPlease restart your dev server (npm run dev)" -ForegroundColor Yellow
    } else {
        Write-Host "Could not extract Supabase values. Please set up .env.local manually." -ForegroundColor Red
        Write-Host "`nRun: npx supabase status" -ForegroundColor Yellow
        Write-Host "Then create .env.local with the API URL and anon key." -ForegroundColor Yellow
    }
} else {
    Write-Host "No local Supabase instance found." -ForegroundColor Yellow
    Write-Host "`nCreating .env.local template..." -ForegroundColor Cyan
    
    @"
# Supabase Configuration
# Replace these with your Supabase project values

# For Local Supabase:
# 1. Run: npx supabase status
# 2. Copy the API URL and anon key
# 3. Update the values below

# For Remote Supabase:
# 1. Go to Supabase Dashboard > Project Settings > API
# 2. Copy the Project URL and anon/public key
# 3. Update the values below

VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here

# App URL
VITE_APP_URL=http://localhost:8080
"@ | Out-File -FilePath $envFile -Encoding utf8
    
    Write-Host ".env.local created with template values." -ForegroundColor Green
    Write-Host "Please edit .env.local and add your Supabase credentials." -ForegroundColor Yellow
    Write-Host "Then restart your dev server (npm run dev)" -ForegroundColor Yellow
}
