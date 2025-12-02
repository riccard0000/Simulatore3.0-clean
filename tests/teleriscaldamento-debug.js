const fs = require('fs');
function log(obj){ console.log(JSON.stringify(obj, null, 2)); }
const code = fs.readFileSync('data.js', 'utf8') + '\nreturn calculatorData;';
const calculatorData = new Function(code)();
const tel = calculatorData.interventions['teleriscaldamento'];

const cases = [
  {
    name: 'Private small enterprise (default small)',
    params: { potenza_contrattuale: 25, costo_totale: 5000 },
    operatorType: 'private_tertiary_small',
    context: { selectedInterventions: ['teleriscaldamento'], subjectSpecificData: { conferma_piccola_impresa: true } }
  },
  {
    name: 'Private medium enterprise (operatorType medium)',
    params: { potenza_contrattuale: 25, costo_totale: 5000 },
    operatorType: 'private_tertiary_medium',
    context: { selectedInterventions: ['teleriscaldamento'] }
  },
  {
    name: 'Private large enterprise (confirmed flag)',
    params: { potenza_contrattuale: 200, costo_totale: 100000 },
    operatorType: 'private_tertiary_large',
    context: { selectedInterventions: ['teleriscaldamento'], subjectSpecificData: { conferma_grande_impresa: true } }
  },
  {
    name: 'School (Art.48-ter) should get p=100%',
    params: { potenza_contrattuale: 25, costo_totale: 5000 },
    operatorType: 'pa',
    context: { selectedInterventions: ['teleriscaldamento'], buildingSubcategory: 'tertiary_school', subjectType: 'pa' }
  },
  {
    name: 'Small municipality (Comune <15k) p=100%',
    params: { potenza_contrattuale: 25, costo_totale: 5000 },
    operatorType: 'pa',
    context: { selectedInterventions: ['teleriscaldamento'], is_comune: true, is_edificio_comunale: true, is_piccolo_comune: true, subjectType: 'pa' }
  }
];

for (const c of cases) {
  console.log('\n---- CASE: ' + c.name + ' ----');
  try {
    const calc = tel.calculate(c.params, c.operatorType, c.context);
    console.log('calculate result:', calc);
    const expl = tel.explain(c.params, c.operatorType, c.context);
    console.log('explain result:'); log(expl);
  } catch (e) {
    console.error('Error running case', c.name, e);
  }
}

console.log('\nDebug complete.');
