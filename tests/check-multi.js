const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('data.js', 'utf8');
const sandbox = { console, window: {}, document: {}, navigator: {}, global: {} };
vm.createContext(sandbox);
vm.runInContext(code + '\nresult = typeof calculatorData !== "undefined" ? calculatorData : null;', sandbox);
const calculatorData = sandbox.result;
if (!calculatorData) { console.error('calculatorData not found in data.js'); process.exit(2); }

const selectedInterventions = ['isolamento-opache','pompa-calore-elettrica'];
const inputsByIntervention = {
  'isolamento-opache': {},
  'pompa-calore-elettrica': {}
};
const operatorType = 'private_tertiary_person';
const globalPremiums = [];
const contextData = { selectedInterventions };

const out = calculatorData.calculateCombinedIncentives(selectedInterventions, inputsByIntervention, operatorType, globalPremiums, contextData);
console.log('Result summary:');
console.log('total:', out.total);
console.log('appliedGlobalPremiums:', JSON.stringify(out.appliedGlobalPremiums, null, 2));
console.log('details:');
out.details.forEach(d => {
  console.log('-', d.id, 'base:', d.baseIncentive, 'final:', d.finalIncentive);
  console.log('  appliedPremiums:', JSON.stringify(d.appliedPremiums, null, 2));
});
