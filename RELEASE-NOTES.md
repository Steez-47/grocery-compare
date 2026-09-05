Grocery Compare 0.3.0: smarter matching and recommended shelves.

- Match broader naming variations using lightweight local word and character vectors, guarded by brand, size, variant and ambiguity checks.
- Pair some size-less Woolworths listings when their unit price supports a tightly bounded size estimate and New World explicitly supplies that size.
- Browse themed shelves with four recommendations, quick-add and See more. Shelves load as you scroll.
- Personalise shelf and product ranking from local in-app activity, with fading preferences and variety across brands and departments.
- Rank similar products and manual match candidates using the same name-similarity system.
- Remember match corrections; unlink an incorrect pair directly from its card.
- Turn personalisation off or clear history in Stores. Match corrections survive a history reset.

Your saved shopping profile is preserved. Ingredient-level equality is not implied by a house-brand match.

Validated with 48 unit tests and hidden native Electron checks covering live shelves, lazy loading, quick-add, aisle navigation, house-brand pairs, similar-item additions, match corrections, basket persistence and history controls. No recommendation model download, embedding API or analytics service is required.

Authenticated cart transfer is experimental and has not been verified end to end. Each store requires its own login and may require manual verification. Final checkout and totals remain with the retailer. The installer is unsigned.
