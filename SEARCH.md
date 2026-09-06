# Product search

User searches go through `searchCatalogue` in `electron/search.cjs`. The underlying retailer catalogue remains available to internal recommendation and product-refresh logic. Categories keep their existing browse behaviour.

## Retrieval and ranking

1. Parse the query into product words and explicit pack, size and percentage constraints. Normalize accents, punctuation, selected grocery aliases and equivalent metric units. `water 24 pk` becomes `water` AND `pack:24`; `water 24 × 0.5 L` also requires `size:500ml`.
2. Ask the retailer for the product words. This prevents its interpretation of `pk` or a number from replacing the requested product. Size-only searches retain the original query.
3. Build an inverted index from product names, brands and size metadata. Intersect posting sets starting with the smallest set. Every query token must match. Categories, prices, promotions and order limits cannot supply missing product evidence.
4. Rank eligible products using BM25 (k1=1.2, b=0.75) and a contiguous name-phrase bonus. After store comparison, rank all loaded rows again using their offers so grouping and pagination do not override search relevance.

Index construction takes O(T) time and space for T indexed tokens. Intersection costs O(s × q), where s is the shortest posting list and q the number of query tokens. Scoring costs O(m × q), with O(m log m) sorting for m surviving candidates. No catalogue-wide pairwise similarity scan is needed.

## Pagination and limits

Each request scans at most three retailer pages, stopping after at least 12 qualifying products or source exhaustion. `nextPage` is the exact source cursor, not a count of filtered pages. The renderer skips exhausted stores and retries failed stores at their previous cursor. Retailer totals remain source totals; the interface displays the actual number of loaded rows. The existing IPC limit of source page 28 still applies.

Search requires literal normalized evidence. It does not guess misspellings or silently relax dietary, size or product terms. Equivalent units do not imply equivalent package structure: 24 × 500ml is not treated as a single 12L bottle. Missing size metadata can therefore exclude an otherwise relevant product. Results depend on the retailer's candidate retrieval and accessible pages, not a complete local catalogue.

## Verification

- `node --test tests/*.test.cjs`: search regressions, generated-corpus properties, source paging, failures and a 10,000-product benchmark, plus the existing application suite.
- `node node_modules/typescript/bin/tsc --noEmit`
- `node node_modules/vite/bin/vite.js build`
- `node_modules/electron/dist/electron.exe scripts/verify-search-ui.cjs`: the production renderer with isolated fixture sessions; writes a screenshot and verification report under `test-results/search`.

Live check on 6 September 2026: `water 24 pk` returned HBay Natural Artesian Water No Label 24 × 600ml at New World Broadway, and Pure Drop Water 24 Pack plus Woolworths Water Still Spring 24 Pack at Woolworths Kelvin Grove in the first scan. Woolworths had a continuation cursor. These observations are not permanent availability guarantees.
