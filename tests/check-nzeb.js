const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('data.js', 'utf8');
const sandbox = { console, window: {}, document: {}, navigator: {}, global: {} };
vm.createContext(sandbox);
vm.runInContext(code + '\nresult = typeof calculatorData !== "undefined" ? calculatorData : null;', sandbox);
const calculatorData = sandbox.result;
if (!calculatorData) { console.error('calculatorData not found'); process.exit(2); }

function assertAlmostEqual(a, b, tol = 1e-6) {
    if (Math.abs(a - b) > tol) {
        console.error(`Assertion failed: ${a} != ${b}`);
        process.exit(2);
    }
}

console.log('Test NZEB: determinePercentuale base (no UE, not art48ter, not piccolo)');
let det = calculatorData.determinePercentuale([], {}, 'private_tertiary_person', { selectedInterventions: ['nzeb'] }, 'nzeb');
console.log(det);
assertAlmostEqual(det.p, 0.65);

console.log('Test NZEB: with UE premium -> 75%');
det = calculatorData.determinePercentuale([], {}, 'private_tertiary_person', { selectedInterventions: ['nzeb'], selectedPremiums: ['prodotti-ue'] }, 'nzeb');
console.log(det);
assertAlmostEqual(det.p, 0.75);

console.log('Test NZEB: Art.48-ter forces 100%');
det = calculatorData.determinePercentuale([], {}, 'pa', { selectedInterventions: ['nzeb'], buildingSubcategory: 'tertiary_school' }, 'nzeb');
console.log(det);
assertAlmostEqual(det.p, 1.0);

console.log('Test NZEB: Piccolo comune forces 100%');
det = calculatorData.determinePercentuale([], {}, 'pa', { selectedInterventions: ['nzeb'], is_comune: true, is_edificio_comunale: true, is_piccolo_comune: true, subjectType: 'pa' }, 'nzeb');
console.log(det);
assertAlmostEqual(det.p, 1.0);

console.log('Test NZEB: calculate result and Imas cap (zona A)');
// zona A -> cmax 1000, imax 2_500_000
let params = { superficie: 100, costo_specifico: 2000, zona_climatica: 'A' };
let calc = calculatorData.interventions['nzeb'].calculate(params, 'private_tertiary_person', { selectedInterventions: ['nzeb'] });
console.log('calculated:', calc);
// expected: Ceff = min(2000,1000)=1000; p=0.65 => 0.65*1000*100 = 65000
assertAlmostEqual(calc, 65000);

console.log('Test NZEB: calculate result zona D (cmax 1300)');
params = { superficie: 100, costo_specifico: 2000, zona_climatica: 'D' };
calc = calculatorData.interventions['nzeb'].calculate(params, 'private_tertiary_person', { selectedInterventions: ['nzeb'] });
console.log('calculated:', calc);
// expected: Ceff = min(2000,1300)=1300; p=0.65 => 0.65*1300*100 = 84500
assertAlmostEqual(calc, 84500);

console.log('All NZEB tests passed.');
process.exit(0);
