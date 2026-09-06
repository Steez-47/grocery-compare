$ErrorActionPreference='Stop'
$groceryRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$groceryInstalledExe=Join-Path $env:LOCALAPPDATA 'Programs\Grocery Compare\Grocery Compare.exe'
$groceryProfile=Join-Path $env:APPDATA 'grocery-compare'
$groceryBackup=Join-Path $groceryRoot ('test-results\before-0.5.1-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $groceryBackup -Force | Out-Null
$groceryShopping=Join-Path $groceryProfile 'shopping.json'
$groceryBefore=if(Test-Path -LiteralPath $groceryShopping){Get-Content -LiteralPath $groceryShopping -Raw | ConvertFrom-Json}else{$null}
foreach($groceryName in @('shopping.json','recommendations.json')){
 $groceryOriginal=Join-Path $groceryProfile $groceryName
 if(Test-Path -LiteralPath $groceryOriginal){Copy-Item -LiteralPath $groceryOriginal -Destination (Join-Path $groceryBackup $groceryName)}
}
$groceryWindows=Get-Process -Name 'Grocery Compare' -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq $groceryInstalledExe -and $_.MainWindowHandle -ne 0}
foreach($groceryWindow in $groceryWindows){[void]$groceryWindow.CloseMainWindow();if(-not $groceryWindow.WaitForExit(10000)){throw 'The app is still closing.'}}
$groceryInstaller=Join-Path $groceryRoot 'release-0.5.1\Grocery-Compare-Setup-0.5.1.exe'
$grocerySetup=Start-Process -FilePath $groceryInstaller -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
if($grocerySetup.ExitCode -ne 0){throw "Installer exited $($grocerySetup.ExitCode)"}
$groceryVersion=(Get-Item -LiteralPath $groceryInstalledExe).VersionInfo.FileVersion
if($groceryVersion -ne '0.5.1'){throw "Unexpected version $groceryVersion"}
if($groceryBefore){
 $groceryAfter=Get-Content -LiteralPath $groceryShopping -Raw | ConvertFrom-Json
 if(($groceryBefore.basket|ConvertTo-Json -Depth 20 -Compress) -ne ($groceryAfter.basket|ConvertTo-Json -Depth 20 -Compress)){throw 'The saved basket changed.'}
 if(($groceryBefore.stores|ConvertTo-Json -Depth 8 -Compress) -ne ($groceryAfter.stores|ConvertTo-Json -Depth 8 -Compress)){throw 'The selected stores changed.'}
}
# Open the interactive app to show the user their requested redesign.
Start-Process -FilePath $groceryInstalledExe -WindowStyle Hidden
[pscustomobject]@{Version=$groceryVersion;BasketPreserved=$true;Backup=$groceryBackup;Path=$groceryInstalledExe}|ConvertTo-Json

