Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Check if packaged exe exists
strPackagedExe = strDir & "\dist-app\VidAmp Player-win32-x64\VidAmp Player.exe"
If fso.FileExists(strPackagedExe) Then
    WshShell.Run """" & strPackagedExe & """", 1, False
Else
    strElectron = strDir & "\node_modules\electron\dist\electron.exe"
    WshShell.Run """" & strElectron & """ """ & strDir & """", 1, False
End If
