const fs = require('fs');

// Load src/data.js by wrapping it in a function so we can retrieve calculatorData
const code = fs.readFileSync('src/data.js', 'utf8') + '\nreturn calculatorData;';
const calculatorData = new Function(code)();

// Input provided by user
const params = {
    premiums: { 'prodotti-ue': false },
    superficie: 453,
    costo_totale: 543543,
    costo_specifico: 119987
};

const selectedInterventions = ['building-automation'];
const inputsByIntervention = { 'building-automation': params };
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
    console.error('Error running calculation:', e);
}
