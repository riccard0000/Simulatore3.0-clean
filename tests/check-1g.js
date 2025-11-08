const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('src/data.js', 'utf8');
const sandbox = { console, window: {}, document: {}, navigator: {}, global: {} };
vm.createContext(sandbox);
vm.runInContext(code + '\nresult = typeof calculatorData !== "undefined" ? calculatorData : null;', sandbox);
const calculatorData = sandbox.result;
if (!calculatorData) { console.error('calculatorData not found'); process.exit(2); }

console.log('1.G default:', calculatorData.determinePercentuale([], {}, 'pa', {}, 'infrastrutture-ricarica'));
console.log('1.H default:', calculatorData.determinePercentuale([], {}, 'pa', {}, 'fotovoltaico-accumulo'));
console.log('1.G Art48ter:', calculatorData.determinePercentuale([], {}, 'pa', { buildingSubcategory: 'tertiary_school', subjectType: 'pa' }, 'infrastrutture-ricarica'));
console.log('1.G PiccoloComune:', calculatorData.determinePercentuale([], {}, 'pa', { is_comune: true, is_edificio_comunale: true, is_piccolo_comune: true, subjectType: 'pa' }, 'infrastrutture-ricarica'));
console.log('1.H PiccoloComune:', calculatorData.determinePercentuale([], {}, 'pa', { is_comune: true, is_edificio_comunale: true, is_piccolo_comune: true, subjectType: 'pa' }, 'fotovoltaico-accumulo'));
