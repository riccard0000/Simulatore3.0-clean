const fs = require('fs');
const vm = require('vm');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const sandbox = { require: require, console: console, process: process, globalThis: {} };
vm.createContext(sandbox);
vm.runInContext(code + '\nif (typeof calculatorData !== "undefined") globalThis.calculatorData = calculatorData;', sandbox, { filename: 'data.js' });

const paramsNo = { potenza_fv: 50, capacita_accumulo: 20, registro_ue: 'No', costo_totale: 60000 };
const paramsYes = { potenza_fv: 50, capacita_accumulo: 20, registro_ue: 'Sì - Requisiti lett. b) (+10%)', costo_totale: 60000 };
const ctx = { selectedInterventions: ['fotovoltaico-accumulo'] };

console.log('--- Explain (registro = No) ---');
console.log(JSON.stringify(sandbox.globalThis.calculatorData.interventions['fotovoltaico-accumulo'].explain(paramsNo, 'private_tertiary_person', ctx), null, 2));
console.log('\n--- Explain (registro = Yes) ---');
console.log(JSON.stringify(sandbox.globalThis.calculatorData.interventions['fotovoltaico-accumulo'].explain(paramsYes, 'private_tertiary_person', ctx), null, 2));
