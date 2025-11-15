// Utility helpers for pump UI logic. Kept tiny and testable.
function detectPumpFlags(tipoRaw) {
    const s = String(tipoRaw || '').toLowerCase();
    return {
        needsCop: s.includes('fixed') && s.includes('double'),
        needsGwp: s.includes('split') || s.includes('multisplit') || (s.includes('salamoia') && s.includes('aria')) || (s.includes('fixed') && s.includes('double'))
    };
}

// Export for Node tests and attach to window in browser
if (typeof module !== 'undefined' && module.exports) module.exports = { detectPumpFlags };
if (typeof window !== 'undefined') {
    window.pumpUtils = window.pumpUtils || {};
    window.pumpUtils.detectPumpFlags = detectPumpFlags;
}
