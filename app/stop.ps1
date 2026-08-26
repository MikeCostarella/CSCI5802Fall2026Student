# =====================================================================
# CSCI5802Fall2026Student - app/stop.ps1
# Stops the background server (the hidden node process on port 5182).
# =====================================================================
$ErrorActionPreference = "Continue"
$conns = Get-NetTCPConnection -LocalPort 5182 -State Listen -ErrorAction SilentlyContinue
if (-not $conns) {
  Write-Host "CSCI 5802 student server is not running." -ForegroundColor DarkGray
  exit 0
}
$conns | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
  $p = Get-Process -Id $_ -ErrorAction SilentlyContinue
  if ($p) {
    Write-Host ("Stopping {0} (pid {1})" -f $p.ProcessName, $p.Id) -ForegroundColor Cyan
    Stop-Process -Id $p.Id -Force
  }
}
Write-Host "Stopped." -ForegroundColor Green
