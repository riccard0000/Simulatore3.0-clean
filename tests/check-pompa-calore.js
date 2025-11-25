const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

// load data.js into a vm sandbox so we can call calculatorData functions
const code = fs.readFileSync('data.js', 'utf8');
const sandbox = { console, window: {}, document: {}, navigator: {}, global: {}, process };
vm.createContext(sandbox);
vm.runInContext(code + '\nresult = typeof calculatorData !== "undefined" ? calculatorData : null;', sandbox);
const calculatorData = sandbox.result;
if (!calculatorData) { console.error('calculatorData not found'); process.exit(2); }

console.log('Running pompa-calore-elettrica tests...');

// Helper to call calculate/explain for pompa-calore-elettrica
function callDeterminePercent(selectedInterventions, params, operatorType, contextData) {
    return calculatorData.determinePercentuale(selectedInterventions || [], params || {}, operatorType || '', contextData || {}, 'pompa-calore-elettrica');
}

// Test 1: Large enterprise (private_tertiary_large) -> p = 0.45
let det = callDeterminePercent([], {}, 'private_tertiary_large', { selectedInterventions: [] });
console.log('det for large enterprise =>', det);
assert.strictEqual(typeof det.p, 'number');
assert.strictEqual(det.p, 0.45, 'Large enterprise should have p = 0.45 for Category 2');

// Test 2: Medium enterprise -> p = 0.55
let det2 = callDeterminePercent([], {}, 'private_tertiary_medium', { selectedInterventions: [] });
assert.strictEqual(det2.p, 0.55, 'Medium enterprise should have p = 0.55 for Category 2');

// Test 3: Small enterprise -> p = 0.65
let det3 = callDeterminePercent([], {}, 'private_tertiary_small', { selectedInterventions: [] });
assert.strictEqual(det3.p, 0.65, 'Small enterprise should have p = 0.65 for Category 2');

// Test 4: PA -> p = 0.65
let det4 = callDeterminePercent([], {}, 'pa', { selectedInterventions: [] });
assert.strictEqual(det4.p, 0.65, 'PA should have p = 0.65 for Category 2');

// Test 5: Piccolo comune / Art.48-ter override to 100%
let det5 = callDeterminePercent([], {}, 'pa', { selectedInterventions: [], buildingSubcategory: 'tertiary_school', is_comune: true, is_edificio_comunale: true, is_piccolo_comune: true, subjectType: 'pa' });
assert.strictEqual(det5.p, 1.0, 'Piccolo comune / Art.48-ter should override to 100%');

console.log('All pompa-calore-elettrica tests passed.');
