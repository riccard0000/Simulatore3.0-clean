const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

// Load data.js into a sandboxed vm so we can call the intervention explain
const code = fs.readFileSync('data.js', 'utf8');
const sandbox = { console, window: {}, document: {}, navigator: {}, global: {}, process };
vm.createContext(sandbox);
vm.runInContext(code + '\nresult = typeof calculatorData !== "undefined" ? calculatorData : null;', sandbox);
const calculatorData = sandbox.result;
if (!calculatorData) { console.error('calculatorData not found'); process.exit(2); }

function getKpFromExplain(explainObj) {
    if (!explainObj || !Array.isArray(explainObj.steps)) return null;
    const kpLine = explainObj.steps.find(s => typeof s === 'string' && s.includes('kp = ηs')) || null;
    if (!kpLine) return null;
    // Normalize decimal separator (some locales use comma) and parse last numeric token
    const normalized = String(kpLine).replace(/,/g, '.');
    const m = normalized.match(/=\s*([0-9]+\.?[0-9]*)\s*$/);
    if (m && m[1]) return Number(m[1]);
    // fallback: extract last numeric token
    const nums = (normalized.match(/([0-9]+\.?[0-9]*)/g) || []).map(Number);
    return nums.length ? nums[nums.length-1] : null;
}

console.log('Running KP GAS pump tests...');

const pompa = calculatorData.interventions && calculatorData.interventions['pompa-calore-elettrica'];
if (!pompa) { console.error('pompa-calore-elettrica intervention not found'); process.exit(2); }

// Case 1: GAS split/multisplit, use eff_stagionale / eta_s_min (fallback to electric minima if GAS not provided)
const params1 = {
    zona_climatica: 'A',
    righe_pompe: [
        { tipo_pompa: 'aria/aria split/multisplit', potenza_nominale: 10, scop: 4.0, cop: null, eff_stagionale: 160, gwp: '>150', alimentazione: 'GAS' }
    ]
};
const expl1 = pompa.explain(params1, 'private_tertiary_small', { selectedInterventions: ['pompa-calore-elettrica'] });
console.log('Explain steps (GAS case1):');
console.log(expl1.steps.join('\n'));
const kp1 = getKpFromExplain(expl1);
assert(kp1 !== null, 'Could not parse kp from explain steps (GAS case1)');
// Expected eta_s_min for 'aria/aria split/multisplit' for GAS (from data.js PUMP_GAS_EFFICIENCY_MIN)
const expected1 = 160 / 130;
assert(Number(kp1.toFixed(3)) === Number(expected1.toFixed(3)), `KP mismatch for GAS split: got ${kp1}, expected ${expected1}`);

console.log('KP GAS pump tests passed.');
