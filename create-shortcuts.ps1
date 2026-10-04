$appDir = "C:\Users\crs14\.gemini\antigravity\scratch\vidamp-desktop-player"
$iconPath = Join-Path $appDir "public\icons\icon.ico"
$packagedExe = Join-Path $appDir "dist-app\VidAmp Player-win32-x64\VidAmp Player.exe"
$electronExe = Join-Path $appDir "node_modules\electron\dist\electron.exe"

$targetExe = if (Test-Path $packagedExe) { $packagedExe } else { $electronExe }
$arguments = if (Test-Path $packagedExe) { "" } else { "`"$appDir`"" }

$WshShell = New-Object -ComObject WScript.Shell

# 1. Desktop Shortcut
$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$desktopShortcutPath = Join-Path $desktopPath "VidAmp Player.lnk"
$shortcut = $WshShell.CreateShortcut($desktopShortcutPath)
$shortcut.TargetPath = $targetExe
$shortcut.Arguments = $arguments
$shortcut.WorkingDirectory = $appDir
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = "VidAmp Player — Standalone PC Video Player"
$shortcut.Save()
Write-Host "Created Desktop Shortcut: $desktopShortcutPath"

# 2. Start Menu Shortcut
$startMenuPath = [System.Environment]::GetFolderPath('Programs')
$startMenuShortcutPath = Join-Path $startMenuPath "VidAmp Player.lnk"
$startShortcut = $WshShell.CreateShortcut($startMenuShortcutPath)
$startShortcut.TargetPath = $targetExe
$startShortcut.Arguments = $arguments
$startShortcut.WorkingDirectory = $appDir
$startShortcut.IconLocation = "$iconPath,0"
$startShortcut.Description = "VidAmp Player — Standalone PC Video Player"
$startShortcut.Save()
Write-Host "Created Start Menu Shortcut: $startMenuShortcutPath"

# 3. Project Folder Shortcut
$projectShortcutPath = Join-Path $appDir "Launch VidAmp Player.lnk"
$projShortcut = $WshShell.CreateShortcut($projectShortcutPath)
$projShortcut.TargetPath = $targetExe
$projShortcut.Arguments = $arguments
$projShortcut.WorkingDirectory = $appDir
$projShortcut.IconLocation = "$iconPath,0"
$projShortcut.Description = "VidAmp Player — Standalone PC Video Player"
$projShortcut.Save()
Write-Host "Created Local Folder Shortcut: $projectShortcutPath"
