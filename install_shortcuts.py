import os
import subprocess

exe_path = r"C:\Users\crs14\.gemini\antigravity\scratch\vidamp-desktop-player\dist-app\VidAmp Player-win32-x64\VidAmp Player.exe"
work_dir = r"C:\Users\crs14\.gemini\antigravity\scratch\vidamp-desktop-player\dist-app\VidAmp Player-win32-x64"
icon_path = r"C:\Users\crs14\.gemini\antigravity\scratch\vidamp-desktop-player\public\icons\icon.ico"

# Create a VBScript file to create shortcuts
vbs_content = f'''
Set WshShell = CreateObject("WScript.Shell")

' 1. Desktop Shortcut
strDesktop = WshShell.SpecialFolders("Desktop")
Set scDesktop = WshShell.CreateShortcut(strDesktop & "\\VidAmp Player.lnk")
scDesktop.TargetPath = "{exe_path}"
scDesktop.WorkingDirectory = "{work_dir}"
scDesktop.IconLocation = "{icon_path},0"
scDesktop.Description = "VidAmp Player - Standalone PC Video Player"
scDesktop.Save

' 2. Start Menu Shortcut
strPrograms = WshShell.SpecialFolders("Programs")
Set scStart = WshShell.CreateShortcut(strPrograms & "\\VidAmp Player.lnk")
scStart.TargetPath = "{exe_path}"
scStart.WorkingDirectory = "{work_dir}"
scStart.IconLocation = "{icon_path},0"
scStart.Description = "VidAmp Player - Standalone PC Video Player"
scStart.Save

' 3. Project Root Shortcut
Set scLocal = WshShell.CreateShortcut("C:\\Users\\crs14\\.gemini\\antigravity\\scratch\\vidamp-desktop-player\\VidAmp Player.lnk")
scLocal.TargetPath = "{exe_path}"
scLocal.WorkingDirectory = "{work_dir}"
scLocal.IconLocation = "{icon_path},0"
scLocal.Description = "VidAmp Player - Standalone PC Video Player"
scLocal.Save

WScript.Echo "Shortcuts successfully created!"
'''

vbs_file = r"C:\Users\crs14\.gemini\antigravity\scratch\vidamp-desktop-player\make_shortcuts.vbs"
with open(vbs_file, 'w', encoding='utf-8') as f:
    f.write(vbs_content)

res = subprocess.run(['cscript', '//nologo', vbs_file], capture_output=True, text=True)
print(res.stdout)
if os.path.exists(vbs_file):
    os.remove(vbs_file)
