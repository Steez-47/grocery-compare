# 0.5.2 · Precise search and upgrade-ready installer

- Search requires product words and requested pack counts or sizes together. "water 24 pk" excludes unrelated 24-packs.
- Normalize pack notation, metric units and common grocery wording; rank matching products with an inverted index and BM25.
- Preserve each store's pagination cursor and retry failed stores without losing successful results.
- Include the compact grocery grid and automatic cheapest-store shopping improvements.
- The Windows x64 installer updates existing installations using the same app identity and preserves local shopping data. Run future installers with the same Windows account; no prior uninstall is needed.

Validation: 159 automated tests, TypeScript, production build, native search/pagination/retry checks, and live water searches at both local stores.

# 0.5.1 · Compact grocery grid

Side-by-side products with consistent 18px padding, balanced shelves, and a coral, blue and neutral palette. Removed introductory filler, quick-search suggestions and repeated explanatory copy. Cheapest selection, quantity and weight entry remain available. Verified with live native rendering, browser interaction and compact/dark-mode checks.

# 0.5.0 · A simpler weekly shop

Continuous product rows replace the card grid. Search and a department sidebar lead into one shopping list, with the cheapest eligible store selected by default. Type quantities or weights in kg/g before adding or in the basket. Expand a comparison for both offers; reset manual choices with Use cheapest for every item. Repeated adds preserve a single line, invalid quantities block review, and dark mode and compact windows are supported.

Verified with unit tests, native renderer checks and live catalogue data. See research/UI-REDESIGN.md.

Grocery Compare 0.4.2: real member prices from both stores.

- Read New World's actual Club+ Deal reward price and matching unit price.
- Read Woolworths Member Price from its public product feed, verifying the selected pickup and fulfilment store on every response.
- Keep current non-member prices separate from historical was prices. Membership switches update comparison prices and basket totals.
- Exclude expired, targeted and multibuy offers from single-item estimates. Preserve each/per-kilo pricing and require old saved prices to refresh.
- Cache exact product lookups and keep ordinary catalogue prices usable if a member-price lookup is unavailable.
- Include the completed cart improvements: accurate line rounding, clearer store choices and a collapsible basket.

Validation: 92 automated tests, live catalogue checks at New World Broadway and Woolworths Kelvin Grove, and hidden native checks for browsing, produce, member-price switches and persistence.

Research and API details are in research/README.md. The retailer's final checkout remains authoritative; the browser companion is unchanged.

Upgrade verification: installing 0.5.2 over 0.5.1 retained the same installation path and Windows app entry. Shopping, recommendations, browser connection, Preferences and Local State files retained identical SHA-256 hashes.
