First experimental Windows release.

- Choose a New World store and Woolworths NZ pickup location.
- Search both stores, see matching products together, and build a saved basket.
- Compare store totals or split the basket; choose equivalents manually where needed.
- Open retailer checkout pages inside the app and attempt to send selected quantities.
- Export a plain text shopping list.

Matching handles retailer-specific wording, pack counts and units, with checks against mismatched variants. Live butter results improved from 3 to 13 paired products in the inspected test set.

Validated with unit tests and a hidden native Electron test covering live searches, paired cards, basket editing, persistence and the checkout dialog.

Authenticated cart transfer is experimental and has not been verified end to end. Each store requires its own login and may require manual verification. Final checkout and totals remain with the retailer. The installer is unsigned.
