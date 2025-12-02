const fs = require('fs');

try {
    const code = fs.readFileSync('data.js', 'utf8') + '\nreturn calculatorData;';
    const calculatorData = new Function(code)();

    const params = {
        costo_totale: 323,
        righe_biomassa: [
            {
                tipo_generatore: 'Caldaia a biomassa',
                potenza_nominale: 32,
                riduzione_emissioni: 'Fino al 20%',
                emissioni_classe: '4'
            }
        ],
        zona_climatica: 'B',
        centrale_teleriscaldamento: 'No'
    };

    const selectedInterventions = ['biomassa'];
    const inputsByIntervention = { 'biomassa': params };
    const operatorType = 'private_tertiary';
    const globalPremiums = [];
    const contextData = { selectedInterventions, selectedPremiums: [], subjectType: 'person' };

    const combo = calculatorData.calculateCombinedIncentives(selectedInterventions, inputsByIntervention, operatorType, globalPremiums, contextData);
    console.log('RESULT');
    console.log(JSON.stringify(combo, null, 2));
} catch (e) {
    console.error('ERROR', e && e.stack || e);
    process.exit(1);
}
