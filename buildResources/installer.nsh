!include x64.nsh
!include LogicLib.nsh
!include StrFunc.nsh
${StrRep}

!macro preInit

    ${If} ${RunningX64}
        SetRegView 64
    ${EndIf}

    ${StrRep} $0 "${UNINSTALL_REGISTRY_KEY}" "Software" "SOFTWARE"
    ${StrRep} $1 "${INSTALL_REGISTRY_KEY}" "Software" "SOFTWARE"

    ReadRegStr $R0 HKCU "$0" "UninstallString"
    ReadRegStr $R1 HKCU "$1" "InstallLocation"

    StrCmp $R0 "" 0 +4

    ReadRegStr $R0 HKLM "$0" "UninstallString"
    ReadRegStr $R1 HKLM "$1" "InstallLocation"

    StrCmp $R0 "" 0 done
    StrCmp $R1 "" 0 done

    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\EST Studio"
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "C:\EST Studio"

done:
    ${If} ${RunningX64}
        SetRegView LastUsed
    ${EndIf}

!macroend

!macro customInstall

    SetOutPath "$INSTDIR\resources"
    File "/oname=ESTStudio-${VERSION}.ico" "${BUILD_RESOURCES_DIR}\OpenBlockDesktop.ico"
    File "/oname=ESTStudioProject-${VERSION}.ico" "${BUILD_RESOURCES_DIR}\OpenBlockFile.ico"
    SetOutPath "$INSTDIR"

    StrCpy $R2 "$INSTDIR\resources\ESTStudio-${VERSION}.ico"
    StrCpy $R3 "$INSTDIR\resources\ESTStudioProject-${VERSION}.ico"

    WriteRegStr SHELL_CONTEXT "Software\Classes\.ests" "" "EST Studio project file"
    WriteRegStr SHELL_CONTEXT "Software\Classes\EST Studio project file" "" "EST Studio project file"
    WriteRegStr SHELL_CONTEXT "Software\Classes\EST Studio project file\DefaultIcon" "" "$R3"

    ${IfNot} ${isNoDesktopShortcut}
        Delete "$newDesktopLink"
        CreateShortCut "$newDesktopLink" "$appExe" "" "$R2" 0 "" "" "${APP_DESCRIPTION}"
        ClearErrors
        WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${EndIf}

    ${If} ${FileExists} "$newStartMenuLink"
        Delete "$newStartMenuLink"
        CreateShortCut "$newStartMenuLink" "$appExe" "" "$R2" 0 "" "" "${APP_DESCRIPTION}"
        ClearErrors
        WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
    ${EndIf}

    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'

!macroend

!macro customUnInstall

    ${If} ${RunningX64}
        SetRegView 64
    ${EndIf}

    DeleteRegKey HKLM "${INSTALL_REGISTRY_KEY}"
    DeleteRegKey HKCU "${INSTALL_REGISTRY_KEY}"
    Delete "$INSTDIR\resources\ESTStudio-*.ico"
    Delete "$INSTDIR\resources\ESTStudioProject-*.ico"

    ${If} ${RunningX64}
        SetRegView LastUsed
    ${EndIf}

 !macroend
