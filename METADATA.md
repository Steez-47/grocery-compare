# Available product metadata

Verified with live retailer responses on 5 September 2026. Fields can be absent for individual products.

| Metadata | New World | Woolworths NZ |
| --- | --- | --- |
| Names, brands, pack sizes, product photos | Search results; sizes usually explicit | Search results; some size-less names |
| Store price, unit price, membership and promotions | Prices in cents, comparison unit and promotion metadata | Decimal prices, comparison unit, specials, membership and some previous prices |
| Category hierarchy | Store-specific full tree and product category paths | Full department tree, category keys and product category paths |
| Availability and purchase units | Availability flags, item/weight sale type | Variant availability, minimum/maximum/increment quantities |
| Dietary flags | Search facets, e.g. Non-GMO and Halal | No uniform dietary flags verified in the search response used here |
| Health-star rating | Not returned by the inspected search/decorate endpoints | Search field `healthStarRating` |
| Ingredients, nutrition, allergens, origin, barcode | Not returned by the inspected search/decorate endpoints | Product-detail fields; actual butter response included ingredients, barcode and per-100g/per-serve nutrition. Origin and allergen fields were null for that example |

Pams also has a public manufacturer catalogue. The [Pams Pure Butter page](https://www.pams.co.nz/product-finder/5023660) publishes ingredients, allergens, origin, nutrition and barcode. It confirms that this specific 500g Pure Butter contains salt, supporting its comparison with Woolworths salted butter. This source is not yet a bulk ingredient feed in the app.

## Used in version 0.2.0

- Eight department groups, with shared aisles resolved against each retailer's live category tree. Category requests use actual category filters, not keyword shortcuts. Unsupported aisle mappings are omitted.
- House-brand equivalents require equal size and product form plus matching distinguishing words. Organic, free-range, salted/unsalted and other explicit variant differences remain separate. Value-tier matches are preferred when multiple plausible listings exist.
- Brand, house-brand, specials and in-stock filters apply to currently loaded products. More pages can be loaded with Show more.
- Similar items are ranked using product-type/name overlap, category overlap and pack size. Suggestions can be other brands or pack sizes. They are suggestions to review, not automatic basket substitutions or guarantees of identical ingredients.
- Products retain category paths, New World dietary tags, special status and Woolworths health-star data. The interface does not yet offer dietary or nutrition filters because coverage is uneven.

## Boundaries

There is no universal cross-retailer identifier in the two search responses. Manufacturer barcodes can help when available, but house-brand equivalents naturally have different barcodes. No purchase history is imported. Suggestions use catalogue metadata, not a personalized recommendation feed. Retailer labels and final packaging remain the source for ingredient decisions.
