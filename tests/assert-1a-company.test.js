const fs = require('fs');

// Load runtime data.js and obtain calculatorData
const code = fs.readFileSync('data.js', 'utf8') + '\nreturn calculatorData;';
const calculatorData = new Function(code)();

// Params matching the screenshot: 1 row, superficie=100, costo_totale=100000
const params = {
  righe_opache: [ { tipologia_struttura: 'copertura_esterno', superficie: 100, costo_totale: 100000 } ],
  zona_climatica: 'A',
  premiums: {}
};

const operatorType = 'private_tertiary_medium';
const ctx = { selectedInterventions: ['isolamento-opache'], selectedPremiums: [] };

console.log('Available calculatorData keys:', Object.keys(calculatorData).join(', '));
if (typeof calculatorData.computeFinalForIntervention !== 'function') {
  console.error('ERROR: computeFinalForIntervention not available on calculatorData');
  process.exit(2);
}

const result = calculatorData.computeFinalForIntervention('isolamento-opache', params, operatorType, ctx);
console.log('computeFinalForIntervention result:');
console.log(JSON.stringify(result, null, 2));

// Also print a human summary
console.log('\nSummary:');
console.log('Itot:', calculatorData.formatCurrency(result.Itot));
console.log('Imas:', calculatorData.formatCurrency(result.Imas));
console.log('MassimaleSoggetto:', calculatorData.formatCurrency(result.MassimaleSoggetto));
console.log('Finale:', calculatorData.formatCurrency(result.finale));
