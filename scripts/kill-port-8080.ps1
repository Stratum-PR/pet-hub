# PowerShell script to kill processes using port 8080
Write-Host "Checking for processes using port 8080..." -ForegroundColor Yellow

# Function to kill processes on port 8080
function Kill-Port8080 {
    $killed = $false
    
    # Get processes using port 8080
    $connections = netstat -ano | findstr :8080
    
    if ($connections) {
        Write-Host "Found processes using port 8080:" -ForegroundColor Yellow
        
        # Extract PIDs from netstat output
        $pids = $connections | ForEach-Object {
            $parts = $_ -split '\s+'
            $processId = $parts[-1]
            if ($processId -match '^\d+$') {
                $processId
            }
        } | Sort-Object -Unique
        
        foreach ($processId in $pids) {
            try {
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "Killing process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Red
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    $killed = $true
                }
            } catch {
                Write-Host "Could not kill process $($processId): $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    }
    
    return $killed
}

# Kill processes and wait for port to be free
$attempts = 0
$maxAttempts = 5

while ($attempts -lt $maxAttempts) {
    $killed = Kill-Port8080
    
    if ($killed) {
        # Wait a moment for port to be released
        Start-Sleep -Milliseconds 500
        $attempts++
    } else {
        break
    }
    
    # Check if port is still in use
    $stillInUse = netstat -ano | findstr :8080
    if (-not $stillInUse) {
        break
    }
}

# Final check
$finalCheck = netstat -ano | findstr :8080
if ($finalCheck) {
    Write-Host "Warning: Port 8080 may still be in use. Retrying..." -ForegroundColor Yellow
    Start-Sleep -Seconds 1
    Kill-Port8080
} else {
    Write-Host "Port 8080 is now free." -ForegroundColor Green
}
