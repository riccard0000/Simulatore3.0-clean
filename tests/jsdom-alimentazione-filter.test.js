const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const { JSDOM } = require('jsdom');

// Create a JSDOM window/document for DOM APIs
const dom = new JSDOM(`<!doctype html><html><body></body></html>`);
const { window } = dom;
const { document } = window;

// Load data.js into a VM sandbox that has access to the jsdom document
const code = fs.readFileSync('data.js', 'utf8');
const sandbox = {
    console,
    window,
    document,
    navigator: window.navigator,
    global: {},
    process
};
vm.createContext(sandbox);
vm.runInContext(code + '\nresult = typeof calculatorData !== "undefined" ? calculatorData : null;', sandbox);
const calculatorData = sandbox.result;
if (!calculatorData) {
    console.error('calculatorData not found in data.js sandbox');
    process.exit(2);
}

console.log('Running jsdom alimentazione -> tipo_pompa filter test...');

// Locate the tipo_pompa options from the intervention definition in calculatorData
const pompa = calculatorData.interventions && calculatorData.interventions['pompa-calore'];
if (!pompa) { console.error('pompa-calore not found in calculatorData'); process.exit(2); }

const tableInput = pompa.inputs.find(i => i.id === 'righe_pompe');
if (!tableInput) { console.error('righe_pompe input descriptor not found'); process.exit(2); }

const tipoCol = tableInput.columns.find(c => c.id === 'tipo_pompa');
if (!tipoCol) { console.error('tipo_pompa column not found'); process.exit(2); }
const allTipoOptions = Array.isArray(tipoCol.options) ? tipoCol.options : [];

// Build a fake table row and select elements like the app would
const tr = document.createElement('tr');
const tipoSel = document.createElement('select');
// populate tipoSel options as in the UI
allTipoOptions.forEach(opt => {
    const o = document.createElement('option');
    o.value = (typeof opt === 'string') ? opt : (opt.value || opt);
    o.textContent = (typeof opt === 'string') ? opt : (opt.label || opt.value || opt);
    tipoSel.appendChild(o);
});
// store dataset.allOptions as the script does
const all = Array.from(tipoSel.options).map(o => ({ value: o.value, label: o.textContent }));
tipoSel.dataset.allOptions = JSON.stringify(all);
tr.appendChild(tipoSel);

// alimentazione select
const alimSel = document.createElement('select');
['Elettrica', 'GAS'].forEach(a => {
    const o = document.createElement('option'); o.value = a; o.textContent = a; alimSel.appendChild(o);
});
tr.appendChild(alimSel);

// Attach them to document so querySelector works if needed
document.body.appendChild(tr);

// Use the helper from data.js to get allowed types for GAS
const allowedGas = typeof sandbox.getPumpTypesForAlimentazione === 'function' ? sandbox.getPumpTypesForAlimentazione('GAS') : null;
assert(Array.isArray(allowedGas), 'Expected getPumpTypesForAlimentazione to return an array for GAS');

// Simulate the alimentazione change handler behavior from script.js: rebuild tipo options filtered by allowed
const allOpts = JSON.parse(tipoSel.dataset.allOptions || '[]');
const toAdd = allOpts.filter(o => !Array.isArray(allowedGas) || allowedGas.includes(o.value));
// rebuild
while (tipoSel.firstChild) tipoSel.removeChild(tipoSel.firstChild);
toAdd.forEach(o => {
    const op = document.createElement('option'); op.value = o.value; op.textContent = o.label; tipoSel.appendChild(op);
});

// Assert: every option present in tipoSel must be in allowedGas (if allowedGas is array)
Array.from(tipoSel.options).forEach(opt => {
    assert(allowedGas.includes(opt.value), `Option ${opt.value} is present but not allowed for GAS`);
});

// Also assert that at least one option exists (non-empty dropdown)
assert(tipoSel.options.length > 0, 'tipo_pompa select is empty after filtering for GAS');

console.log('jsdom alimentazione filter test passed.');
