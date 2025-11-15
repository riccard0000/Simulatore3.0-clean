const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

// Load data.js into a sandboxed vm so we can access table and helpers
const code = fs.readFileSync('data.js', 'utf8');
const sandbox = { console, window: {}, document: {}, navigator: {}, global: {}, process };
vm.createContext(sandbox);
vm.runInContext(code + '\nresult = { PUMP_REGULATORY_TABLE: (typeof PUMP_REGULATORY_TABLE !== "undefined") ? PUMP_REGULATORY_TABLE : null, getPumpEcodesignSpec: (typeof getPumpEcodesignSpec === "function") ? getPumpEcodesignSpec : null, getPumpEfficiencyMin: (typeof getPumpEfficiencyMin === "function") ? getPumpEfficiencyMin : null, getPumpCi: (typeof getPumpCi === "function") ? getPumpCi : null, lookupRegulatorySpec: (typeof lookupRegulatorySpec === "function") ? lookupRegulatorySpec : null }', sandbox);
const api = sandbox.result;
if (!api || !api.PUMP_REGULATORY_TABLE) { console.error('Could not load PUMP_REGULATORY_TABLE from data.js'); process.exit(2); }

console.log('Running ecodesign minima tests for SCOP / COP and eta_s_min...');

const table = api.PUMP_REGULATORY_TABLE;
let failures = 0;
for (let i = 0; i < table.length; i++) {
    const row = table[i];
    const tipo = row.tipo;
    const gwp = row.gwp || null;
    const alimentazione = row.alimentazione || 'Elettrica';
    // choose a potenza that matches powerConstraint if present
    let potenza = undefined;
    if (row.powerConstraint && typeof row.powerConstraint.value === 'number') {
        const op = row.powerConstraint.op;
        const v = Number(row.powerConstraint.value || 0);
        if (op === '<=') potenza = v; else if (op === '>') potenza = v + 1;
    }

    // get ecodesign spec
    let spec = null;
    try { spec = api.getPumpEcodesignSpec(tipo, gwp, alimentazione); } catch (e) { /* ignore */ }
    // Also test lookupRegulatorySpec directly
    let reg = null;
    try { if (api.lookupRegulatorySpec) reg = api.lookupRegulatorySpec(tipo, gwp, alimentazione, potenza); } catch (e) {}

    // If row defines scop_min or sper_min, spec should expose scop
    if (typeof row.scop_min !== 'undefined' || typeof row.sper_min !== 'undefined') {
        const expectedScop = (typeof row.scop_min !== 'undefined') ? row.scop_min : row.sper_min;
        assert(spec && typeof spec.scop !== 'undefined', `Row ${i} (${tipo} ${alimentazione}) expected scop in spec but none returned`);
        assert(Number(spec.scop) === Number(expectedScop), `Row ${i} (${tipo} ${alimentazione}) scop mismatch: got ${spec.scop}, expected ${expectedScop}`);
    }
    // If row defines cop_min, spec should expose cop
    if (typeof row.cop_min !== 'undefined') {
        const expectedCop = row.cop_min;
        assert(spec && typeof spec.cop !== 'undefined', `Row ${i} (${tipo} ${alimentazione}) expected cop in spec but none returned`);
        assert(Number(spec.cop) === Number(expectedCop), `Row ${i} (${tipo} ${alimentazione}) cop mismatch: got ${spec.cop}, expected ${expectedCop}`);
    }
    // eta_s_min should be visible via getPumpEfficiencyMin
    let effSpec = null;
    try { effSpec = api.getPumpEfficiencyMin(tipo, gwp, alimentazione, potenza); } catch (e) {}
    if (typeof row.eta_s_min !== 'undefined') {
        assert(effSpec && typeof effSpec.eta_s_min !== 'undefined', `Row ${i} (${tipo} ${alimentazione}) expected eta_s_min but none returned`);
        assert(Number(effSpec.eta_s_min) === Number(row.eta_s_min), `Row ${i} (${tipo} ${alimentazione}) eta_s_min mismatch: got ${effSpec.eta_s_min}, expected ${row.eta_s_min}`);
    }
    // getPumpCi should return ci when defined
    if (typeof row.ci !== 'undefined') {
        let ciVal = null;
        try { ciVal = api.getPumpCi(tipo, gwp, alimentazione, potenza); } catch (e) {}
        assert(ciVal !== null && typeof ciVal !== 'undefined', `Row ${i} (${tipo} ${alimentazione}) expected ci but none returned`);
        assert(Number(ciVal) === Number(row.ci), `Row ${i} (${tipo} ${alimentazione}) ci mismatch: got ${ciVal}, expected ${row.ci}`);
    }
}

console.log('Ecodesign minima tests passed for all table rows.');
