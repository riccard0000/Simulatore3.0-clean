const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('data.js', 'utf8');
const sandbox = { console, window: {}, document: {}, navigator: {}, global: {} };
vm.createContext(sandbox);
vm.runInContext(code + '\nresult = typeof calculatorData !== "undefined" ? calculatorData : null;', sandbox);
const calculatorData = sandbox.result;
if (!calculatorData) { console.error('calculatorData not found'); process.exit(2); }

console.log('Running 1.C Art.48-ter unit test (schermature-solari)');

const inputs = {
    'schermature-solari': {
        righe_schermature: [
            { tipologia_schermatura: 'Schermature/ombreggiamento', superficie: 4332, costo_totale: 4324 }
        ]
    }
};

const context = { buildingSubcategory: 'tertiary_school', subjectType: 'pa', selectedInterventions: ['schermature-solari'] };

const combo = calculatorData.calculateCombinedIncentives(['schermature-solari'], inputs, 'pa', [], context);

console.log('combo:', JSON.stringify(combo, null, 2));

// Assertions
let ok = true;
if (!combo || typeof combo !== 'object') {
    console.error('❌ No combo result'); ok = false;
}
if (!combo.isIncentivo100) {
    console.error('❌ Expected isIncentivo100 true'); ok = false;
}
if (!Array.isArray(combo.details) || combo.details.length === 0) {
    console.error('❌ Expected details array with at least one element'); ok = false;
}
const det = combo.details.find(d => d.id === 'schermature-solari');
if (!det) {
    console.error('❌ Expected detail for schermature-solari'); ok = false;
} else {
    if (!det.appliedPremiums || !det.appliedPremiums.some(p => p.id === 'incentivo-100-auto')) {
        console.error('❌ Expected appliedPremiums to include incentivo-100-auto'); ok = false;
    }
    if (!det.finalIncentive || Number(det.finalIncentive) <= 0) {
        console.error('❌ Expected finalIncentive > 0 for detail'); ok = false;
    }
}

const global100 = Array.isArray(combo.appliedGlobalPremiums) && combo.appliedGlobalPremiums.find(p => p.id === 'incentivo-100-auto');
if (!global100) {
    console.error('❌ Expected global appliedPremiums to include incentivo-100-auto'); ok = false;
} else {
    if (!global100.value || Number(global100.value) <= 0) {
        console.error('❌ Expected global incentive value > 0'); ok = false;
    }
}

if (ok) {
    console.log('✅ 1.C Art.48-ter test passed');
    process.exit(0);
} else {
    console.error('❌ 1.C Art.48-ter test FAILED');
    process.exit(3);
}
