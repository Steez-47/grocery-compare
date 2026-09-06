# 0.5.1 refinement: compact grid and a new palette

The user rejected the full-width rows, forest-green styling, insufficient item padding and explanatory filler. This revision follows that feedback: balanced two-column shelves, responsive search grids, 18px item padding, warm grey and white surfaces, coral actions, blue selection states and small category accents. Dark mode uses charcoal and peach. Cheapest-store selection and editable quantities remain intact.

## Research applied to the design process

- [Astra model guidance](https://developers.openai.com/api/docs/guides/latest-model) was consulted for the named model. It establishes general model guidance, rather than a special visual-design setting.
- [OpenAI frontend instructions](https://developers.openai.com/api/docs/guides/frontend-prompt) are labelled for GPT-5.5, with patterns applicable to other versions. Applied here: prioritise actual shopping, remove feature-explanation text, use familiar numeric controls, and organise repeated actions for efficient scanning.
- [OpenAI frontend design techniques](https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4) recommend explicit constraints, visual references and consistent tokens. Applied as a measured layout specification and screenshot review of the working app, rather than relying on a vague instruction to make it attractive.

Acceptance checks: multiple products share the same horizontal row; padding is at least 18px; no Start with, Browse the essentials, hero pitch or sidebar pitch; quantity fields remain legible; Add still selects the cheaper eligible store. Verified through the native app with live products, browser interactions, and native checks for dark mode and compact windows. An early screenshot caught a three-plus-one shelf layout and a cramped weight field; both were corrected before packaging.

The notes below document the previous 0.5.0 design and are historical.

# Grocery shopping UI research · 6 September 2026

The redesign focuses on building a mixed-store shopping list with fewer decisions.

| Reference | Evidence | Applied here |
| --- | --- | --- |
| [Woolworths NZ app guide](https://www.woolworths.co.nz/services/woolworths-nz-app) | Offers a list-view alternative to the grid, shopping lists, and weight/quantity selection. The live home page also exposes search, browse navigation, cart total, and each/weight controls. | A continuous product list, a clear search field, editable quantities before Add and in the basket. |
| [New World shopping guide](https://www.newworld.co.nz/shop/frequently-asked-questions) | Lists support repeat shopping. Variable-weight products are charged for the exact supplied weight. | A persistent shopping list, store context, and explicit estimates for per-kilogram items. |
| [PAK'nSAVE storefront](https://www.paknsave.co.nz/) | Selected store, search, basket count/total and familiar grocery departments are exposed prominently. | Store selectors in the header, a department sidebar and a running basket total. |
| [Tesco online shopping guide](https://www.tesco.com/shop/en-GB/zone/how-to-do-online-shopping) | Explains category browsing as supermarket aisles, direct search and review of the basket before checkout. | Stable aisle navigation and one clear review action. |

Woolworths was inspected in the live browser, including its rendered layout and accessible controls. New World's browser page presented security verification; its official guide and the other official sources were read through web retrieval. No authentication or orders were involved in this research. These observations support interaction patterns, not a claim that every retailer has this exact layout.

## Design decisions

- One row represents a matched product. One Add button uses the cheapest eligible offer for the requested amount. A disclosure reveals both prices and match corrections.
- The price includes the selected amount; weight prices retain a per-kilogram reference. Member status and selected stores continue to govern pricing.
- Adding again updates the same line and uses automatic pricing. Store preferences remain available in the basket; “Use cheapest for every item” clears manual choices. The comparison plan shows the total that selecting that plan will actually produce.
- Quantity fields support direct typing and +/- buttons. Weight fields support kilograms and grams, retaining the catalogue's minimum, step and maximum. Each-priced products stay whole units; arbitrary conversions from a pack to loose weight are not invented.
- Invalid drafts explain allowed increments and block Add or review. Persisted invalid quantities remain visibly unavailable until corrected.
- The home feed retains recommendation learning and lazy loading, with three initial shelves and up to four rows each. Similar-item results use the same row interface.
- Product rows are continuous, with fine separators instead of separate rounded cards. The basket has its own scroll region and keeps totals and review accessible. Narrow windows stack the row's quantity controls.

## Verification

- TypeScript check and production build.
- 99 model/integration unit tests, including automatic selection, membership, stock, quantity limits, repeated additions and weighted totals.
- 12 isolated native Electron renderer scenarios: rounding, invalid quantities, store changes, membership, zero prices, persistence, collapsed basket, dark mode and minimum window size.
- Browser interaction checks: typed 0.5 kg, 800 g conversion, rejected off-increment 850 g, manual New World override and reset to cheapest, search navigation.
- Live native check: Broadway and Kelvin Grove catalogues, 19 matched milk rows in this run, a two-unit automatic basket and correct displayed total, actual images and no horizontal overflow. These counts and prices are transient test observations.

Research into PAK'nSAVE and Tesco informs the UI only; shopping integrations remain New World and Woolworths. No authenticated cart transfer or payment was tested.
