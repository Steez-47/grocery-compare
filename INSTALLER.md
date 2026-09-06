# Windows installer and upgrades

Build with `npm run package`. Publish the generated `Grocery-Compare-Setup-VERSION.exe` as a GitHub Release asset, alongside its SHA-256 checksum. The installer bundles Electron, the production app and the browser companion; the target computer does not need Node.js or developer tools. This build targets Windows x64.

Close the app, then run a newer installer using the same Windows account. The installer detects the existing installation, replaces the app files, and retains the installation path and local profile. Do not uninstall first. There is no automatic background updater.

## Compatibility contract

Keep these values stable in every release:

- Package name `grocery-compare` (the Electron profile directory).
- Application ID `nz.grocerycompare.desktop` (the deterministic NSIS installation GUID).
- Product name `Grocery Compare` and per-user installation mode.
- `deleteAppDataOnUninstall: false`.

Increment the package version and lockfile version for each release. `tests/installer.test.cjs` guards this contract. Future data-format changes still require migrations; an installer cannot make incompatible application schemas safe.

The NSIS upgrade implementation passes `--updated` to the previous uninstaller, retains application data, and reads the existing installation registry entry. This is also described in the [electron-builder NSIS documentation](https://www.electron.build/docs/nsis/).

Local data lives under `%APPDATA%\grocery-compare`, separate from installed app binaries: shopping.json, recommendations.json, settings and browser-session data. The release file allowlist excludes local profiles, test results, research captures and credentials.

The GitHub repository and release downloads are public. No GitHub account is needed. The installer is unsigned, so Windows may show an unknown-publisher warning.
