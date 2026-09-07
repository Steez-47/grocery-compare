# Browser companion 0.6.0

The companion sends your Grocery Compare basket to retailer tabs in your own browser. This build supports Chrome and Edge; other Chromium browsers have not been verified. Firefox and Safari do not have companion builds.

## Install or update

1. Install the updated Grocery Compare desktop app. In checkout, select **Set up browser companion → Companion folder**.
2. Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, choose **Load unpacked**, and select that folder. Keep it in place. If already installed from that same folder, click **Reload** instead. If replacing a different folder, remove the old entry first; keep only one copy enabled.
3. Pin the Grocery Compare toolbar icon. Open it and **Enable** each retailer you use. The browser asks for permission separately for each retailer.
4. In the desktop app, select **Connect browser**. Use the same browser profile where the companion is installed. If your default browser differs, copy the full connection-page address to the intended browser immediately. Codes expire after two minutes.
5. Open each retailer using **Cart** in the companion or **Open browser** in the app. Sign in, return to the app, and select **Send items**. Review the store cart before payment.

The normal installed companion folder is `resources/browser-extension` under the app installation. A standalone ZIP is also provided: extract it to a permanent folder before using Load unpacked. Do not load directly from the ZIP or a temporary download preview. Use the updated desktop app with this companion; older apps do not have its new status/pause endpoints.

This build is not published in Chrome Web Store or Edge Add-ons. A Windows installer cannot silently install an unpacked extension into a normal browser. Store publication is still required for a standard one-click install and automatic extension updates.

## Everyday use

- **Ready to send** checks the desktop app connection. It does not imply that you are signed in at a retailer.
- **Enable / Turn off** controls cart access to each retailer independently. Cart links work even without access.
- **Pause / Resume** stops new work without forgetting the connection. An already submitted store request may complete; check the cart before retrying.
- **Disconnect** removes the local pairing and revokes it in the running desktop app. If the app is closed or unreachable, disconnect from its setup dialog as well to remove its saved pairing.
- **Check again** reconnects immediately after you reopen the app. Automatic retries back off when the app is unavailable.
- **Setup & help** explains installation, upgrades, pairing, retailer login, and troubleshooting. A small recent-activity line shows the last store action, without storing basket contents or retailer responses.

## Browser isolation

Only loopback access is required at installation. New World and Woolworths website access is optional; the extension has no Google/email host permission, cookie API, browsing-data API, proxy API, request interception, history access, or password access. It does not change browser launch settings, sync, or security configuration. It is disabled in incognito.

The sole content script is restricted to the app's `/connect` page on `127.0.0.1:47391` and runs only in the top frame. Pairing uses a random, single-use, two-minute code. Authenticated loopback calls require the paired extension origin plus a token, omit cookies, reject redirects, and have time limits. Connection credentials live in `browser-link.json` in the app profile and in extension local storage; retailer login cookies stay in the browser.

Cart jobs allow only fixed retailer operations. Unknown and expired commands are rejected before tab access. Sending items requires an existing retailer tab and permission, does not open or focus another tab, and checks its origin before injection and again inside the fixed retailer function. Google sign-in redirects cannot receive the injected code. New World authentication happens in its retailer tab and its token stays there. No payment operation is supported.

The worker polls locally while connected, yields periodically, and keeps a recovery alarm for worker suspension. Offline retries back off to five minutes. Unpaired/paused instances do no polling. Cart writes are never replayed automatically. Existing transfer logic sets target quantities, preserves unrelated items, and reads back the retailer cart before confirming success.

## Reported Google / email issue

The old code did not have Google/email access or cookie/proxy permissions either, so code inspection alone does not establish the cause of the reported logouts. Browser/profile and signed-in reproduction remain unconfirmed. This update improves isolation and connection behavior; it is not a verified fix for that specific incident. If it recurs, disable the companion and compare behavior without clearing cookies or resetting the browser.

## Verification

`node --test tests/*.test.cjs` covers pairing, revocation, origin/token checks, pause races, optional permissions, expired/unsupported commands, no-tab behavior, Google redirects, bounded offline retries, and simulated verified cart transfer.

`node scripts/verify-companion.cjs` runs the actual extension in a disposable Edge profile, with the app closed so port 47391 is free. It checks pairing, actual popup rendering, permission denial, pause/resume, disconnect, and preservation of a synthetic Google-domain cookie. It saves screenshots and a report in `test-results/companion`. It never reads the normal browser profile or performs cart writes. A synthetic cookie check is not a signed-in Google/Gmail test. Signed-in retailer writes and other browsers still need account-holder validation.

## Primary references

- [Chrome optional permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- [Extension service-worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Extension distribution](https://developer.chrome.com/docs/extensions/how-to/distribute)
