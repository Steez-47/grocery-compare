# Grocery Compare

A small Windows app for New World and Woolworths New Zealand. Choose a store for each, search both catalogues, and build one shopping basket.

## Use

Install `Grocery-Compare-Setup-0.2.0.exe` from this private repository's Releases page. Windows may ask you to confirm running the unsigned installer.

1. Choose your New World and Woolworths pickup locations.
2. Search or choose a department and aisle. Products matched across the stores appear first, with both prices on one card. Filter loaded products by brand, house brands, specials or availability.
3. Add items and choose New World, Woolworths, or a split shop. A specific store selected for a line takes priority within the split shop; choose **Cheapest** on that line to compare automatically.
4. Pams/Value and Woolworths/Essentials products automatically pair when their type, size and distinguishing attributes agree. These are labelled **House-brand equivalent**, with both product names visible. Use **Compare** for other equivalents, or **Similar items** to browse alternatives in other sizes and brands.
5. Continue to stores, sign in on each retailer's page, return to the basket and send items. Complete checkout with the retailer.

Store logins and the shopping list stay on your computer. There is no app account, analytics service, paid API or shared server.

## Current limits

This is an experimental personal app using undocumented website interfaces, not an official retailer integration. Live store selection, search, price normalization and product matching have been tested. **Authenticated basket transfers have not been verified end to end.** Woolworths rejects guest-cart writes; New World may present a verification challenge. A successful transfer is reported only after the retailer's cart quantities are read back.

- Prices use the selected pickup locations. Woolworths can map a pickup location to a different fulfilment store. Delivery prices, slots and fees are finalized by the retailer.
- Membership settings affect displayed prices. Some non-member prices are unavailable; these stay unavailable instead of becoming zero.
- Totals are estimates before delivery, bags, multibuy combinations and final weighed quantities. Check the retailer's total before paying.
- Matching normalizes brand, units, pack counts and specific naming differences. It preserves variant distinctions and leaves ambiguous or size-less listings separate. House-brand equivalents are substitutes, not claims of identical ingredients. Search results are paginated; filters apply to loaded results. Use **Show more** to retrieve more products.
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

React and Electron provide one small interface plus isolated retailer browser sessions. The renderer has no Node access. Store pages have no preload bridge; checkout and catalogue sessions are separate. Password entry belongs to the retailer's page. New World authorization headers from that checkout session are held in memory, never written into app logs or source.

See [the integration research](research/README.md) for endpoints, evidence and verification boundaries. Retailer names and product images belong to their owners; this app is unaffiliated.

See [available metadata](METADATA.md) for category, pricing, dietary and product-detail fields.
