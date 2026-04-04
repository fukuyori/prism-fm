!macro customInit
  ; Kill running prism-fm process before installation
  nsExec::ExecToLog 'taskkill /F /IM "prism-fm.exe"'
  Sleep 1000

  ; Check for existing installation and remove it without running the old uninstaller.
  ; This avoids the "old-uninstaller.exe" rename that gets blocked by Windows Defender
  ; on unsigned builds.
  ReadRegStr $0 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "UninstallString"
  ${If} $0 != ""
    ReadRegStr $1 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "InstallLocation"
    ${If} $1 != ""
      RMDir /r "$1"
    ${EndIf}
    DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}"
  ${EndIf}
!macroend

!macro customUnInit
  ; Kill running prism-fm process before uninstallation
  nsExec::ExecToLog 'taskkill /F /IM "prism-fm.exe"'
  Sleep 1000
!macroend
