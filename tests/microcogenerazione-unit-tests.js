const fs = require('fs');
function assert(cond, msg) { if (!cond) { console.error('ASSERT FAILED:', msg); process.exit(2); } }

const code = fs.readFileSync('data.js', 'utf8') + '\nreturn calculatorData;';
const calculatorData = new Function(code)();
const mc = calculatorData.interventions['microcogenerazione'];

// Test 1: PA, base 65% applies, small spesa -> Itot = 0.65 * (Spesa/P) * P = 0.65 * Spesa
(function testPA_base65_smallSpesa() {
    const params = { potenza_elettrica: 10, costo_totale: 1000 };
    const res = mc.calculate(params, 'pa', { selectedInterventions: ['microcogenerazione'] });
    // C = 1000/10 = 100 -> C_eff = 100 -> Itot = 0.65*100*10 = 650
    assert(Math.abs(Number(res) - 650) < 1e-9, `Expected 650, got ${res}`);
    console.log('OK testPA_base65_smallSpesa');
})();

// Test 2: Art.48-ter (school) -> basePct = 100%
(function testArt48ter_school() {
    const params = { potenza_elettrica: 10, costo_totale: 1000 };
    const res = mc.calculate(params, 'pa', { selectedInterventions: ['microcogenerazione'], buildingSubcategory: 'tertiary_school' });
    // basePct 1.0 => Itot = 1.0 * 100 * 10 = 1000
    assert(Math.abs(Number(res) - 1000) < 1e-9, `Expected 1000, got ${res}`);
    console.log('OK testArt48ter_school');
})();

// Test 3: small company -> company cap equals 65% of spesa
(function testSmallCompany_cap() {
    const params = { potenza_elettrica: 10, costo_totale: 10000 };
    const res = mc.calculate(params, 'private_tertiary_small', { selectedInterventions: ['microcogenerazione'] });
    // C = 10000/10 = 1000 -> C_eff = 1000 -> Itot = 0.65*1000*10 = 6500
    // companyCap = 0.65 * 10000 = 6500 -> final = 6500
    assert(Math.abs(Number(res) - 6500) < 1e-9, `Expected 6500, got ${res}`);
    console.log('OK testSmallCompany_cap');
})();

// Test 4: large company -> company cap 45% reduces final
(function testLargeCompany_restricts() {
    const params = { potenza_elettrica: 10, costo_totale: 10000 };
    const res = mc.calculate(params, 'private_tertiary_large', { selectedInterventions: ['microcogenerazione'] });
    // Itot = 6500, companyCap = 0.45*10000 = 4500 -> final = 4500
    assert(Math.abs(Number(res) - 4500) < 1e-9, `Expected 4500, got ${res}`);
    console.log('OK testLargeCompany_restricts');
})();

console.log('All microcogenerazione unit tests passed.');
