# =====================================================================
# CSCI5802Fall2026Student - app/launch.ps1
# Desktop-app launcher, same pattern as the instructor's management app:
# make sure the server is running (hidden), then open the UI in an
# app-mode browser window. Port 5182 (the management app owns 5181).
# =====================================================================
$ErrorActionPreference = "Continue"
$appDir = Split-Path $MyInvocation.MyCommand.Path -Parent
$root = Split-Path $appDir -Parent            # ...\CSCI5802Fall2026Student
$port = 5182
$url = "http://localhost:$port"

function Test-Port {
  $c = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $c.BeginConnect("127.0.0.1", $port, $null, $null)
    if ($iar.AsyncWaitHandle.WaitOne(300)) { $c.EndConnect($iar); return $true }
    return $false
  } catch { return $false } finally { $c.Close() }
}

# --- one-time build if dist is missing -------------------------------
if (-not (Test-Path (Join-Path $root "react-app\dist\index.html"))) {
  Push-Location (Join-Path $root "react-app")
  if (-not (Test-Path "node_modules")) { npm install 2>&1 | Out-Null }
  npm run build 2>&1 | Out-Null
  Pop-Location
}

# --- start the server if it is not already up ------------------------
if (-not (Test-Port)) {
  Start-Process -FilePath "node" -ArgumentList "server\server.mjs" `
    -WorkingDirectory $root -WindowStyle Hidden
  $tries = 0
  while (-not (Test-Port) -and $tries -lt 40) { Start-Sleep -Milliseconds 250; $tries++ }
}

# --- already open? raise it instead of opening another ---------------
Add-Type -Namespace Win32 -Name Fg -MemberDefinition @"
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr p);
  public delegate bool EnumProc(IntPtr h, IntPtr p);
"@

$script:found = [IntPtr]::Zero
$cb = [Win32.Fg+EnumProc]{
  param($h, $p)
  if (-not [Win32.Fg]::IsWindowVisible($h)) { return $true }
  $sb = New-Object System.Text.StringBuilder 512
  [void][Win32.Fg]::GetWindowText($h, $sb, $sb.Capacity)
  if ($sb.ToString() -like "CSCI 5802 - Student*") { $script:found = $h; return $false }
  return $true
}
[void][Win32.Fg]::EnumWindows($cb, [IntPtr]::Zero)
if ($script:found -ne [IntPtr]::Zero) {
  [void][Win32.Fg]::ShowWindow($script:found, 9)
  [void][Win32.Fg]::SetForegroundWindow($script:found)
  return
}

# --- open an app-mode window (Chrome, else Edge, else default) -------
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
$edge = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($chrome)   { Start-Process -FilePath $chrome -ArgumentList "--app=$url", "--window-size=1300,860" }
elseif ($edge) { Start-Process -FilePath $edge   -ArgumentList "--app=$url", "--window-size=1300,860" }
else           { Start-Process $url }
