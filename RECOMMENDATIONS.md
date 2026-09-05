# Matching and browsing in 0.3.0

## Product matching

The app uses local sparse text vectors, not a downloaded neural model or an embedding API. It folds word order, common aliases and small spelling differences, then measures weighted word and character similarity. Existing precise naming rules take priority.

Candidates are blocked by brand (or the house-brand family), purchase unit and normalized pack size. Explicit flavours, dietary claims, numeric strengths, cuts and product forms can veto a fuzzy match. Both products must prefer each other with a margin over the runner-up. Different brands require a house-brand equivalent or an explicit user correction. Equivalent does not mean identical ingredients.

Some Woolworths listings omit size. For non-member-priced items, price divided by unit price can yield an estimated pack size. The estimate accounts for cent rounding, must have an interval narrower than 2%, and must match an explicit size at the other store. Two estimated sizes cannot match automatically. Explicit sizes are never replaced. This remains an inference, and inconsistent retailer unit pricing could produce a wrong match.

The unlink button remembers a rejected pair. Find match ranks candidates by text similarity and remembers a selected pair. Automatic reuse of a confirmation still requires equal explicit pack sizes and purchase units. Ambiguous products remain separate. Name similarity cannot establish ingredient equality or solve missing metadata reliably.

## Recommendations

The home screen shows themed shelves, with four products, direct add buttons and See more. Shelf order balances familiar aisles with department variety. The initial selection is a deliberate spread of common aisles, not random or alphabetical.

Only activity inside this app is recorded locally: searches, opened aisles, similar-item views, adds, shelf dismissals and visible recommendation impressions. Adds count more than views. Preferences lose half their weight every 30 days; recent repeated exposure receives a short-lived penalty. Product ranking combines these preferences, similarity when viewing alternatives, specials, comparable unit-value signals and availability. A diversity pass reduces repeated brands and nearly identical suggestions. Items already represented in the basket are omitted from new home suggestions when every available offer is already there.

Six shelf placeholders appear initially; each shelf fetches when it approaches the viewport, using actual category filters. Two shelf jobs run at once, with retailer catalogue caching. More ideas adds another four shelves. Returning to Browse or refreshing applies the latest preferences.

The profile lives in `%APPDATA%/grocery-compare/recommendations.json`. Maps are capped at 1,500 products, 300 brands, 500 interests, 150 aisles and 2,000 impression records. Confirmed and rejected pair lists each retain up to 500 entries. No retailer account purchase history is imported and no activity is sent to a recommendation server. Retailer requests still necessarily include the search/category and location needed to retrieve products.

Stores contains Personalise browsing and Clear history. Turning personalisation off stops recording and ignores existing taste history. Clearing removes taste and impression history while preserving explicit match corrections. Shopping basket and login data are separate.

## Verification and limits

The automated suite covers unseen name variants, wrong flavours/forms/strengths, ambiguity, size inference, remembered corrections, learning, decay, diversity, exclusions and persistence. An illustrative 1,200-product matching test required 600 cross-store candidate comparisons and took about 35 ms on the development PC. Performance depends on how many products share the same brand and size; this is not a universal latency guarantee.

Hidden native Electron checks use live catalogues and an isolated profile to verify shelves, lazy loading, quick-add, See more, similar items, match corrections, basket persistence and history controls. They do not sign in, send orders or touch the normal profile.

Recommendations are based on the retrieved category/search pages, not an indexed copy of the entire catalogue. Metadata is incomplete and prices/interfaces can change. The algorithm is inexpensive and explainable, but it is not a learned language model or a guarantee that every equivalent product will match.
