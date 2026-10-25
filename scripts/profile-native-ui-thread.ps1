# Read instruction pointers from this workspace's EST window thread only.
# Does not read input text, change Windows settings, inject code, or retain a memory dump.
param([Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference = 'Stop'
if ([IntPtr]::Size -ne 8) { throw 'Use 64-bit PowerShell' }
$estTarget = @(Get-Process | Where-Object { $_.MainWindowTitle -eq 'EST Studio 2.8.76' })
if ($estTarget.Count -ne 1) { throw 'Expected exactly one current EST Studio window' }
$estTarget = $estTarget[0]
$expectedBinary = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../node_modules/electron/dist/electron.exe'))
if ($estTarget.Path -ne $expectedBinary) { throw 'Unexpected application binary' }
if (Test-Path -LiteralPath $OutputPath) { throw 'Output must be new' }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class EstThreadSample {
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("kernel32.dll",SetLastError=true)] public static extern IntPtr OpenThread(uint access,bool inherit,uint id);
    [DllImport("kernel32.dll",SetLastError=true)] public static extern uint SuspendThread(IntPtr thread);
    [DllImport("kernel32.dll",SetLastError=true)] public static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll",SetLastError=true)] public static extern bool GetThreadContext(IntPtr thread,IntPtr context);
    [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
    public static long Sample(IntPtr thread) {
        IntPtr allocation=Marshal.AllocHGlobal(1264);
        IntPtr context=new IntPtr((allocation.ToInt64()+15)&~15L);
        try {
            for(int i=0;i<1232;i+=8)Marshal.WriteInt64(context,i,0);
            Marshal.WriteInt32(context,48,0x100001);
            if(SuspendThread(thread)==0xffffffff)throw new System.ComponentModel.Win32Exception();
            try {
                if(!GetThreadContext(thread,context))throw new System.ComponentModel.Win32Exception();
                return Marshal.ReadInt64(context,248);
            } finally { ResumeThread(thread); }
        } finally { Marshal.FreeHGlobal(allocation); }
    }
}
'@
[uint32]$estOwnerId = 0
$estThreadId = [EstThreadSample]::GetWindowThreadProcessId($estTarget.MainWindowHandle,[ref]$estOwnerId)
if ($estOwnerId -ne $estTarget.Id) { throw 'Window identity changed' }
$estThreadHandle = [EstThreadSample]::OpenThread(0x004A,$false,$estThreadId)
if ($estThreadHandle -eq [IntPtr]::Zero) { throw 'Could not open EST UI thread for diagnostic sampling' }
$estModules = @($estTarget.Modules | ForEach-Object {
    [pscustomobject]@{Name=$_.ModuleName;Start=$_.BaseAddress.ToInt64();End=$_.BaseAddress.ToInt64()+$_.ModuleMemorySize}
})
$estHits = @{}
$estTimer = [Diagnostics.Stopwatch]::StartNew()
try {
    for ($estIndex=0;$estIndex -lt 100;$estIndex++) {
        $estAddress = [EstThreadSample]::Sample($estThreadHandle)
        $estModule = $estModules | Where-Object { $estAddress -ge $_.Start -and $estAddress -lt $_.End } | Select-Object -First 1
        $estLabel = if ($estModule) { $estModule.Name+'+0x'+($estAddress-$estModule.Start).ToString('x') } else { 'unmapped' }
        $estHits[$estLabel]++
        Start-Sleep -Milliseconds 25
    }
} finally { [void][EstThreadSample]::CloseHandle($estThreadHandle) }
$estResult = [ordered]@{ProcessId=$estTarget.Id;UiThreadId=$estThreadId;DurationMs=$estTimer.ElapsedMilliseconds;
    SampleCount=100;NoTextRecorded=$true;DeviceCommandsSent=0;
    Hits=@($estHits.GetEnumerator() | Sort-Object Value -Descending | ForEach-Object {
        [ordered]@{Location=$_.Key;Samples=$_.Value}
    })}
$estJson = $estResult | ConvertTo-Json -Depth 5
$estStream = [IO.File]::Open([IO.Path]::GetFullPath($OutputPath),[IO.FileMode]::CreateNew)
try { $estBytes=[Text.Encoding]::UTF8.GetBytes($estJson);$estStream.Write($estBytes,0,$estBytes.Length) }
finally { $estStream.Dispose() }
$estJson
