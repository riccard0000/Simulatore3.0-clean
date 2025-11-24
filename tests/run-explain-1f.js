const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('data.js', 'utf8');
const sandbox = { console, window: {}, document: {}, navigator: {}, global: {} };
vm.createContext(sandbox);
vm.runInContext(code + '\nresult = typeof calculatorData !== "undefined" ? calculatorData : null;', sandbox);
const calculatorData = sandbox.result;
if (!calculatorData) { console.error('calculatorData not found in data.js'); process.exit(2); }

function runExplain(id, params, ctx) {
    const intervention = calculatorData.interventions[id];
    if (!intervention || typeof intervention.explain !== 'function') {
        console.error('Intervention or explain() not found for', id);
        return;
    }
    const exp = intervention.explain(params, 'private_tertiary_person', ctx || { selectedInterventions: [id] });
    console.log('\n--- Explain for', id, '---');
    console.log('result:', exp.result);
    console.log('variables:', JSON.stringify(exp.variables, null, 2));
    console.log('steps:');
    exp.steps.forEach((s, i) => console.log((i+1)+'.', s));
}

// Test 1.F - building-automation
runExplain('building-automation', { superficie: 100, costo_totale: 8000, costo_specifico: 80, premiums: {} }, { selectedInterventions: ['building-automation'] });

// Test 1.E - illuminazione-led
runExplain('illuminazione-led', { righe_illuminazione: [ { tipo_lampada: 'LED', superficie: 50, costo_totale: 3500 } ] }, { selectedInterventions: ['illuminazione-led'] });

process.exit(0);
