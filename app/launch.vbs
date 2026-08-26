' CSCI5802Fall2026Student - launch.vbs
' Runs launch.ps1 with no console window at all (the desktop shortcut
' points here so nothing flashes on screen).
Dim shell, fso, here
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & here & "\launch.ps1""", 0, False
