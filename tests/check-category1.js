const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('data.js', 'utf8');
const sandbox = { console, window: {}, document: {}, navigator: {}, global: {} };
vm.createContext(sandbox);
vm.runInContext(code + '\nresult = typeof calculatorData !== "undefined" ? calculatorData : null;', sandbox);
const calculatorData = sandbox.result;
if (!calculatorData) { console.error('calculatorData not found'); process.exit(2); }

console.log('Small company, single intervention (isolamento-opache):', calculatorData.determinePercentuale(['isolamento-opache'], {}, 'private_tertiary_small', { selectedInterventions: ['isolamento-opache'] }, 'isolamento-opache'));
console.log('Small company, two interventions (isolamento + sostituzione):', calculatorData.determinePercentuale(['isolamento-opache','sostituzione-infissi'], {}, 'private_tertiary_small', { selectedInterventions: ['isolamento-opache','sostituzione-infissi'] }, 'isolamento-opache'));
console.log('Medium company, two interventions, with INCREMENTO_INT3:', calculatorData.determinePercentuale(['isolamento-opache','sostituzione-infissi'], {}, 'private_tertiary_medium', { selectedInterventions: ['isolamento-opache','sostituzione-infissi'], selectedPremiums: ['INCREMENTO_INT3'] }, 'sostituzione-infissi'));
console.log('Large company, two interventions, with INCREMENTO_INT4 and INCREMENTO_INT5:', calculatorData.determinePercentuale(['isolamento-opache','sostituzione-infissi'], {}, 'private_tertiary_large', { selectedInterventions: ['isolamento-opache','sostituzione-infissi'], selectedPremiums: ['INCREMENTO_INT4','INCREMENTO_INT5'] }, 'sostituzione-infissi'));
console.log('Small company, many interventions, with all flags:', calculatorData.determinePercentuale(['isolamento-opache','sostituzione-infissi','pompa-calore-elettrica'], {}, 'private_tertiary_small', { selectedInterventions: ['isolamento-opache','sostituzione-infissi','pompa-calore-elettrica'], selectedPremiums: ['INCREMENTO_INT3','INCREMENTO_INT4','INCREMENTO_INT5'] }, 'pompa-calore-elettrica'));
