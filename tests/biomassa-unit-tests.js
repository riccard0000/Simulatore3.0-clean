const fs = require('fs');
function assert(cond, msg) { if (!cond) { console.error('ASSERT FAILED:', msg); process.exit(2); } }

const code = fs.readFileSync('data.js', 'utf8') + '\nreturn calculatorData;';
const calculatorData = new Function(code)();
const biomassa = calculatorData.interventions['biomassa'];

// Test 1: pellet with Pn > 35 should be computed using caldaia fallback (result > 0)
(function testPelletOverLimit() {
    const params = { righe_biomassa: [{ tipo_generatore: 'Termocamini e stufe a pellet', potenza_nominale: 36, riduzione_emissioni: 'Fino al 20%' }], zona_climatica: 'B' };
    const res = biomassa.calculate(params, 'private_tertiary', { selectedInterventions: ['biomassa'] });
    assert(Number(res) === 0, 'Pellet Pn=36 should be ignored (result 0)');
    console.log('OK testPelletOverLimit');
})();

// Test 2: pellet with Pn <=35 should compute >0 and explain contains formula line
(function testPelletFormulaInExplain() {
    const params = { righe_biomassa: [{ tipo_generatore: 'Termocamini e stufe a pellet', potenza_nominale: 25, riduzione_emissioni: 'Dal 20% al 50%' }], zona_climatica: 'B' };
    const res = biomassa.calculate(params, 'private_tertiary', { selectedInterventions: ['biomassa'] });
    assert(Number(res) > 0, 'Pellet Pn=25 should produce positive incentive');
    const expl = biomassa.explain(params, 'private_tertiary', { selectedInterventions: ['biomassa'] });
    const hasFormula = expl.steps.some(s => s.indexOf('Formula: Ia_annuo') !== -1);
    assert(hasFormula, 'Explain must include formula line for pellet');
    console.log('OK testPelletFormulaInExplain');
})();

// Test 3: teleriscaldamento reduction (Ia_annuo reduced by 20%)
(function testTeleriscaldamentoReduction() {
    const baseParams = { righe_biomassa: [{ tipo_generatore: 'Caldaia a biomassa', potenza_nominale: 50, riduzione_emissioni: 'Fino al 20%' }], zona_climatica: 'C' };
    const noTR = biomassa.calculate(Object.assign({}, baseParams, { centrale_teleriscaldamento: 'No' }), 'private_tertiary', { selectedInterventions: ['biomassa'] });
    const yesTR = biomassa.calculate(Object.assign({}, baseParams, { centrale_teleriscaldamento: 'Sì' }), 'private_tertiary', { selectedInterventions: ['biomassa'] });
    // yesTR should be 0.8 * noTR (within small epsilon)
    const ratio = yesTR / noTR;
    assert(Math.abs(ratio - 0.8) < 1e-9, `Teleriscaldamento reduction expected ratio 0.8, got ${ratio}`);
    console.log('OK testTeleriscaldamentoReduction');
})();

// Test 4: when costo_totale is zero/no provided, cap not applied (final equals pre-tetto)
(function testNoCostNoCap() {
    const params = { costo_totale: 0, righe_biomassa: [{ tipo_generatore: 'Caldaia a biomassa', potenza_nominale: 32, riduzione_emissioni: 'Fino al 20%' }], zona_climatica: 'B' };
    const expl = biomassa.explain(params, 'private_tertiary', { selectedInterventions: ['biomassa'] });
    const hasNoCapLine = expl.steps.some(s => s.indexOf('Nessun costo totale fornito') !== -1 || s.indexOf('Nessun tetto applicato') !== -1);
    assert(hasNoCapLine, 'Explain should indicate no cap applied when costo_totale missing or zero');
    console.log('OK testNoCostNoCap');
})();

console.log('All biomassa unit tests passed.');
