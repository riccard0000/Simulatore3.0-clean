const fs = require('fs');
const vm = require('vm');

// Load the calculator code (data.js) into a VM and expose calculatorData
// Note: file lives at repository root as `data.js`.
const code = fs.readFileSync('data.js', 'utf8');
const sandbox = { console, window: {}, document: {}, navigator: {}, global: {} };
vm.createContext(sandbox);
vm.runInContext(code + '\nresult = typeof calculatorData !== "undefined" ? calculatorData : null;', sandbox);
const calculatorData = sandbox.result;
if (!calculatorData) {
  console.error('calculatorData not found in src/data.js');
  process.exit(2);
}

function expectEqual(desc, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${desc}: got=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
}

// Tests
const tests = [];

// 1. Base case (private, no premiums, no zone) -> 40%
tests.push({
  desc: 'Base private (no zone, no premiums) -> 40%',
  args: { selectedInterventions: [], params: {}, operatorType: 'private_tertiary_person', contextData: {} , interventionId: 'any'},
  expected: { p: 0.40 }
});

// 2. Zone E private -> 50%
tests.push({
  desc: 'Zone E private -> 50% (applicato solo a 1.A isolamento-opache)',
  args: { selectedInterventions: [], params: { zona_climatica: 'E' }, operatorType: 'private_tertiary_person', contextData: {}, interventionId: 'isolamento-opache'},
  expected: { p: 0.50 }
});

// 3. Multi-intervento 1.A + 2.A -> isolamento-opache p=55%
tests.push({
  desc: "Multi intervento: isolamento-opache with pompa-calore-elettrica -> 55%",
  args: { selectedInterventions: ['isolamento-opache','pompa-calore-elettrica'], params: {}, operatorType: 'private_tertiary_person', contextData: { selectedInterventions: ['isolamento-opache','pompa-calore-elettrica'] }, interventionId: 'isolamento-opache'},
  expected: { p: 0.55 }
});

// 4. Multi-intervento 1.B when 1.A + Titolo III present -> 55%
tests.push({
  desc: "Multi intervento: sostituzione-infissi when 1A+TitoloIII present -> 55%",
  args: { selectedInterventions: ['isolamento-opache','sostituzione-infissi','pompa-calore-elettrica'], params: {}, operatorType: 'private_tertiary_person', contextData: { selectedInterventions: ['isolamento-opache','sostituzione-infissi','pompa-calore-elettrica'] }, interventionId: 'sostituzione-infissi'},
  expected: { p: 0.55 }
});

// 5. UE premium adds +10 percentage points (e.g., zone E -> 50% -> 60%)
tests.push({
  desc: 'Zone E with prodotti-ue premium -> 60% (cap 100%) for 1.A isolamento-opache',
  args: { selectedInterventions: [], params: { zona_climatica: 'E', premiums: { 'prodotti-ue': true } }, operatorType: 'private_tertiary_person', contextData: { selectedPremiums: ['prodotti-ue'] }, interventionId: 'isolamento-opache'},
  expected: { p: 0.60 }
});

// 6. Art.48-ter school (PA) -> 100%
tests.push({
  desc: 'Art.48-ter school (PA) -> 100%',
  args: { selectedInterventions: [], params: {}, operatorType: 'pa', contextData: { buildingSubcategory: 'tertiary_school', subjectType: 'pa' }, interventionId: 'isolamento-opache'},
  expected: { p: 1.0 }
});

// 7. Piccolo comune flags -> 100%
tests.push({
  desc: 'Piccolo comune -> 100%',
  args: { selectedInterventions: [], params: {}, operatorType: 'pa', contextData: { is_comune: true, is_edificio_comunale: true, is_piccolo_comune: true, subjectType: 'pa' }, interventionId: 'isolamento-opache'},
  expected: { p: 1.0 }
});

// 8. UE cap at 100% (if p was already 95% and +10% -> cap to 100%)
// Simulate by forcing a scenario where p would be 0.95 (not present in rules), but we can test capping by setting p artificially via context: not directly possible. Instead test that if p=1.0, hasUE doesn't increase beyond 1.0
tests.push({
  desc: 'PA Art48ter with prodotti-ue remains 100% (cap)',
  args: { selectedInterventions: [], params: { premiums: { 'prodotti-ue': true } }, operatorType: 'pa', contextData: { buildingSubcategory: 'tertiary_school', subjectType: 'pa', selectedPremiums: ['prodotti-ue'] }, interventionId: 'isolamento-opache'},
  expected: { p: 1.0 }
});

// Run tests
for (const t of tests) {
  const { selectedInterventions, params, operatorType, contextData, interventionId } = t.args;
  const out = calculatorData.determinePercentuale(selectedInterventions || [], params || {}, operatorType || '', contextData || {}, interventionId || '');
  expectEqual(t.desc, { p: out.p }, t.expected);
}

console.log('Done.');
