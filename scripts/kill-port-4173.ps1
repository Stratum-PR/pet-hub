# PowerShell script to kill processes using port 4173 (Vite preview)
Write-Host "Checking for processes using port 4173..." -ForegroundColor Yellow

function Kill-Port4173 {
    $killed = $false

    $connections = netstat -ano | findstr :4173

    if ($connections) {
        Write-Host "Found processes using port 4173:" -ForegroundColor Yellow

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

$attempts = 0
$maxAttempts = 5

while ($attempts -lt $maxAttempts) {
    $killed = Kill-Port4173

    if ($killed) {
        Start-Sleep -Milliseconds 500
        $attempts++
    } else {
        break
    }

    $stillInUse = netstat -ano | findstr :4173
    if (-not $stillInUse) {
        break
    }
}

$finalCheck = netstat -ano | findstr :4173
if ($finalCheck) {
    Write-Host "Warning: Port 4173 may still be in use. Retrying..." -ForegroundColor Yellow
    Start-Sleep -Seconds 1
    Kill-Port4173
} else {
    Write-Host "Port 4173 is now free." -ForegroundColor Green
}
