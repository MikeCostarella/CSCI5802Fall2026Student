# =====================================================================
# CSCI5802Fall2026Student - app/create-shortcut.ps1
# One-time setup: puts a "CSCI 5802 Student" shortcut on your Desktop.
# =====================================================================
$ErrorActionPreference = "Stop"
$appDir = Split-Path $MyInvocation.MyCommand.Path -Parent
$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "CSCI 5802 Student.lnk"

$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($lnkPath)
$lnk.TargetPath = "wscript.exe"
$lnk.Arguments = '"' + (Join-Path $appDir "launch.vbs") + '"'
$lnk.WorkingDirectory = $appDir
$ico = Join-Path $appDir "csci5802.ico"
if (Test-Path $ico) { $lnk.IconLocation = "$ico,0" }
$lnk.Description = "CSCI 5802 Fall 2026 - student panel"
$lnk.Save()

Write-Host "Created: $lnkPath" -ForegroundColor Green
