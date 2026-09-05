# Browser checkout

Version 0.4.0 opens store checkout in the Windows default browser. The included companion supports Microsoft Edge and Google Chrome. Firefox and Safari do not yet have companion builds.

## One-time setup

1. Open the app's checkout dialog and choose **Set up browser companion**.
2. Choose **Companion folder**. In Edge, visit `edge://extensions`; in Chrome, visit `chrome://extensions`. Enable Developer mode, choose **Load unpacked**, and select that folder.
3. Choose **Connect browser** in the app. The connection page confirms pairing.
4. Choose **Open browser** for a retailer and sign in there if needed. Return to the app and choose **Send items**. Complete payment on the retailer's website.

The companion folder is installed with the app under `resources/browser-extension`. Keep it there. A later companion update may require clicking Reload on the browser's Extensions page. This private development build is not listed in either extension store; browser installation requires that one-time user action. Store logins previously entered in the app's embedded browser are separate from the normal browser login.

## What the connection does

The app uses a local connection to the companion. The companion runs a fixed set of cart requests inside the retailer's own browser tab. Existing browser cookies are applied by the browser. New World authorization is obtained inside its tab and stays there. The app does not read the browser's cookie database, copy login cookies, or import browsing history.

The connection is restricted to loopback address `127.0.0.1`, port 47391. Pairing uses a random, single-use code that expires after two minutes. Subsequent requests require the paired extension's origin and a random token. The local token is stored in `browser-link.json` in the app profile and in the companion's local storage; it is a connection credential, not a retailer login cookie. Disconnect in the app to revoke it.

The companion permits only opening retailer tabs, reading carts, selecting a pickup location and setting product quantities. It has no cookie-reading permission, generic script-evaluation command, arbitrary URL fetch command or payment operation. It polls for work while the app is connected, with a browser alarm to reconnect after the app restarts.

Sending uses target quantities and reads the cart back before reporting success. It preserves unrelated items and refuses an occupied cart whose selected store cannot be safely confirmed. A timeout can leave an update unconfirmed; the app does not automatically retry a write. Review the retailer cart before trying again. Final orders and payment always remain with the retailer.

## Verification boundary

Tests cover pairing, origin and token checks, expiry, endpoint restrictions, timeouts, and verified cart transfers through a simulated browser connection. The hidden app test covers compact light/dark layouts and checkout/setup controls. Close the app before running `node scripts/verify-browser.cjs`, an opt-in real Edge companion check in a separate profile with read-only store requests only. It does not use the user's normal browser profile. The harness disables sync and uses HTTP/1.1 after an observed headless HTTP/2 error. The real test confirmed pairing and command/result delivery, but live retailer navigation encountered loading failures; it did not verify signed-in cart writes.

Signed-in cart transfer still needs validation with the account holder after companion setup. Retailer verification challenges, API changes, browser extension policy or login changes can affect it. A connected companion means the app can communicate with the browser; it does not mean either retailer is signed in.

## Primary references

- [Chrome application-bound cookie encryption](https://security.googleblog.com/2024/07/improving-security-of-chrome-cookies-on.html) explains why direct access to another browser's cookie database is not the integration mechanism.
- [Chrome scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting) documents running the fixed cart function in the retailer tab's main world.
- [Extension network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests) documents the companion's host permissions and local connection.
