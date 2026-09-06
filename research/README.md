# Integration findings · 5 September 2026

## Feasibility

Both websites expose interfaces that their own storefronts use. The absence of a supported public developer API does not prevent a prototype. It does make ongoing compatibility and reliable checkout the expensive parts. I found no documented, supported public API covering consumer store selection, both catalogues and both carts.

The implemented adapters were tested against live anonymous sessions for New World Broadway, Palmerston North, and Woolworths Kelvin Grove. Catalogue traffic is read-only except for selecting a location in the app's isolated guest session. No account credentials or orders were used in testing.

## New World

- A guest session is obtained with `POST https://www.newworld.co.nz/api/user/get-current-user`.
- Its bearer token works with `https://api-prod.newworld.co.nz/v1/edge`.
- `GET /store` returned 149 online-active New World locations in the inspected dataset.
- `POST /search/paginated/products` accepts a store ID, query, page and region-specific sort order. It returns prices in cents, availability and promotion metadata.
- Store-selected product searches and the public product-image host worked in both Node and native Electron.
- Cart operations observed in reference implementations are `GET /cart`, `POST /cart/store/{id}` and `POST /cart`. Unit quantities are item counts; weight quantities are grams.
- Our guest cart could be read. The guest transfer attempt encountered a verification response. Authenticated transfer remains unverified. The app reports failure when verification is required or target quantities cannot be read back.

Reference code: [thecolab-ai New World skill](https://github.com/thecolab-ai/.skills/tree/main/skills/newworld-nz). The application's adapter is an independent implementation tested against the current responses.

## Woolworths NZ

The current storefront uses Next.js and a GraphQL gateway at `https://www.woolworths.co.nz/api/graphql?op-name=…`. Older examples using `/api/v1/products` do not reflect the current cart and store-selection model.

Operations and fields were inspected in JavaScript published by [Woolworths NZ](https://www.woolworths.co.nz/) and verified with live requests:

- `SearchLocations` accepts town/suburb text. An empty all-stores query returned HTTP 502 during testing; the app waits for at least two characters.
- `SetCartShoppingMode` selects a pickup location in a cookie-backed session.
- `ProductSearch` uses `My.products` with `CompositeSearchInput`. Product variants have their own keys, purchase increments and prices. Prices are decimal dollars, unlike New World's cents.
- Kelvin Grove pickup location `9424` resulted in fulfilment-store key `9470`. The app preserves both identifiers and uses the retailer's own selection operation.
- `CustomerCart` reads shopping mode and line items. `SetCartLineItemQuantity` uses target quantities, rather than additive quantities.
- The gateway explicitly rejected `SetCartLineItemQuantity` for `GuestCart`. The app requires the user to sign in through its isolated checkout browser. Authenticated transfers remain unverified.
- Some coffee listings omit pack size from both the search name and product details (`volumeSize: null`). Version 0.3.0 can match some of these when price divided by comparison-unit price gives a narrowly bounded size estimate and the other store explicitly supplies that size. Two inferred sizes and member-price listings are excluded; an estimate is not manufacturer-confirmed metadata.

Historical reference: [Woolworths NZ API notes](https://github.com/thecolab-ai/.skills/blob/main/skills/woolworths-nz/references/api-notes.md). These are useful background, not the authority for the current GraphQL implementation.

## Matching and checks

Exact word equality missed obvious same-product pairs: `Supersoft` / `Super Soft`, `12pk` / `12 Pack`, `Zero Lacto Blue` / `Lactose Free Milk Blue`, and `Grass Fed New Zealand Butter` / `Butter`. The revised matcher uses category-specific normalization, equal sizes, and mutual unambiguous matches. It preserves salted/unsalted, reduced salt, bread slice styles, milk types, egg grade/housing and coffee preparation distinctions. Version 0.2.0 also allows house-brand equivalents with matching attributes, identified separately from same-brand matches. See [metadata and browsing findings](../METADATA.md).

On the inspected first-page results, butter pairs increased from 3 to 13. The revised matcher paired 9 milk, 17 bread and 10 egg products. These counts are observations from this particular store/date/result page, not coverage guarantees.

Unit tests exercise positive matches and similar-looking products that must remain separate, missing prices, membership, purchase increments, cart target quantities, verification failures and occupied-cart location protection. Hidden native integration tests exercise the real Electron renderer and IPC with live products, a disposable basket and persistence. Signed-in checkout still needs testing by an account holder.

## Version 0.3.0 matching and recommendations

A second matching stage uses normalized sparse word and character vectors, cosine similarity, synonym normalization, distinguishing-attribute guards and mutual best matches with an ambiguity margin. This is a local JavaScript implementation, not a neural embedding model. Word/character feature extraction and normalized-vector similarity are established lightweight techniques; see the primary [scikit-learn feature-extraction documentation](https://scikit-learn.org/stable/modules/feature_extraction.html).

The browsing feed now ranks themed shelves and products using local activity, fading preferences, unit-value and special-price signals, and diversity penalties. Requests are lazy and limited to two shelf jobs at once. See [design and limitations](../RECOMMENDATIONS.md).

## Operational choices

There is no scraping proxy subscription, shared database or external comparison service. PricePulse is not used. Private GitHub storage does not make an undocumented interface supported; retailer changes can still require adapter updates.

Electron's [WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view), [sessions](https://www.electronjs.org/docs/latest/api/session) and [security guidance](https://www.electronjs.org/docs/latest/tutorial/security) informed the isolation between the app, anonymous catalogues and retailer checkout pages.

## Version 0.4.0 browser handoff

The app now opens checkout in the Windows default browser. An included Edge/Chrome companion keeps retailer authentication in that browser and runs fixed cart operations through a paired loopback connection. A real, isolated Edge test confirmed pairing and command/result delivery. Live retailer navigation in the hidden guest profile hit HTTP/2/loading errors, so signed-in browser cart transfer remains unverified. New World anonymous JWT roles were inspected without retaining credentials; `ANONYMOUS` sessions are refused by the companion. See [browser checkout](../BROWSER-CHECKOUT.md).

## Version 0.4.1 produce

On 6 September, live New World bananas and lemons used `saleType: BOTH` with a `-KGM-` product ID and a per-kilo price. The adapter previously recognized only `WEIGHT`, incorrectly treating these as each. `variableWeight.minOrderQuantity` and `stepSize` supply gram-based limits. Woolworths supplies separate `-KG` and `-EA` variants; names such as Min Order 250g are order metadata, not a fixed pack size. Normalized decimal limits and a dedicated fresh-produce comparison now pair loose commodities by type and variety. Unit tests guard against mixing each prices, bags, organic variants, cooking bananas and prepared foods.
