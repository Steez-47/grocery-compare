# Grocery Compare

A small Windows app for New World and Woolworths New Zealand. Choose a store for each, search both catalogues, and build one shopping basket.

## Use

Download `Grocery-Compare-Setup-0.5.2.exe` from the [latest release](https://github.com/Steez-47/grocery-compare/releases/latest). Downloads are public; no GitHub account is needed. Windows may ask you to confirm running the unsigned installer.

**Updating:** close Grocery Compare and run the newer installer using the same Windows account. It updates the existing installation in place; you do not need to uninstall first. Your basket, stores and preferences stay on that computer. Updates are installed manually by downloading the newer installer.

1. Choose your New World and Woolworths pickup locations.
2. Use the department sidebar, search, or browse suggested shelves. Matching products appear in a compact grid with the cheapest eligible store already selected. Expand the price comparison to see both offers. Filter loaded products by brand, house brands, specials or availability.
3. Type a quantity or weight (kg or g), then **Add**. Repeated additions update the same list item. Quantities are editable in the basket too. **Automatic · cheapest store** picks the lowest eligible offer; New World only, Woolworths only and individual **Store options** remain available. **Use cheapest for every item** resets manual store choices. Collapse the sidebar and reopen it with **Basket** in the top bar.
4. Pams/Value and Woolworths/Essentials products automatically pair when their type, size and distinguishing attributes agree. These are labelled **House-brand equivalent**, with both product names visible. Use **Find match** for other equivalents, or **Similar items** to browse alternatives in other sizes and brands.
5. Use the moon/sun button for dark or light mode. Continue to checkout to open each store in your usual browser. Install the included Edge/Chrome companion once to send items through that browser session. See [browser setup](BROWSER-CHECKOUT.md). Complete payment with the retailer.

Retailer logins stay in your main browser. The shopping list and recommendation history stay on your computer. Browsing learns from your searches, aisle visits, similar-item views, adds and hidden shelves. Turn off **Personalise browsing** or use **Clear history** in Stores. Explicit match corrections survive a history reset. There is no app account, analytics service, paid API or shared server.

## Current limits

This is an experimental personal app using undocumented website interfaces, not an official retailer integration. Live store selection, search, price normalization and product matching have been tested. **Authenticated basket transfers have not been verified end to end.** Woolworths rejects guest-cart writes; New World may present a verification challenge. A successful transfer is reported only after the retailer's cart quantities are read back.

- Prices use the selected pickup locations. Woolworths can map a pickup location to a different fulfilment store. Delivery prices, slots and fees are finalized by the retailer.
- **Club+ Deals** and **Member Price** in Stores switch the eligible prices used throughout the app. Public member offers are retrieved without signing in. Woolworths' alternate price feed must confirm the selected location and match the current ordinary price. Failed member lookups keep the ordinary price and an unavailable label; unknown non-member prices stay unavailable. Refresh older saved basket prices after updating. See [member-price research](research/README.md).
- Totals are estimates before delivery, bags, multibuy combinations and final weighed quantities. Check the retailer's total before paying.
- Matching combines naming normalization with weighted word and character vectors, guarded by brand, size and distinguishing attributes. Ambiguous matches stay separate. Some size-less listings can pair when their displayed unit price supports a narrowly bounded size estimate and the other listing explicitly states that size. Incorrect matches can be separated under **These aren’t the same** in the expanded comparison; the app remembers this. House-brand equivalents are substitutes, not claims of identical ingredients. Search results are paginated; filters apply to loaded results. Use **Show more** to retrieve more products.
- Sending sets target quantities for the selected products. Existing unrelated products are not intentionally deleted. Changing the location of an occupied cart is refused where it cannot be safely verified. New World may therefore require completing or clearing an existing cart yourself first.
- Store verification and sign-in are completed manually. A retailer can change or block its interface; direct shopping and an exported text list are fallbacks.
- Age-restricted items must be added on the retailer's website.

## Development

Node.js 24+, Windows x64:

```powershell
npm ci
node node_modules/electron/install.js
npm run build
npm start
```

```powershell
npm run check
npm test
npm run package
```

The installer is written to `release/`. Electron's runtime and NSIS tools need network access on the first build. `--verify` runs an isolated hidden-window integration check against live catalogues without signing in or transferring items. Its report is saved under the verification profile; this mode does not touch your normal basket.

## Design and research

React and Electron provide the app interface; the renderer has no Node access. Anonymous catalogue sessions remain separate from checkout in the default browser. A narrowly scoped Edge/Chrome companion runs cart requests inside the retailer tab. Cookies and New World authorization remain in the browser. Password entry and payment belong to the retailer. Existing embedded-browser data is preserved during upgrade but is not imported into the main browser.

See [the UI research and redesign](research/UI-REDESIGN.md) for sources, design decisions and verification.

See [the integration research](research/README.md) for endpoints, evidence and verification boundaries. Retailer names and product images belong to their owners; this app is unaffiliated.

See [matching and recommendation design](RECOMMENDATIONS.md) for scoring, local history and limits.

See [available metadata](METADATA.md) for category, pricing, dietary and product-detail fields.

Loose per-kilogram produce now compares across stores independently of generic store brands. Fixed bags and individually priced variants remain separate. Basket controls use retailer weight minimums and increments; when paired items share a valid weight grid, both offers use it. An old misclassified produce line is marked for Refresh without changing its saved quantity.
