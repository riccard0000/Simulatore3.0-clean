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
    const exp = intervention.explain(params || {}, 'private_tertiary_small', ctx || { selectedInterventions: [id] });
    console.log('\n--- Explain for', id, '---');
    console.log('result:', exp.result);
    console.log('variables:', JSON.stringify(exp.variables, null, 2));
    console.log('steps:');
    (exp.steps || []).forEach((s, i) => console.log((i+1)+'.', s));
}

// Sample inputs
runExplain('infrastrutture-ricarica', { tipo_infrastruttura: 'Standard monofase (7.4-22kW)', numero_punti: 4, costo_totale: 15000 }, { selectedInterventions: ['infrastrutture-ricarica'] });
runExplain('fotovoltaico-accumulo', { potenza_fv: 50, capacita_accumulo: 20, registro_ue: 'No', costo_totale: 60000 }, { selectedInterventions: ['fotovoltaico-accumulo'] });

console.log('\nDone.');
