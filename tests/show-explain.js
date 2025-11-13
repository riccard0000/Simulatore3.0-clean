const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('data.js', 'utf8');
const sandbox = { console, window: {}, document: {}, navigator: {}, global: {} };
vm.createContext(sandbox);
vm.runInContext(code + '\nresult = typeof calculatorData !== "undefined" ? calculatorData : null;', sandbox);
const calculatorData = sandbox.result;
if (!calculatorData) { console.error('calculatorData not found in data.js'); process.exit(2); }

const intId = 'isolamento-opache';
const intervention = calculatorData.interventions[intId];
const params = { zona_climatica: 'A', righe_opache: [ { tipologia_struttura: 'copertura_esterno', superficie: 100, costo_totale: 30000 } ] };
const contextData = { selectedInterventions: ['isolamento-opache','pompa-calore'], selectedPremiums: [], buildingSubcategory: '', subjectType: 'person' };

const exp = intervention.explain(params, 'private_tertiary_person', contextData);
console.log('explain.variables.p =', exp.variables.p, 'p_value=', exp.variables.p_value || exp.variables.pNumeric || exp.variables.p_num || null);
console.log('steps sample:', exp.steps.slice(0,5));
