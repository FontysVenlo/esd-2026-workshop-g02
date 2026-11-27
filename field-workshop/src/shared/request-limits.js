export const MAX_DEPENDENCY_TIMEOUT_MS = 5000;
export const QUEUE_TIMEOUT_MS = 1000;
// Inventory runs alongside Shipping. Shipping may try primary and backup in sequence.
export const CUSTOMER_REQUEST_TIMEOUT_MS = QUEUE_TIMEOUT_MS + 2 * MAX_DEPENDENCY_TIMEOUT_MS + 1000;
// Drain customer work, then allow three sequential control requests and a margin.
export const WORKSHOP_RESET_TIMEOUT_MS = CUSTOMER_REQUEST_TIMEOUT_MS + 3 * 3000 + 4000;
