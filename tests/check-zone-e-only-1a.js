const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('data.js', 'utf8');
const sandbox = { console, window: {}, document: {}, navigator: {}, global: {} };
vm.createContext(sandbox);
vm.runInContext(code + '\nresult = typeof calculatorData !== "undefined" ? calculatorData : null;', sandbox);
const calculatorData = sandbox.result;
if (!calculatorData) {
  console.error('calculatorData not found in data.js');
  process.exit(2);
}

function show(desc, out) {
  console.log(`${desc}: p=${out.p}, pDesc='${out.pDesc}'`);
}

// Case A: isolamento-opache with zona E
let out1 = calculatorData.determinePercentuale([], { zona_climatica: 'E' }, 'private_tertiary_person', {}, 'isolamento-opache');
show('isolamento-opache, zona E', out1);

// Case B: sostituzione-infissi with zona E (should NOT get 50% now)
let out2 = calculatorData.determinePercentuale([], { zona_climatica: 'E' }, 'private_tertiary_person', {}, 'sostituzione-infissi');
show('sostituzione-infissi, zona E', out2);

// Case C: generic interventionId 'any' with zona E
let out3 = calculatorData.determinePercentuale([], { zona_climatica: 'E' }, 'private_tertiary_person', {}, 'any');
show("generic 'any', zona E", out3);

console.log('Done.');
