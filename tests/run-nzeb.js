const fs = require('fs');

// Load runtime data.js (the one the browser serves)
const code = fs.readFileSync('data.js', 'utf8') + '\nreturn calculatorData;';
const calculatorData = new Function(code)();

const params = {
  premiums: {},
  superficie: 432,
  costo_specifico: 1000, // to reproduce the screenshot where Ceff=1000
  costo_totale: 432000
};

const selectedInterventions = ['nzeb'];
const inputsByIntervention = { 'nzeb': params };
const operatorType = 'private_tertiary';
const globalPremiums = [];
const contextData = {
  selectedInterventions: selectedInterventions,
  selectedPremiums: globalPremiums,
  subjectType: 'person'
};

try {
  const combo = calculatorData.calculateCombinedIncentives(selectedInterventions, inputsByIntervention, operatorType, globalPremiums, contextData);
  console.log(JSON.stringify(combo, null, 2));
} catch (e) {
  console.error('Error running nzeb calculation:', e);
}
