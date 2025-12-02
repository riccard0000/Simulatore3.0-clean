const fs = require('fs');
function assert(cond, msg) { if (!cond) { console.error('ASSERT FAILED:', msg); process.exit(2); } }

const code = fs.readFileSync('data.js', 'utf8') + '\nreturn calculatorData;';
const calculatorData = new Function(code)();
const tel = calculatorData.interventions['teleriscaldamento'];

function computeExpected(params, contextData, operatorType) {
    const P = Number(params.potenza_contrattuale) || 0;
    const costo = Number(params.costo_totale) || 0;
    const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData || {}, 'teleriscaldamento');
    const p = det.p;

    let cmax;
    if (P <= 50) cmax = 200;
    else if (P <= 150) cmax = 160;
    else cmax = 130;

    const costoAmmissibile = P * cmax;
    const costoEffettivo = Math.min(costo, costoAmmissibile);

    const base = p * costoEffettivo;

    let imax;
    if (P <= 50) imax = 6500;
    else if (P <= 150) imax = 15000;
    else imax = 30000;

    const soggettoCap = p * costo;

    return Math.min(base, imax, soggettoCap);
}

// Test cases
(function testBand1() {
    const params = { potenza_contrattuale: 40, costo_totale: 20000 };
    const ctx = { selectedInterventions: ['teleriscaldamento'] };
    const res = tel.calculate(params, 'private_tertiary', ctx);
    const expected = computeExpected(params, ctx, 'private_tertiary');
    assert(Math.abs(res - expected) < 1e-9, `Band1 expected ${expected}, got ${res}`);
    console.log('OK testBand1');
})();

(function testBand2() {
    const params = { potenza_contrattuale: 120, costo_totale: 50000 };
    const ctx = { selectedInterventions: ['teleriscaldamento'] };
    const res = tel.calculate(params, 'private_tertiary', ctx);
    const expected = computeExpected(params, ctx, 'private_tertiary');
    assert(Math.abs(res - expected) < 1e-9, `Band2 expected ${expected}, got ${res}`);
    console.log('OK testBand2');
})();

(function testBand3_capBySoggetto() {
    // Use cost large so base>imax but subject cap p*costo binds
    const params = { potenza_contrattuale: 200, costo_totale: 100000 };
    const ctx = { selectedInterventions: ['teleriscaldamento'] };
    const det = calculatorData.determinePercentuale(ctx.selectedInterventions, params, 'private_tertiary', ctx, 'teleriscaldamento');
    const p = det.p;
    const res = tel.calculate(params, 'private_tertiary', ctx);
    const expected = computeExpected(params, ctx, 'private_tertiary');
    assert(Math.abs(res - expected) < 1e-9, `Band3 expected ${expected}, got ${res} (p=${p})`);
    console.log('OK testBand3_capBySoggetto');
})();

console.log('All teleriscaldamento unit tests passed.');
