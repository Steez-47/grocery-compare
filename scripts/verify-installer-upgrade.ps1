$ErrorActionPreference='Stop'
$groceryRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$groceryPackage=Get-Content -LiteralPath (Join-Path $groceryRoot 'package.json') -Raw | ConvertFrom-Json
$groceryVersion=$groceryPackage.version
$groceryExe=Join-Path $env:LOCALAPPDATA 'Programs\Grocery Compare\Grocery Compare.exe'
$groceryInstaller=Join-Path $groceryRoot "release-$groceryVersion\Grocery-Compare-Setup-$groceryVersion.exe"
if(-not (Test-Path -LiteralPath $groceryExe)){throw 'An existing default per-user installation is required for this upgrade test.'}
if(-not (Test-Path -LiteralPath $groceryInstaller)){throw 'Build the release installer first.'}
$groceryOldVersion=(Get-Item -LiteralPath $groceryExe).VersionInfo.FileVersion
$groceryBackup=Join-Path $groceryRoot ('test-results\installer-upgrade-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $groceryBackup -Force | Out-Null
$groceryWindows=Get-Process -Name 'Grocery Compare' -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq $groceryExe -and $_.MainWindowHandle -ne 0}
foreach($groceryWindow in $groceryWindows){[void]$groceryWindow.CloseMainWindow();if(-not $groceryWindow.WaitForExit(10000)){throw 'The app is still closing; no installation was attempted.'}}
$groceryProfile=Join-Path $env:APPDATA 'grocery-compare'
$groceryHashes=@{}
foreach($groceryName in @('shopping.json','recommendations.json','browser-link.json','Preferences','Local State')){
 $groceryFile=Join-Path $groceryProfile $groceryName
 if(Test-Path -LiteralPath $groceryFile){Copy-Item -LiteralPath $groceryFile -Destination (Join-Path $groceryBackup $groceryName);$groceryHashes[$groceryName]=(Get-FileHash -LiteralPath $groceryFile -Algorithm SHA256).Hash}
}
$groceryEntriesBefore=@(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' | Where-Object {$_.DisplayName -match '^Grocery Compare(?: \d.*)?$'})
if($groceryEntriesBefore.Count -ne 1){throw 'Expected exactly one existing per-user installation entry.'}
$groceryInstall=Start-Process -FilePath $groceryInstaller -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
if($groceryInstall.ExitCode -ne 0){throw "Installer failed: $($groceryInstall.ExitCode)"}
$groceryInstalledVersion=(Get-Item -LiteralPath $groceryExe).VersionInfo.FileVersion
if($groceryInstalledVersion -ne $groceryVersion){throw "Unexpected installed version: $groceryInstalledVersion"}
foreach($groceryName in $groceryHashes.Keys){
 if((Get-FileHash -LiteralPath (Join-Path $groceryProfile $groceryName) -Algorithm SHA256).Hash -ne $groceryHashes[$groceryName]){throw "Profile file changed during upgrade: $groceryName. Backup: $groceryBackup"}
}
$groceryEntriesAfter=@(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' | Where-Object {$_.DisplayName -match '^Grocery Compare(?: \d.*)?$'})
if($groceryEntriesAfter.Count -ne 1 -or $groceryEntriesBefore[0].PSChildName -ne $groceryEntriesAfter[0].PSChildName){throw 'Upgrade changed or duplicated the installer identity.'}
if($groceryEntriesAfter[0].DisplayVersion -ne $groceryVersion){throw 'The Windows app entry does not show the new version.'}
$groceryReport=[pscustomobject]@{PreviousVersion=$groceryOldVersion;InstalledVersion=$groceryInstalledVersion;SameInstallPath=$true;SameRegistryIdentity=$true;ProfileFilesPreserved=@($groceryHashes.Keys);Backup=$groceryBackup}
$groceryReport | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $groceryBackup 'verification.json')
$groceryReport | ConvertTo-Json
