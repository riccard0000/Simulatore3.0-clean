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
    const kpLine = explainObj.steps.find(s => typeof s === 'string' && s.includes('kp = COP')) ||
                   explainObj.steps.find(s => typeof s === 'string' && s.includes('kp = ηs')) || null;
    if (!kpLine) return null;
    // Normalize decimal separator (some locales use comma) and parse last numeric token
    const normalized = String(kpLine).replace(/,/g, '.');
    const m = normalized.match(/=\s*([0-9]+\.?[0-9]*)\s*$/);
    if (m && m[1]) return Number(m[1]);
    // fallback: extract last numeric token
    const nums = (normalized.match(/([0-9]+\.?[0-9]*)/g) || []).map(Number);
    return nums.length ? nums[nums.length-1] : null;
}

console.log('Running KP fixed-double-duct tests...');

const pompa = calculatorData.interventions && calculatorData.interventions['pompa-calore-elettrica'];
if (!pompa) { console.error('pompa-calore-elettrica intervention not found'); process.exit(2); }

// Case 1: GWP >150 -> COP_min expected 2.60
const params1 = {
    zona_climatica: 'A',
    righe_pompe: [
        { tipo_pompa: 'aria/aria fixed double duct', potenza_nominale: 10, cop: 2.8, scop: null, eff_stagionale: null, gwp: '>150' }
    ]
};
const expl1 = pompa.explain(params1, 'private_tertiary_small', { selectedInterventions: ['pompa-calore-elettrica'] });
console.log('Explain steps (case1):');
console.log(expl1.steps.join('\n'));
const kp1 = getKpFromExplain(expl1);
assert(kp1 !== null, 'Could not parse kp from explain steps (case1)');
const expected1 = 2.8 / 2.60;
// explain output is rounded to 3 decimals, compare on same precision
assert(Number(kp1.toFixed(3)) === Number(expected1.toFixed(3)), `KP mismatch for GWP >150: got ${kp1}, expected ${expected1}`);

// Case 2: GWP <=150 -> COP_min expected 2.34
const params2 = {
    zona_climatica: 'A',
    righe_pompe: [
        { tipo_pompa: 'aria/aria fixed double duct', potenza_nominale: 10, cop: 2.8, scop: null, eff_stagionale: null, gwp: '<=150' }
    ]
};
const expl2 = pompa.explain(params2, 'private_tertiary_small', { selectedInterventions: ['pompa-calore-elettrica'] });
console.log('Explain steps (case2):');
console.log(expl2.steps.join('\n'));
const kp2 = getKpFromExplain(expl2);
assert(kp2 !== null, 'Could not parse kp from explain steps (case2)');
const expected2 = 2.8 / 2.34;
assert(Number(kp2.toFixed(3)) === Number(expected2.toFixed(3)), `KP mismatch for GWP <=150: got ${kp2}, expected ${expected2}`);

console.log('KP fixed-double-duct tests passed.');
