const fs = require('fs');
function assert(cond, msg) { if (!cond) { console.error('ASSERT FAILED:', msg); process.exit(2); } }

const code = fs.readFileSync('data.js', 'utf8') + '\nreturn calculatorData;';
const calculatorData = new Function(code)();
const sc = calculatorData.interventions['scaldacqua-pdc'];

// Test 1: single unit Classe A <=150, cost 2000 -> base=800, max per unit=500 -> final=500
(function testSingleA_under150() {
    const params = { costo_totale: 2000, righe_sc: [{ classe_prodotto: 'Classe A', capacita_band: '≤ 150 L', quantita: 1 }] };
    const res = sc.calculate(params, 'private_tertiary', { selectedInterventions: ['scaldacqua-pdc'] });
    assert(Math.abs(Number(res) - 500) < 1e-9, `Expected 500, got ${res}`);
    console.log('OK testSingleA_under150');
})();

// Test 2: single unit Classe A+ >150, cost 1000 -> base=400, max per unit=1500 -> final=400
(function testSingleAplus_over150() {
    const params = { costo_totale: 1000, righe_sc: [{ classe_prodotto: 'Classe A+', capacita_band: '> 150 L', quantita: 1 }] };
    const res = sc.calculate(params, 'private_tertiary', { selectedInterventions: ['scaldacqua-pdc'] });
    assert(Math.abs(Number(res) - 400) < 1e-9, `Expected 400, got ${res}`);
    console.log('OK testSingleAplus_over150');
})();

// Test 3: multiple rows sumMassimali > base -> final = base
(function testMultipleRows_baseSmaller() {
    const params = { costo_totale: 5000, righe_sc: [
        { classe_prodotto: 'Classe A', capacita_band: '≤ 150 L', quantita: 1 }, // 500
        { classe_prodotto: 'Classe A+', capacita_band: '> 150 L', quantita: 2 } // 1500*2 = 3000
    ] };
    const res = sc.calculate(params, 'private_tertiary', { selectedInterventions: ['scaldacqua-pdc'] });
    const base = 0.40 * 5000; // 2000
    assert(Math.abs(Number(res) - base) < 1e-9, `Expected ${base}, got ${res}`);
    console.log('OK testMultipleRows_baseSmaller');
})();

// Test 4: multiple rows sumMassimali < base -> final = sumMassimali
(function testMultipleRows_sumSmaller() {
    const params = { costo_totale: 4000, righe_sc: [
        { classe_prodotto: 'Classe A', capacita_band: '≤ 150 L', quantita: 1 }, // 500
        { classe_prodotto: 'Classe A', capacita_band: '> 150 L', quantita: 1 } // 1100
    ] };
    const res = sc.calculate(params, 'private_tertiary', { selectedInterventions: ['scaldacqua-pdc'] });
    const sumMass = 500 + 1100; // 1600
    assert(Math.abs(Number(res) - sumMass) < 1e-9, `Expected ${sumMass}, got ${res}`);
    console.log('OK testMultipleRows_sumSmaller');
})();

console.log('All scaldacqua-pdc unit tests passed.');
