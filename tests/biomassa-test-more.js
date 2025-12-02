const fs = require('fs');

try {
    const code = fs.readFileSync('data.js', 'utf8') + '\nreturn calculatorData;';
    const calculatorData = new Function(code)();

    const params = {
        costo_totale: 1000,
        righe_biomassa: [
            {
                tipo_generatore: 'Caldaia a biomassa',
                potenza_nominale: 32,
                riduzione_emissioni: 'Fino al 20%',
                emissioni_classe: '4'
            },
            {
                tipo_generatore: 'Termocamini e stufe a pellet',
                potenza_nominale: 25,
                riduzione_emissioni: 'Dal 20% al 50%',
                emissioni_classe: '5'
            },
            {
                tipo_generatore: 'Termocamini e stufe a legna',
                potenza_nominale: 10,
                riduzione_emissioni: 'Oltre il 50%',
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

    const explain = calculatorData.interventions['biomassa'].explain(params, operatorType, contextData);
    console.log('\nEXPLAIN STEPS:\n');
    explain.steps.forEach(s => console.log(s));

} catch (e) {
    console.error('ERROR', e && e.stack || e);
    process.exit(1);
}
