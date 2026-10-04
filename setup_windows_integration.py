import winreg
import os
import sys
import ctypes

EXE_PATH = r"C:\Users\crs14\.gemini\antigravity\scratch\vidamp-desktop-player\dist-app\VidAmp Player-win32-x64\VidAmp Player.exe"
EXE_DIR = r"C:\Users\crs14\.gemini\antigravity\scratch\vidamp-desktop-player\dist-app\VidAmp Player-win32-x64"
ICON_PATH = f'"{EXE_PATH}",0'
APP_NAME = "VidAmp Player"
PROG_ID = "VidAmp.AssocFile"
CMD_STR = f'"{EXE_PATH}" "%1"'
DIR_CMD_STR = f'"{EXE_PATH}" "%V"'

VIDEO_EXTS = ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.ts', '.flv', '.wmv', '.m4v', '.ogv', '.3gp', '.m2ts', '.mts', '.vob', '.divx']
AUDIO_EXTS = ['.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a', '.opus', '.wma']
ALL_EXTS = VIDEO_EXTS + AUDIO_EXTS

def set_reg_val(root, subkey, name, value, reg_type=winreg.REG_SZ):
    try:
        key = winreg.CreateKey(root, subkey)
        winreg.SetValueEx(key, name, 0, reg_type, value)
        winreg.CloseKey(key)
    except Exception as e:
        print(f"Error setting {subkey}\\{name}: {e}")

def get_reg_val(root, subkey, name):
    try:
        key = winreg.OpenKey(root, subkey)
        val, _ = winreg.QueryValueEx(key, name)
        winreg.CloseKey(key)
        return val
    except Exception:
        return None

print("[1/7] Registering Applications\\VidAmp Player.exe...")
app_key = r"Software\Classes\Applications\VidAmp Player.exe"
set_reg_val(winreg.HKEY_CURRENT_USER, app_key, "", APP_NAME)
set_reg_val(winreg.HKEY_CURRENT_USER, app_key, "FriendlyAppName", APP_NAME)
set_reg_val(winreg.HKEY_CURRENT_USER, app_key, "ApplicationCompany", "VidAmp")
set_reg_val(winreg.HKEY_CURRENT_USER, f"{app_key}\\DefaultIcon", "", ICON_PATH)
set_reg_val(winreg.HKEY_CURRENT_USER, f"{app_key}\\shell\\open", "", f"Play with {APP_NAME}")
set_reg_val(winreg.HKEY_CURRENT_USER, f"{app_key}\\shell\\open", "Icon", ICON_PATH)
set_reg_val(winreg.HKEY_CURRENT_USER, f"{app_key}\\shell\\open", "FriendlyAppName", f"Play with {APP_NAME}")
set_reg_val(winreg.HKEY_CURRENT_USER, f"{app_key}\\shell\\open\\command", "", CMD_STR)

for ext in ALL_EXTS:
    set_reg_val(winreg.HKEY_CURRENT_USER, f"{app_key}\\SupportedTypes", ext, "")

print("[2/7] Registering App Paths...")
app_paths = r"Software\Microsoft\Windows\CurrentVersion\App Paths\VidAmp Player.exe"
set_reg_val(winreg.HKEY_CURRENT_USER, app_paths, "", EXE_PATH)
set_reg_val(winreg.HKEY_CURRENT_USER, app_paths, "Path", EXE_DIR)

print("[3/7] Registering ProgID VidAmp.AssocFile...")
prog_key = f"Software\\Classes\\{PROG_ID}"
set_reg_val(winreg.HKEY_CURRENT_USER, prog_key, "", "VidAmp Media File")
set_reg_val(winreg.HKEY_CURRENT_USER, prog_key, "FriendlyTypeName", "VidAmp Media File")
set_reg_val(winreg.HKEY_CURRENT_USER, f"{prog_key}\\DefaultIcon", "", ICON_PATH)
set_reg_val(winreg.HKEY_CURRENT_USER, f"{prog_key}\\shell\\open", "", f"Play with {APP_NAME}")
set_reg_val(winreg.HKEY_CURRENT_USER, f"{prog_key}\\shell\\open", "Icon", ICON_PATH)
set_reg_val(winreg.HKEY_CURRENT_USER, f"{prog_key}\\shell\\open", "MultiSelectModel", "Player")
set_reg_val(winreg.HKEY_CURRENT_USER, f"{prog_key}\\shell\\open\\command", "", CMD_STR)

set_reg_val(winreg.HKEY_CURRENT_USER, f"{prog_key}\\shell\\PlayWithVidAmp", "", f"Play with {APP_NAME}")
set_reg_val(winreg.HKEY_CURRENT_USER, f"{prog_key}\\shell\\PlayWithVidAmp", "Icon", ICON_PATH)
set_reg_val(winreg.HKEY_CURRENT_USER, f"{prog_key}\\shell\\PlayWithVidAmp", "MultiSelectModel", "Player")
set_reg_val(winreg.HKEY_CURRENT_USER, f"{prog_key}\\shell\\PlayWithVidAmp\\command", "", CMD_STR)

print("[4/7] Registering RegisteredApplications & Capabilities (Windows Default Apps)...")
cap_key = r"Software\VidAmp\Capabilities"
set_reg_val(winreg.HKEY_CURRENT_USER, cap_key, "ApplicationName", APP_NAME)
set_reg_val(winreg.HKEY_CURRENT_USER, cap_key, "ApplicationDescription", "Modern high-performance standalone PC Video Player desktop app.")
for ext in ALL_EXTS:
    set_reg_val(winreg.HKEY_CURRENT_USER, f"{cap_key}\\FileAssociations", ext, PROG_ID)
set_reg_val(winreg.HKEY_CURRENT_USER, r"Software\RegisteredApplications", "VidAmp Player", cap_key)

print("[5/7] Registering Per-Extension OpenWith and SystemFileAssociations...")
for ext in ALL_EXTS:
    # HKCU\Software\Classes\<ext>\OpenWithProgids
    set_reg_val(winreg.HKEY_CURRENT_USER, f"Software\\Classes\\{ext}\\OpenWithProgids", PROG_ID, b"", winreg.REG_NONE)
    # HKCU\Software\Classes\<ext>\OpenWithList
    set_reg_val(winreg.HKEY_CURRENT_USER, f"Software\\Classes\\{ext}\\OpenWithList\\VidAmp Player.exe", "", "")
    
    # SystemFileAssociations\<ext>\shell\PlayWithVidAmp
    sfa_ext = f"Software\\Classes\\SystemFileAssociations\\{ext}\\shell\\PlayWithVidAmp"
    set_reg_val(winreg.HKEY_CURRENT_USER, sfa_ext, "", f"Play with {APP_NAME}")
    set_reg_val(winreg.HKEY_CURRENT_USER, sfa_ext, "Icon", ICON_PATH)
    set_reg_val(winreg.HKEY_CURRENT_USER, sfa_ext, "MultiSelectModel", "Player")
    set_reg_val(winreg.HKEY_CURRENT_USER, f"{sfa_ext}\\command", "", CMD_STR)

    # Explorer\FileExts\<ext>
    fe_key = f"Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\{ext}"
    set_reg_val(winreg.HKEY_CURRENT_USER, f"{fe_key}\\OpenWithProgids", PROG_ID, b"", winreg.REG_NONE)
    
    # Add to Explorer OpenWithList MRU
    owl_key = f"{fe_key}\\OpenWithList"
    mru = get_reg_val(winreg.HKEY_CURRENT_USER, owl_key, "MRUList") or ""
    # Find if VidAmp Player.exe already in keys
    found_letter = None
    existing_letters = []
    try:
        k = winreg.OpenKey(winreg.HKEY_CURRENT_USER, owl_key)
        i = 0
        while True:
            try:
                name, val, _ = winreg.EnumValue(k, i)
                if name != "MRUList":
                    existing_letters.append(name)
                    if val.lower() == "vidamp player.exe":
                        found_letter = name
                i += 1
            except OSError:
                break
        winreg.CloseKey(k)
    except Exception:
        pass

    if not found_letter:
        # Pick next unused letter
        all_chars = "abcdefghijklmnopqrstuvwxyz"
        next_char = 'a'
        for ch in all_chars:
            if ch not in existing_letters:
                next_char = ch
                break
        set_reg_val(winreg.HKEY_CURRENT_USER, owl_key, next_char, "VidAmp Player.exe")
        new_mru = next_char + mru.replace(next_char, "")
        set_reg_val(winreg.HKEY_CURRENT_USER, owl_key, "MRUList", new_mru)

print("[6/7] Registering Global & ProgID Shell Verbs...")
# Global entries
global_verbs = [
    (r"Software\Classes\*\shell\PlayWithVidAmp", f"Play with {APP_NAME}", CMD_STR),
    (r"Software\Classes\SystemFileAssociations\video\shell\PlayWithVidAmp", f"Play with {APP_NAME}", CMD_STR),
    (r"Software\Classes\SystemFileAssociations\audio\shell\PlayWithVidAmp", f"Play with {APP_NAME}", CMD_STR),
    (r"Software\Classes\Directory\shell\PlayWithVidAmp", f"Play folder in {APP_NAME}", CMD_STR),
    (r"Software\Classes\Directory\Background\shell\PlayWithVidAmp", f"Play folder in {APP_NAME}", DIR_CMD_STR),
]
for subk, text, cmd in global_verbs:
    set_reg_val(winreg.HKEY_CURRENT_USER, subk, "", text)
    set_reg_val(winreg.HKEY_CURRENT_USER, subk, "Icon", ICON_PATH)
    set_reg_val(winreg.HKEY_CURRENT_USER, subk, "MultiSelectModel", "Player")
    set_reg_val(winreg.HKEY_CURRENT_USER, f"{subk}\\command", "", cmd)

# Also register in existing media ProgIDs that Windows Explorer prioritizes
progids = [
    "VLC.mp4", "VLC.mkv", "VLC.webm", "VLC.avi", "VLC.mov", "VLC.ts", "VLC.mp3", "VLC.flac", "VLC.wav",
    "PotPlayerMini64.MP4", "PotPlayerMini64.MKV", "PotPlayerMini64.WEBM", "PotPlayerMini64.AVI",
    "KMPlayer64.mp4", "KMPlayer64.mkv",
    "WMP11.AssocFile.MP4", "WMP11.AssocFile.MKV", "WMP11.AssocFile.AVI"
]
for pid in progids:
    pid_shell = f"Software\\Classes\\{pid}\\shell\\PlayWithVidAmp"
    set_reg_val(winreg.HKEY_CURRENT_USER, pid_shell, "", f"Play with {APP_NAME}")
    set_reg_val(winreg.HKEY_CURRENT_USER, pid_shell, "Icon", ICON_PATH)
    set_reg_val(winreg.HKEY_CURRENT_USER, pid_shell, "MultiSelectModel", "Player")
    set_reg_val(winreg.HKEY_CURRENT_USER, f"{pid_shell}\\command", "", CMD_STR)

print("[7/7] Notifying Windows Shell of changes...")
SHCNE_ASSOCCHANGED = 0x08000000
SHCNF_IDLIST = 0x0000
ctypes.windll.shell32.SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None)
print("SUCCESS: All Windows context menu, Open With, and default app associations applied!")
