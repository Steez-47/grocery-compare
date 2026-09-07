// Compatibility entry point: the companion now requires opt-in retailer access.
// Use the isolated lifecycle/UI smoke test; never attempt unsigned-in cart writes.
require('./verify-companion.cjs');
