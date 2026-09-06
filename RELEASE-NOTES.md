Grocery Compare 0.4.2: real member prices from both stores.

- Read New World's actual Club+ Deal reward price and matching unit price.
- Read Woolworths Member Price from its public product feed, verifying the selected pickup and fulfilment store on every response.
- Keep current non-member prices separate from historical was prices. Membership switches update comparison prices and basket totals.
- Exclude expired, targeted and multibuy offers from single-item estimates. Preserve each/per-kilo pricing and require old saved prices to refresh.
- Cache exact product lookups and keep ordinary catalogue prices usable if a member-price lookup is unavailable.
- Include the completed cart improvements: accurate line rounding, clearer store choices and a collapsible basket.

Validation: 92 automated tests, live catalogue checks at New World Broadway and Woolworths Kelvin Grove, and hidden native checks for browsing, produce, member-price switches and persistence.

Research and API details are in research/README.md. The retailer's final checkout remains authoritative; the browser companion is unchanged.
