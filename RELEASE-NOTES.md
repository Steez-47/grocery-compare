Grocery Compare 0.4.0: compact design, dark mode and browser checkout.

- Smaller header, cards, gaps and basket controls, with consistent colours across the interface.
- Light and dark modes from the moon/sun button; the choice is saved independently of recommendation history.
- Open retailer carts in the Windows default browser and sign in there normally.
- Included Edge/Chrome browser companion for sending cart requests through the existing browser session. Cookies stay in the browser.
- One-time setup from Stores → Browser connection or from checkout: load the included companion folder in the browser's Extensions page, then connect.
- Paired local connection with restricted cart operations, expired-request handling, and a New World guest-login guard.

Your existing basket, stores and recommendation history are preserved. Existing embedded-browser logins remain separate from the main browser.

Validated with 53 automated tests and hidden native app checks for compact layout, both themes, browsing, basket persistence and checkout/setup controls. An isolated real Edge test confirmed companion pairing and command/result delivery. Live retailer pages encountered HTTP/2/loading errors in that hidden test, so signed-in cart transfer still needs verification after setup with the account holder.

The companion requires one manual installation in Edge or Chrome. No cookie database extraction or heavy AI model is used. Final payment remains at the retailer. The installer is unsigned.
