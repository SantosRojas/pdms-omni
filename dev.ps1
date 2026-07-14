$root = Get-Location

Write-Host "=== Iniciando backend (cargo run) ===" -ForegroundColor Green
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:root
    cargo run
}

Start-Sleep -Seconds 3

Write-Host "=== Iniciando frontend (npm run dev) ===" -ForegroundColor Green
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "$using:root\dashboard-ts"
    npm run dev
}

try {
    while ($backendJob.State -eq 'Running' -and $frontendJob.State -eq 'Running') {
        Receive-Job $backendJob
        Receive-Job $frontendJob
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "`n=== Deteniendo procesos ===" -ForegroundColor Yellow
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -Force -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host "=== Listo ===" -ForegroundColor Green
}
