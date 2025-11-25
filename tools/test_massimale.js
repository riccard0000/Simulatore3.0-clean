const fs = require('fs');
const vm = require('vm');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const sandbox = { require: require, console: console, process: process, globalThis: {} };
vm.createContext(sandbox);
// Run the data.js code inside the sandbox and expose calculatorData to sandbox.globalThis
vm.runInContext(code + '\nif (typeof calculatorData !== "undefined") globalThis.calculatorData = calculatorData;', sandbox, { filename: 'data.js' });

const params = { tipo_infrastruttura: 'Standard monofase (7.4-22kW)', numero_punti: 54, costo_totale: 5455 };
const ctx = { selectedInterventions: ['infrastrutture-ricarica', 'pompa-calore-elettrica'], selectedPremiums: [] };

console.log('SOG:');
console.log(JSON.stringify(sandbox.globalThis.calculatorData.getMassimaleSoggetto('infrastrutture-ricarica', params, 'private_tertiary_small', ctx), null, 2));
console.log('\nEXPLAIN:');
console.log(JSON.stringify(sandbox.globalThis.calculatorData.interventions['infrastrutture-ricarica'].explain(params, 'private_tertiary_small', ctx), null, 2));
