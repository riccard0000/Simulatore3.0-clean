// Funzione di inizializzazione principale
async function initCalculator() {
    // WASM support rimosso: usiamo sempre i calcoli JavaScript
    console.log('ℹ️  Usando calcoli JavaScript (WASM rimosso)');

    // Elementi DOM per i passi
    const subjectTypeSelect = document.getElementById('subject-type');
    const buildingCategorySelect = document.getElementById('building-category');
    const buildingCategoryGroup = document.getElementById('building-category-group');
    
    const interventionsList = document.getElementById('interventions-list');
    const premiumsList = document.getElementById('premiums-list');
    const dynamicInputsContainer = document.getElementById('dynamic-inputs');
    const calculateButton = document.getElementById('calculate-btn');
    const resetButton = document.getElementById('reset-btn');
    const resultsContainer = document.getElementById('result-container');
    const incentiveResultEl = document.getElementById('result-amount');
    const resultDetailsEl = document.getElementById('result-details');

    // Stato dell'applicazione
    const state = {
        selectedSubject: '', // Step 1
        selectedBuilding: '', // Step 2
        buildingSubcategory: '', // Sottocategoria terziario (school/hospital/prison)
        selectedMode: '', // Step 3 - inizialmente vuoto, richiede selezione esplicita
        selectedOperator: '', // operatorType calcolato dalla matrice
        selectedInterventions: [],
        selectedPremiums: [],
        inputValues: {},
        subjectSpecificData: {} // Dati aggiuntivi come popolazione_comune
    };

    // Keep previous selection snapshot to allow reverting when user attempts incompatible selection
    let prevSelectedInterventions = [];

    // NOTE: automatic ecodesign SCOP/COP population removed per user request.
    // Users must enter SCOP/SCOP_min manually; validation and power constraints remain active.

    // Normative SCOP minima per tipologia pompa (tabella ecodesign)
        const PUMP_SCOP_MIN = {}; // Legacy in-file maps have been removed to ensure a single source of truth.
        // Normative SCOP minima are obtained from the canonical regulatory table
        // (via getPumpEcodesignSpec / lookupRegulatorySpec). Legacy in-file maps
        // have been removed to ensure a single source of truth.

    function canonicalKey(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    }

    // Shared helper: apply SCOP minimum constraint for a given table row.
    // Some per-row handlers used to define a local applyScopMinConstraint which
    // caused ReferenceError when other handlers attempted to call it. Expose
    // a single helper that accepts the row element.
    function applyScopMinConstraintForRow(tr) {
        try {
            if (!tr) return;
            const scopInput = tr.querySelector('[data-column-id="scop"]');
            const copInput = tr.querySelector('[data-column-id="cop"]');
            if (!scopInput) return;
            // If the SCOP input is disabled for this row (e.g. fixed double duct),
            // clear any previous SCOP error visuals but do NOT early-return —
            // COP may still be required/validated for fixed double duct rows.
            try {
                if (scopInput.disabled) {
                    scopInput.classList.remove('invalid');
                    try { scopInput.setCustomValidity(''); } catch (e) {}
                    const scopErr = scopInput.parentNode ? scopInput.parentNode.querySelector('.field-error') : null;
                    if (scopErr) { scopErr.textContent = ''; scopErr.style.display = 'none'; }
                    scopInput.style.borderColor = '';
                    scopInput.style.backgroundColor = '';
                    // do not clear COP here; COP validation should run below when applicable
                }
            } catch (e) { /* ignore */ }
            const tipoEl = tr.querySelector('[data-column-id="tipo_pompa"]');
            const gwpEl = tr.querySelector('[data-column-id="gwp"]');
            const gwpVal = gwpEl ? (gwpEl.value || '') : null;
            const tipoVal = String(tipoEl ? (tipoEl.value || '') : '').trim();
            const alimentazioneEl = tr.querySelector('[data-column-id="alimentazione"]');
            const alimentazioneVal = alimentazioneEl ? (alimentazioneEl.value || 'Elettrica') : 'Elettrica';

            // attempt to reuse ecodesign helper from data.js and obtain separate minima for SCOP and COP
            // Prefer the canonical regulatory table via getPumpEcodesignSpec/lookupRegulatorySpec.
            // Only use the legacy in-file PUMP_SCOP_MIN fallback for Elettrica when no table match exists.
            let scopMin = null;
            let copMin = null;
            try {
                const spec = (typeof getPumpEcodesignSpec === 'function') ? getPumpEcodesignSpec(tipoVal, gwpVal, alimentazioneVal) : null;
                if (spec) {
                    if (typeof spec.scop !== 'undefined') scopMin = spec.scop;
                    if (typeof spec.cop !== 'undefined') copMin = spec.cop;
                }
            } catch (e) {
                console.warn('getPumpEcodesignSpec not available', e);
            }

            // If the ecodesign helper didn't return a spec, try a direct regulatory lookup
            // (this covers cases where the helper isn't exposed but the canonical table exists).
            if ((scopMin === null || scopMin === undefined) && (copMin === null || copMin === undefined)) {
                try {
                    if (typeof lookupRegulatorySpec === 'function') {
                        const reg = lookupRegulatorySpec(tipoVal, gwpVal, alimentazioneVal);
                        if (reg) {
                            if (typeof reg.scop_min !== 'undefined') scopMin = reg.scop_min;
                            else if (typeof reg.sper_min !== 'undefined') scopMin = reg.sper_min;
                            if (typeof reg.cop_min !== 'undefined') copMin = reg.cop_min;
                        }
                    }
                } catch (e) {
                    // ignore and fall back to legacy mapping below
                }
            }

            // No legacy fallback: rely exclusively on the canonical regulatory table
            // (getPumpEcodesignSpec / lookupRegulatorySpec) for minima.

            if (scopMin !== null && scopMin !== undefined) {
                scopInput.setAttribute('min', String(scopMin));
            } else {
                scopInput.removeAttribute('min');
            }
            try { scopInput.setAttribute('step', 'any'); } catch (e) {}
            if (copInput) {
                if (copMin !== null && copMin !== undefined) copInput.setAttribute('min', String(copMin)); else copInput.removeAttribute('min');
                try { copInput.setAttribute('step', 'any'); } catch (e) {}
            }

            // Inline error element lives next to the scop input's td
            const scopErr = scopInput.parentNode ? scopInput.parentNode.querySelector('.field-error') : null;
            const copErr = copInput && copInput.parentNode ? copInput.parentNode.querySelector('.field-error') : null;
            const raw = String(scopInput.value || '').replace(',', '.').trim();
            const num = raw === '' ? NaN : parseFloat(raw);
            const decPart = (raw.indexOf('.') >= 0) ? raw.split('.')[1] : '';
            if (decPart && decPart.length > 3) {
                scopInput.classList.add('invalid');
                try { scopInput.setCustomValidity('Inserire al massimo 3 cifre decimali'); } catch (e) {}
                if (scopErr) { scopErr.textContent = 'Inserire al massimo 3 cifre decimali'; scopErr.style.display = 'block'; }
                // visual emphasis
                scopInput.style.borderColor = '#d32f2f'; scopInput.style.backgroundColor = '#ffebee';
            } else if ((raw === '' || raw === null) && scopInput.required && !scopInput.disabled) {
                // Empty but required
                scopInput.classList.add('invalid');
                try { scopInput.setCustomValidity('Campo obbligatorio'); } catch (e) {}
                if (scopErr) { scopErr.textContent = 'Campo obbligatorio'; scopErr.style.display = 'block'; }
                scopInput.style.borderColor = '#d32f2f'; scopInput.style.backgroundColor = '#ffebee';
            } else if (!isNaN(num) && scopMin !== null && scopMin !== undefined && num < scopMin) {
                scopInput.classList.add('invalid');
                try { scopInput.setCustomValidity(`Valore SCOP minimo richiesto: ${scopMin}`); } catch (e) {}
                if (scopErr) { scopErr.textContent = `Valore SCOP minimo richiesto: ${scopMin}`; scopErr.style.display = 'block'; }
                scopInput.style.borderColor = '#d32f2f'; scopInput.style.backgroundColor = '#ffebee';
            } else {
                scopInput.classList.remove('invalid');
                try { scopInput.setCustomValidity(''); } catch (e) {}
                if (scopErr) { scopErr.textContent = ''; scopErr.style.display = 'none'; }
                // remove inline visual emphasis
                scopInput.style.borderColor = '';
                scopInput.style.backgroundColor = '';
            }
            // COP validation (when present and applicable)
            try {
                if (copInput) {
                    const rawCop = String(copInput.value || '').replace(',', '.').trim();
                    const numCop = rawCop === '' ? NaN : parseFloat(rawCop);
                    if ((rawCop === '' || rawCop === null) && copInput.required && !copInput.disabled) {
                        copInput.classList.add('invalid');
                        try { copInput.setCustomValidity('Campo obbligatorio'); } catch (e) {}
                        if (copErr) { copErr.textContent = 'Campo obbligatorio'; copErr.style.display = 'block'; }
                        copInput.style.borderColor = '#d32f2f'; copInput.style.backgroundColor = '#ffebee';
                    } else if (!isNaN(numCop) && copMin !== null && copMin !== undefined && numCop < copMin) {
                        copInput.classList.add('invalid');
                        try { copInput.setCustomValidity(`Valore COP minimo richiesto: ${copMin}`); } catch (e) {}
                        if (copErr) { copErr.textContent = `Valore COP minimo richiesto: ${copMin}`; copErr.style.display = 'block'; }
                        copInput.style.borderColor = '#d32f2f'; copInput.style.backgroundColor = '#ffebee';
                    } else {
                        copInput.classList.remove('invalid');
                        try { copInput.setCustomValidity(''); } catch (e) {}
                        if (copErr) { copErr.textContent = ''; copErr.style.display = 'none'; }
                        copInput.style.borderColor = '';
                        copInput.style.backgroundColor = '';
                    }
                }
            } catch (e) { console.warn('COP validation error', e); }
        } catch (e) { console.warn('applyScopMinConstraintForRow error', e); }
    }

    // Shared helper: apply Efficienza stagionale (ηs) minimum constraint for a given table row.
    // Ensures no maximum is enforced and displays an inline error when the provided
    // seasonal efficiency is below the normative minimum (eta_s_min) from data.js.
    function applyEffStagMinConstraintForRow(tr) {
        try {
            if (!tr) return;
            const effInput = tr.querySelector('[data-column-id="eff_stagionale"]');
            if (!effInput) return;
            // If eff_stagionale is disabled for this row (fixed double duct), clear any errors and skip
            try {
                if (effInput.disabled) {
                    effInput.classList.remove('invalid');
                    try { effInput.setCustomValidity(''); } catch (e) {}
                    const effErr = effInput.parentNode ? effInput.parentNode.querySelector('.field-error') : null;
                    if (effErr) { effErr.textContent = ''; effErr.style.display = 'none'; }
                    effInput.style.borderColor = '';
                    effInput.style.backgroundColor = '';
                    return;
                }
            } catch (e) { /* ignore */ }
            const tipoEl = tr.querySelector('[data-column-id="tipo_pompa"]');
            const gwpEl = tr.querySelector('[data-column-id="gwp"]');
            const potEl = tr.querySelector('[data-column-id="potenza_nominale"]');
            const alimentazioneEl = tr.querySelector('[data-column-id="alimentazione"]');
            const gwpVal = gwpEl ? (gwpEl.value || '') : null;
            const tipoVal = String(tipoEl ? (tipoEl.value || '') : '').trim();
            const alimentazioneVal = alimentazioneEl ? (alimentazioneEl.value || 'Elettrica') : 'Elettrica';
            const potValRaw = potEl ? String(potEl.value || '').replace(',', '.').trim() : '';
            const potVal = potValRaw === '' ? undefined : (isNaN(Number(potValRaw)) ? undefined : Number(potValRaw));

            // attempt to reuse efficiency helper from data.js (pass nominal power for strong matching)
            let mapped = null;
            try {
                const spec = typeof getPumpEfficiencyMin === 'function' ? getPumpEfficiencyMin(tipoVal, gwpVal, alimentazioneVal, potVal) : null;
                if (spec && typeof spec.eta_s_min !== 'undefined') mapped = spec.eta_s_min;
            } catch (e) {
                console.warn('getPumpEfficiencyMin not available', e);
            }

            // We explicitly DO NOT set a max attribute for eff_stagionale (user requested)
            try { effInput.removeAttribute('max'); } catch (e) {}
            try { effInput.setAttribute('step', '1'); } catch (e) {}

            const effErr = effInput.parentNode ? effInput.parentNode.querySelector('.field-error') : null;
            const raw = String(effInput.value || '').replace(',', '.').trim();
            const num = raw === '' ? NaN : Number(raw);

            if (!isNaN(num) && mapped !== null && mapped !== undefined && num < mapped) {
                effInput.classList.add('invalid');
                try { effInput.setCustomValidity(`Valore minimo richiesto: ${mapped}`); } catch (e) {}
                if (effErr) { effErr.textContent = `Valore minimo richiesto: ${mapped}`; effErr.style.display = 'block'; }
            } else {
                effInput.classList.remove('invalid');
                try { effInput.setCustomValidity(''); } catch (e) {}
                if (effErr) { effErr.textContent = ''; effErr.style.display = 'none'; }
            }
        } catch (e) { console.warn('applyEffStagMinConstraintForRow error', e); }
    }

    // --- INIZIALIZZAZIONE ---

    function initialize() {
        populateSubjectTypes();
        populateBuildingCategories();
        addEventListeners();
    }

    function populateSubjectTypes() {
        subjectTypeSelect.innerHTML = '<option value="" disabled selected>Seleziona il soggetto ammesso...</option>';
        
        calculatorData.subjectTypes.forEach(subject => {
            // Nascondi la voce ETS economico dall'elenco dei soggetti (richiesta)
            if (subject.id === 'ets_economic') return;
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            option.title = subject.description;
            subjectTypeSelect.appendChild(option);
        });
    }

    function populateBuildingCategories() {
        // Inizializza con un'opzione vuota, il popolamento vero avviene in updateBuildingCategoryOptions
        buildingCategorySelect.innerHTML = '<option value="" disabled selected>Seleziona prima il soggetto...</option>';
    }

    // La selezione della modalità è stata rimossa dall'interfaccia; le modalità
    // restano nei dati ma non vengono mostrate all'utente.

    function updateOperatorType() {
        // Calcola l'operatorType interno dalla matrice
        if (!state.selectedSubject || !state.selectedBuilding) {
            state.selectedOperator = '';
            state.buildingSubcategory = '';
            return;
        }

        // Memorizza la sottocategoria se è una sottocategoria terziario
    if (['tertiary_generic', 'tertiary_school', 'tertiary_hospital'].includes(state.selectedBuilding)) {
            state.buildingSubcategory = state.selectedBuilding;
        } else {
            state.buildingSubcategory = '';
        }

        // Prova prima con la sottocategoria
        let matrixKey = `${state.selectedSubject}_${state.selectedBuilding}`;
        let mapping = calculatorData.operatorMatrix[matrixKey];
        
        // Se non trovato e è una sottocategoria, prova con la categoria principale
        if (!mapping && state.buildingSubcategory) {
            matrixKey = `${state.selectedSubject}_tertiary`;
            mapping = calculatorData.operatorMatrix[matrixKey];
        }
        
        if (mapping) {
            state.selectedOperator = mapping.operatorTypeId;
            console.log(`✅ Mappatura: ${matrixKey} → ${state.selectedOperator}` + 
                       (state.buildingSubcategory ? ` (sottocategoria: ${state.buildingSubcategory})` : ''));
        } else {
            state.selectedOperator = '';
            state.buildingSubcategory = '';
            console.warn(`⚠️  Nessuna mappatura trovata per: ${matrixKey}`);
        }
    }

    // updateImplementationModeOptions() rimosso per via dell'eliminazione della UI

    // Funzione per aggiungere una riga alla tabella dinamica
    function addTableRow(interventionId, inputId, columns, tbody) {
        const rowIndex = tbody.children.length;
        const tr = document.createElement('tr');
        tr.dataset.rowIndex = rowIndex;
        
        // Inizializza oggetto riga se non esiste
        if (!state.inputValues[interventionId][inputId]) {
            state.inputValues[interventionId][inputId] = [];
        }
        if (!state.inputValues[interventionId][inputId][rowIndex]) {
            state.inputValues[interventionId][inputId][rowIndex] = {};
        }
        
        columns.forEach((col, colIndex) => {
            const td = document.createElement('td');
            td.style.border = '1px solid #ddd';
            td.style.padding = '8px';
            
            let cellInput;
            
            if (col.type === 'select') {
                cellInput = document.createElement('select');
                cellInput.style.width = '100%';
                col.options.forEach(opt => {
                    const option = document.createElement('option');
                    if (typeof opt === 'string') {
                        option.value = opt;
                        option.textContent = opt;
                    } else {
                        option.value = opt.value;
                        option.textContent = opt.label || opt.value;
                        if (opt.cmax) {
                            option.dataset.cmax = opt.cmax;
                        }
                    }
                    cellInput.appendChild(option);
                });
            } else if (col.type === 'computed') {
                cellInput = document.createElement('input');
                cellInput.type = 'text';
                cellInput.readOnly = true;
                cellInput.style.width = '100%';
                cellInput.style.backgroundColor = '#f0f0f0';
                cellInput.style.cursor = 'not-allowed';
            } else {
                cellInput = document.createElement('input');
                cellInput.type = col.type;
                cellInput.style.width = '100%';
                if (col.min !== undefined) cellInput.min = col.min;
                if (col.max !== undefined) cellInput.max = col.max;
                if (col.step !== undefined) cellInput.step = col.step;
            }
            
            cellInput.dataset.intervention = interventionId;
            cellInput.dataset.inputId = inputId;
            cellInput.dataset.rowIndex = rowIndex;
            cellInput.dataset.columnId = col.id;
            
            // Ripristina valore esistente
            const savedValue = state.inputValues[interventionId][inputId][rowIndex]?.[col.id];
            if (savedValue !== undefined && savedValue !== null) {
                cellInput.value = savedValue;
            } else if (col.type === 'computed' && col.compute) {
                const rowData = state.inputValues[interventionId][inputId][rowIndex] || {};
                cellInput.value = col.compute(rowData);
            } else if (col.type === 'select') {
                // Imposta il valore di default (prima opzione) appena la riga viene creata
                const defaultValue = cellInput.options?.[0]?.value ?? '';
                cellInput.value = defaultValue;
                state.inputValues[interventionId][inputId][rowIndex][col.id] = defaultValue;

                // If this is the tipo_pompa select, store the full original options list
                // so we can rebuild it later when alimentazione changes.
                if (col.id === 'tipo_pompa') {
                    try {
                        const all = Array.from(cellInput.options).map(o => ({ value: o.value, label: o.textContent }));
                        cellInput.dataset.allOptions = JSON.stringify(all);
                        // If a helper exists in data.js, filter options according to alimentazione
                        const alimentazioneElTmp = tr.querySelector('[data-column-id="alimentazione"]');
                        const alimentazioneValTmp = alimentazioneElTmp ? (alimentazioneElTmp.value || 'Elettrica') : 'Elettrica';
                        if (typeof getPumpTypesForAlimentazione === 'function') {
                            const allowed = getPumpTypesForAlimentazione(alimentazioneValTmp) || null;
                            if (Array.isArray(allowed)) {
                                Array.from(cellInput.options).forEach(opt => {
                                    if (!allowed.includes(opt.value)) {
                                        try { opt.remove(); } catch (e) { /* ignore */ }
                                    }
                                });
                                // ensure selected value is allowed
                                if (![...cellInput.options].some(o => o.value === cellInput.value)) {
                                    const newVal = cellInput.options?.[0]?.value || '';
                                    cellInput.value = newVal;
                                    state.inputValues[interventionId][inputId][rowIndex][col.id] = newVal;
                                }
                            }
                        }
                    } catch (e) { /* ignore */ }
                }

                // If this is the alimentazione select, attach a listener to update tipo_pompa options
                if (col.id === 'alimentazione') {
                    cellInput.addEventListener('change', (e) => {
                        try {
                            const trRow = tr;
                            const tipoSel = trRow ? trRow.querySelector('[data-column-id="tipo_pompa"]') : null;
                            if (!tipoSel) return;
                            const allOpts = tipoSel.dataset && tipoSel.dataset.allOptions ? JSON.parse(tipoSel.dataset.allOptions || '[]') : null;
                            const allowed = typeof getPumpTypesForAlimentazione === 'function' ? getPumpTypesForAlimentazione(e.target.value || 'Elettrica') : null;
                            // Rebuild options from allOpts filtered by allowed (if provided)
                            if (Array.isArray(allOpts)) {
                                tipoSel.innerHTML = '';
                                const toAdd = allOpts.filter(o => !Array.isArray(allowed) || allowed.includes(o.value));
                                toAdd.forEach(o => {
                                    const op = document.createElement('option');
                                    op.value = o.value; op.textContent = o.label;
                                    tipoSel.appendChild(op);
                                });
                                // Insert a disabled placeholder and require explicit selection
                                const placeholder = document.createElement('option');
                                placeholder.value = '';
                                placeholder.textContent = '— Seleziona tipo pompa —';
                                placeholder.disabled = true;
                                // Insert placeholder as first option and leave unselected
                                tipoSel.insertBefore(placeholder, tipoSel.firstChild);
                                tipoSel.value = '';

                                // Clear all other inputs in the same row (keep alimentazione untouched
                                // and leave tipo_pompa unselected). Update state accordingly.
                                const r = parseInt(trRow.dataset.rowIndex || '0');
                                try {
                                    const inputs = Array.from(trRow.querySelectorAll('input, select'));
                                    inputs.forEach(el => {
                                        const colId = el.dataset ? el.dataset.columnId : null;
                                        if (!colId) return;
                                        // keep alimentazione value, and keep tipo_pompa as unselected
                                        if (colId === 'alimentazione' || colId === 'tipo_pompa') return;
                                        try { el.value = ''; } catch (e) {}
                                        if (state.inputValues && state.inputValues[interventionId] && state.inputValues[interventionId][inputId] && state.inputValues[interventionId][inputId][r]) {
                                            state.inputValues[interventionId][inputId][r][colId] = '';
                                        }
                                    });
                                } catch (e) { /* ignore clearing errors */ }

                                // Do NOT write tipo_pompa into state yet; require user selection.
                                if (state.inputValues && state.inputValues[interventionId] && state.inputValues[interventionId][inputId] && state.inputValues[interventionId][inputId][r]) {
                                    delete state.inputValues[interventionId][inputId][r]['tipo_pompa'];
                                }

                                // Add a listener so when the user selects a tipo_pompa we clear
                                // other fields (except alimentazione) and refresh validations.
                                tipoSel.addEventListener('change', (ev) => {
                                    try {
                                        const rr = parseInt(trRow.dataset.rowIndex || '0');
                                        const els = Array.from(trRow.querySelectorAll('input, select'));
                                        els.forEach(el => {
                                            const cid = el.dataset ? el.dataset.columnId : null;
                                            if (!cid) return;
                                            if (cid === 'alimentazione' || cid === 'tipo_pompa') return;
                                            try { el.value = ''; } catch (e) {}
                                            if (state.inputValues && state.inputValues[interventionId] && state.inputValues[interventionId][inputId] && state.inputValues[interventionId][inputId][rr]) {
                                                state.inputValues[interventionId][inputId][rr][cid] = '';
                                            }
                                        });
                                        // Store the selected tipo_pompa now that user chose it
                                        const selected = String(ev.target.value || '');
                                        if (state.inputValues && state.inputValues[interventionId] && state.inputValues[interventionId][inputId] && state.inputValues[interventionId][inputId][rr]) {
                                            state.inputValues[interventionId][inputId][rr]['tipo_pompa'] = selected;
                                        }
                                        // recompute computed fields and re-run validations
                                        updateTableRowComputed(interventionId, inputId, rr, columns, trRow);
                                        applyScopMinConstraintForRow(trRow);
                                        applyEffStagMinConstraintForRow(trRow);
                                        try { validateRequiredFields(); } catch (e) {}
                                    } catch (e) { /* ignore */ }
                                });

                                // re-run per-row toggles and constraints so UI reflects cleared state
                                applyScopMinConstraintForRow(trRow);
                                applyEffStagMinConstraintForRow(trRow);
                                try { validateRequiredFields(); } catch (e) {}
                            }
                        } catch (e) { console.warn('alimentazione change handler error', e); }
                    });
                }
            }
            
            // Event listener per aggiornare lo stato e i campi computed
            if (col.type !== 'computed') {
                cellInput.addEventListener('change', (e) => {
                    const row = parseInt(e.target.dataset.rowIndex);
                    const colId = e.target.dataset.columnId;

                    // Convert number inputs: preserve empty string as '' so validation
                    // can detect missing values instead of coercing them to 0.
                    let value = e.target.value;
                    if (e.target.type === 'number') {
                        const raw = String(e.target.value || '');
                        if (raw.trim() === '') {
                            value = '';
                        } else {
                            const parsed = parseFloat(raw.replace(',', '.'));
                            value = isNaN(parsed) ? raw : parsed;
                        }
                    }

                    state.inputValues[interventionId][inputId][row][colId] = value;

                    // Aggiorna campi computed nella stessa riga
                    updateTableRowComputed(interventionId, inputId, row, columns, tr);

                    // Trigger recalcolo generale
                    handleInputChange(e);
                });

                cellInput.addEventListener('keyup', (e) => {
                    const row = parseInt(e.target.dataset.rowIndex);
                    const colId = e.target.dataset.columnId;

                    // Convert number inputs but preserve empty
                    let value = e.target.value;
                    if (e.target.type === 'number') {
                        const raw = String(e.target.value || '');
                        if (raw.trim() === '') {
                            value = '';
                        } else {
                            const parsed = parseFloat(raw.replace(',', '.'));
                            value = isNaN(parsed) ? raw : parsed;
                        }
                    }

                    state.inputValues[interventionId][inputId][row][colId] = value;

                    // Aggiorna campi computed nella stessa riga
                    updateTableRowComputed(interventionId, inputId, row, columns, tr);
                });
            }
            
            td.appendChild(cellInput);
                // style hook for disabled inputs (keeps column visible but visibly disabled)
                cellInput.classList.add('table-cell-input');
                // If this column is the seasonal SCOP, add inline error placeholder and attach validation
            if (col.id === 'scop') {
                const scopErr = document.createElement('small');
                scopErr.className = 'field-error';
                scopErr.id = `error-${interventionId}-${inputId}-${rowIndex}-${col.id}`;
                scopErr.style.color = '#d32f2f';
                scopErr.style.display = 'none';
                scopErr.style.marginTop = '4px';
                td.appendChild(scopErr);

                // Helper to apply mapped minimum based on tipo_pompa in the same row
                function applyScopMinConstraint() {
                    try {
                        // delegate to shared helper with explicit row element
                        const trEl = td.parentNode;
                        applyScopMinConstraintForRow(trEl);
                    } catch (e) { console.warn('applyScopMinConstraint error', e); }
                }

                // Attach listeners: when SCOP changes, or tipo_pompa changes in same row
                cellInput.addEventListener('input', () => applyScopMinConstraintForRow(tr));
                // Also observe changes to tipo_pompa select in this row
                // Execute synchronously to avoid race conditions where validation
                // runs before the per-row fields are toggled.
                function initTipoGwpCopToggle() {
                    const trEl = td.parentNode;
                    if (!trEl) return;
                    const tipoEl = trEl.querySelector('[data-column-id="tipo_pompa"]');
                    const gwpEl = trEl.querySelector('[data-column-id="gwp"]');
                    const copEl = trEl.querySelector('[data-column-id="cop"]');
                    const scopEl = trEl.querySelector('[data-column-id="scop"]');
                    const effEl = trEl.querySelector('[data-column-id="eff_stagionale"]');

                    // If some dependent cells are not yet present (created later in the loop),
                    // retry shortly. This ensures toggling finds the elements and applies
                    // the disabled/invalid cleanup correctly.
                    if (!tipoEl || !gwpEl || !copEl || !scopEl) {
                        setTimeout(initTipoGwpCopToggle, 10);
                        return;
                    }

                    function toggleFieldsByTipo() {
                        const tipoVal = tipoEl ? String(tipoEl.value || '') : '';
                        const lower = tipoVal.toLowerCase();
                        const alimentazioneElRow = trEl.querySelector('[data-column-id="alimentazione"]');
                        const alimentazioneValRow = alimentazioneElRow ? String(alimentazioneElRow.value || '').toLowerCase() : 'elettrica';
                        // show gwp/ cop flags via shared helper to centralize logic
                        let needsGwp = false; let needsCop = false;
                        try {
                            const utils = (typeof window !== 'undefined' && window.pumpUtils) ? window.pumpUtils : (typeof require === 'function' ? require('./tools/pump-utils.js') : null);
                            if (utils && typeof utils.detectPumpFlags === 'function') {
                                const flags = utils.detectPumpFlags(tipoVal);
                                needsGwp = !!flags.needsGwp;
                                needsCop = !!flags.needsCop;
                            } else {
                                needsGwp = lower.includes('split') || lower.includes('multisplit') || (lower.includes('salamoia') && lower.includes('aria')) || (lower.includes('fixed') && lower.includes('double'));
                                needsCop = lower.includes('fixed') && lower.includes('double');
                            }
                        } catch (e) {
                            needsGwp = lower.includes('split') || lower.includes('multisplit') || (lower.includes('salamoia') && lower.includes('aria')) || (lower.includes('fixed') && lower.includes('double'));
                            needsCop = lower.includes('fixed') && lower.includes('double');
                        }
                        if (gwpEl) {
                            if (needsGwp) {
                                gwpEl.disabled = false;
                                gwpEl.removeAttribute('aria-hidden');
                                gwpEl.required = true;
                                gwpEl.classList.remove('disabled-input');
                            } else {
                                gwpEl.disabled = true;
                                gwpEl.setAttribute('aria-hidden', 'true');
                                gwpEl.required = false;
                                gwpEl.classList.add('disabled-input');
                                // clear any inline errors if disabling
                                gwpEl.classList.remove('invalid');
                                try { gwpEl.setCustomValidity(''); } catch (e) {}
                                try { gwpEl.value = ''; } catch (e) {}
                                try { gwpEl.style.borderColor = ''; gwpEl.style.backgroundColor = ''; } catch (e) {}
                                try {
                                    const errId = `error-${interventionId}-${inputId}-${trEl.dataset.rowIndex}-gwp`;
                                    const errEl = trEl ? trEl.querySelector(`#${errId}`) : null;
                                    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
                                } catch (e) {}
                            }
                        }

                        // needsCop already determined above
                        // If alimentation is GAS, require SCOP/SPER and seasonal efficiency and disable COP/GWP
                        if (alimentazioneValRow === 'gas') {
                            if (copEl) {
                                copEl.disabled = true;
                                copEl.setAttribute('aria-hidden', 'true');
                                copEl.required = false;
                                copEl.classList.add('disabled-input');
                                copEl.classList.remove('invalid');
                                try { copEl.setCustomValidity(''); } catch (e) {}
                                try { copEl.value = ''; } catch (e) {}
                            }
                            if (scopEl) {
                                scopEl.disabled = false;
                                scopEl.removeAttribute('aria-hidden');
                                scopEl.required = true;
                                scopEl.classList.remove('disabled-input');
                            }
                            if (effEl) {
                                effEl.disabled = false;
                                effEl.removeAttribute('aria-hidden');
                                effEl.required = true;
                                effEl.classList.remove('disabled-input');
                            }
                            if (gwpEl) {
                                gwpEl.disabled = true;
                                gwpEl.setAttribute('aria-hidden', 'true');
                                gwpEl.required = false;
                                gwpEl.classList.add('disabled-input');
                                gwpEl.classList.remove('invalid');
                                try { gwpEl.setCustomValidity(''); } catch (e) {}
                                try { gwpEl.value = ''; } catch (e) {}
                                try { gwpEl.style.borderColor = ''; gwpEl.style.backgroundColor = ''; } catch (e) {}
                                try {
                                    const errId = `error-${interventionId}-${inputId}-${trEl.dataset.rowIndex}-gwp`;
                                    const errEl = trEl ? trEl.querySelector(`#${errId}`) : null;
                                    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
                                } catch (e) {}
                            }
                        } else {
                            if (copEl) {
                                if (needsCop) {
                                    copEl.disabled = false;
                                    copEl.removeAttribute('aria-hidden');
                                    copEl.required = true;
                                    copEl.classList.remove('disabled-input');
                                } else {
                                    copEl.disabled = true;
                                    copEl.setAttribute('aria-hidden', 'true');
                                    copEl.required = false;
                                    copEl.classList.add('disabled-input');
                                    copEl.classList.remove('invalid');
                                    try { copEl.setCustomValidity(''); } catch (e) {}
                                    try { copEl.value = ''; } catch (e) {}
                                    try { copEl.style.borderColor = ''; copEl.style.backgroundColor = ''; } catch (e) {}
                                    try {
                                        const errId = `error-${interventionId}-${inputId}-${trEl.dataset.rowIndex}-cop`;
                                        const errEl = trEl ? trEl.querySelector(`#${errId}`) : null;
                                        if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
                                    } catch (e) {}
                                }
                            }

                            // SCOP: disable for fixed double duct (COP used instead), require for others
                            if (scopEl) {
                                if (needsCop) {
                                    scopEl.disabled = true;
                                    scopEl.setAttribute('aria-hidden', 'true');
                                    scopEl.required = false;
                                    scopEl.classList.add('disabled-input');
                                    try { scopEl.setCustomValidity(''); } catch (e) {}
                                    scopEl.classList.remove('invalid');
                                    try { scopEl.style.borderColor = ''; scopEl.style.backgroundColor = ''; } catch (e) {}
                                    try {
                                        const errId = `error-${interventionId}-${inputId}-${trEl.dataset.rowIndex}-scop`;
                                        const errEl = trEl ? trEl.querySelector(`#${errId}`) : null;
                                        if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
                                    } catch (e) {}
                                } else {
                                    scopEl.disabled = false;
                                    scopEl.removeAttribute('aria-hidden');
                                    scopEl.required = true;
                                    scopEl.classList.remove('disabled-input');
                                }
                            }

                            // Efficienza stagionale: disable for fixed double duct (COP used instead), require for others
                            if (effEl) {
                                if (needsCop) {
                                    effEl.disabled = true;
                                    effEl.setAttribute('aria-hidden', 'true');
                                    effEl.required = false;
                                    effEl.classList.add('disabled-input');
                                    // clear any inline invalid styling when disabling
                                    effEl.classList.remove('invalid');
                                    try { effEl.setCustomValidity(''); } catch (e) {}
                                    try { effEl.value = ''; } catch (e) {}
                                    try { effEl.style.borderColor = ''; effEl.style.backgroundColor = ''; } catch (e) {}
                                    try {
                                        const errId = `error-${interventionId}-${inputId}-${trEl.dataset.rowIndex}-eff_stagionale`;
                                        const errEl = trEl ? trEl.querySelector(`#${errId}`) : null;
                                        if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
                                    } catch (e) {}
                                } else {
                                    effEl.disabled = false;
                                    effEl.removeAttribute('aria-hidden');
                                    effEl.required = true;
                                    effEl.classList.remove('disabled-input');
                                }
                            }
                        }

                        // After toggling fields, re-run scop/eff constraints to pick correct minima if gwp changed
                        applyScopMinConstraintForRow(trEl);
                        applyEffStagMinConstraintForRow(trEl);
                    }

                    if (tipoEl) {
                        tipoEl.addEventListener('change', toggleFieldsByTipo);
                    }
                    if (gwpEl) {
                        gwpEl.addEventListener('change', () => { applyScopMinConstraintForRow(trEl); applyEffStagMinConstraintForRow(trEl); });
                    }

                    // Run initial constraint application synchronously
                    applyScopMinConstraintForRow(trEl);
                    applyEffStagMinConstraintForRow(trEl);
                    toggleFieldsByTipo();
                }

                // Start the initializer (it will retry shortly if cells are not yet created)
                initTipoGwpCopToggle();
            }
            // If this column is COP (used for fixed double duct), add inline error placeholder and attach validation
            if (col.id === 'cop') {
                const copErr = document.createElement('small');
                copErr.className = 'field-error';
                copErr.id = `error-${interventionId}-${inputId}-${rowIndex}-${col.id}`;
                copErr.style.color = '#d32f2f';
                copErr.style.display = 'none';
                copErr.style.marginTop = '4px';
                td.appendChild(copErr);

                // Attach listener to validate COP when user types
                cellInput.addEventListener('input', () => applyScopMinConstraintForRow(tr));
            }
            // If this column is the seasonal efficiency (eff_stagionale), add inline error placeholder and attach validation
            if (col.id === 'eff_stagionale') {
                const effErr = document.createElement('small');
                effErr.className = 'field-error';
                effErr.id = `error-${interventionId}-${inputId}-${rowIndex}-${col.id}`;
                effErr.style.color = '#d32f2f';
                effErr.style.display = 'none';
                effErr.style.marginTop = '4px';
                td.appendChild(effErr);

                // Attach listener to validate against normative minima when user types
                // Defensive: remove any max attribute that may have been added elsewhere
                try { cellInput.removeAttribute('max'); } catch (e) {}
                cellInput.addEventListener('input', () => applyEffStagMinConstraintForRow(tr));
            }
            // Se la colonna è potenza nominale, aggiungi un placeholder per messaggi di errore inline
            if (col.id === 'potenza_nominale') {
                const rowErr = document.createElement('small');
                rowErr.className = 'field-error';
                rowErr.id = `error-${interventionId}-${inputId}-${rowIndex || 'new'}-${col.id}`;
                rowErr.style.color = '#d32f2f';
                rowErr.style.display = 'none';
                rowErr.style.marginTop = '4px';
                td.appendChild(rowErr);
            }
            tr.appendChild(td);
        });
        
        // Colonna azioni (elimina)
        const tdActions = document.createElement('td');
        tdActions.style.border = '1px solid #ddd';
        tdActions.style.padding = '8px';
        tdActions.style.textAlign = 'center';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = 'Elimina riga';
        deleteBtn.style.padding = '4px 8px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.addEventListener('click', () => {
            // Rimuovi la riga dal DOM
            tr.remove();
            
            // Rimuovi la riga dall'array state
            const rowIdx = parseInt(tr.dataset.rowIndex);
            state.inputValues[interventionId][inputId].splice(rowIdx, 1);
            
            // Ri-indicizza le righe rimanenti
            Array.from(tbody.children).forEach((row, newIndex) => {
                row.dataset.rowIndex = newIndex;
                row.querySelectorAll('input, select').forEach(input => {
                    input.dataset.rowIndex = newIndex;
                });
            });
            
            // Trigger recalcolo
            handleInputChange();
        });
        
        tdActions.appendChild(deleteBtn);
        tr.appendChild(tdActions);
        
        tbody.appendChild(tr);

        // Ensure initial per-row state for pompe di calore fields so newly added
        // rows don't appear invalid before the toggle runs.
        try {
            const tipoElInit = tr.querySelector('[data-column-id="tipo_pompa"]');
            const copElInit = tr.querySelector('[data-column-id="cop"]');
            const scopElInit = tr.querySelector('[data-column-id="scop"]');
            const gwpElInit = tr.querySelector('[data-column-id="gwp"]');
            const tipoValInit = tipoElInit ? String(tipoElInit.value || '').toLowerCase() : '';
            let needsCopInit = false; let needsGwpInit = false;
            try {
                const utilsInit = (typeof window !== 'undefined' && window.pumpUtils) ? window.pumpUtils : (typeof require === 'function' ? require('./tools/pump-utils.js') : null);
                if (utilsInit && typeof utilsInit.detectPumpFlags === 'function') {
                    const flagsInit = utilsInit.detectPumpFlags(tipoValInit);
                    needsCopInit = !!flagsInit.needsCop;
                    needsGwpInit = !!flagsInit.needsGwp;
                } else {
                    needsCopInit = tipoValInit.includes('fixed') && tipoValInit.includes('double');
                    needsGwpInit = tipoValInit.includes('split') || tipoValInit.includes('multisplit') || (tipoValInit.includes('salamoia') && tipoValInit.includes('aria')) || (tipoValInit.includes('fixed') && tipoValInit.includes('double'));
                }
            } catch (e) {
                needsCopInit = tipoValInit.includes('fixed') && tipoValInit.includes('double');
                needsGwpInit = tipoValInit.includes('split') || tipoValInit.includes('multisplit') || (tipoValInit.includes('salamoia') && tipoValInit.includes('aria')) || (tipoValInit.includes('fixed') && tipoValInit.includes('double'));
            }

            if (copElInit) {
                if (!needsCopInit) {
                    copElInit.disabled = true;
                    copElInit.setAttribute('aria-hidden', 'true');
                    copElInit.required = false;
                    copElInit.classList.add('disabled-input');
                    copElInit.classList.remove('invalid');
                    try { copElInit.setCustomValidity(''); } catch (e) {}
                    try { copElInit.value = ''; } catch (e) {}
                } else {
                    copElInit.disabled = false;
                    copElInit.removeAttribute('aria-hidden');
                    copElInit.required = true;
                    copElInit.classList.remove('disabled-input');
                }
            }

            if (scopElInit) {
                if (needsCopInit) {
                    scopElInit.disabled = true;
                    scopElInit.setAttribute('aria-hidden', 'true');
                    scopElInit.required = false;
                    scopElInit.classList.add('disabled-input');
                    scopElInit.classList.remove('invalid');
                    try { scopElInit.setCustomValidity(''); } catch (e) {}
                    try { scopElInit.value = ''; } catch (e) {}
                } else {
                    scopElInit.disabled = false;
                    scopElInit.removeAttribute('aria-hidden');
                    scopElInit.required = true;
                    scopElInit.classList.remove('disabled-input');
                }
            }

            if (gwpElInit) {
                if (!needsGwpInit) {
                    gwpElInit.disabled = true;
                    gwpElInit.setAttribute('aria-hidden', 'true');
                    gwpElInit.required = false;
                    gwpElInit.classList.add('disabled-input');
                    gwpElInit.classList.remove('invalid');
                    try { gwpElInit.setCustomValidity(''); } catch (e) {}
                    try { gwpElInit.value = ''; } catch (e) {}
                } else {
                    gwpElInit.disabled = false;
                    gwpElInit.removeAttribute('aria-hidden');
                    gwpElInit.required = true;
                    gwpElInit.classList.remove('disabled-input');
                }
            }
        } catch (e) { /* ignore init errors */ }

        // Applica validazione specifica per righe pompe di calore (se applicabile)
        attachPompaRowValidation(interventionId, inputId, rowIndex, tr);

        // Aggiorna computed fields della riga appena aggiunta
        updateTableRowComputed(interventionId, inputId, rowIndex, columns, tr);
    }

    // Funzione per aggiornare i campi computed di una riga
    function updateTableRowComputed(interventionId, inputId, rowIndex, columns, tr) {
        const rowData = state.inputValues[interventionId][inputId][rowIndex] || {};
        
        console.log('updateTableRowComputed called:', { interventionId, inputId, rowIndex, rowData });
        
        columns.forEach((col, colIndex) => {
            if (col.type === 'computed' && col.compute) {
                const computedValue = col.compute(rowData);
                console.log(`Computing ${col.id}:`, computedValue, 'from rowData:', rowData);
                const cellInput = tr.cells[colIndex].querySelector('input');
                if (cellInput) {
                    cellInput.value = computedValue;
                    // Aggiorna anche lo state
                    state.inputValues[interventionId][inputId][rowIndex][col.id] = computedValue;
                }
            }
        });
    }

    function renderInterventions() {
        interventionsList.innerHTML = '';
        state.selectedInterventions = [];
        state.inputValues = {};
        updateDynamicInputs();

        if (!state.selectedOperator) {
            interventionsList.innerHTML = '<p class="notice">Completa i passi 1 e 2 per visualizzare gli interventi disponibili.</p>';
            return;
        }

        // Determina gli interventi ammissibili dalla matrice
        const matrixKey = `${state.selectedSubject}_${state.selectedBuilding}`;
        const mapping = calculatorData.operatorMatrix[matrixKey];
        
        if (!mapping) {
            interventionsList.innerHTML = '<p class="notice">⚠️ Combinazione non valida. Verifica i dati inseriti.</p>';
            return;
        }

        // Note: regulatory warning removed per user request (no informational box shown)

        // Filtra interventi in base alle regole della matrice
        const filteredEntries = Object.entries(calculatorData.interventions).filter(([_, data]) => {
            // Verifica allowedOperators standard
            if (data.allowedOperators && data.allowedOperators.length > 0) {
                if (!data.allowedOperators.includes(state.selectedOperator)) {
                    return false;
                }
            }
            
            // Applica regole della matrice (Titolo II vs Titolo III)
            if (mapping.allowedInterventions === 'only_titolo3' && data.category === 'Efficienza Energetica') {
                return false; // Residenziale: solo Titolo III per privati
            }
            
            return true;
        });

        if (filteredEntries.length === 0) {
            interventionsList.innerHTML = '<p class="notice">Nessun intervento disponibile per questa combinazione.</p>';
            return;
        }

        const categories = {};
        filteredEntries.forEach(([id, data]) => {
            const category = data.category || 'Generale';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push({ id, ...data });
        });

        // Crea sezioni per ogni categoria
        for (const categoryName in categories) {
            const categoryWrapper = document.createElement('div');
            categoryWrapper.className = 'category-wrapper';
            
            const categoryTitle = document.createElement('h3');
            categoryTitle.className = 'category-title';
            categoryTitle.textContent = categoryName;
            categoryWrapper.appendChild(categoryTitle);

            categories[categoryName].forEach(data => {
                const div = document.createElement('div');
                div.className = 'intervention';
                
                const tooltip = data.description ? `
                    <span class="tooltip-icon" data-tooltip="${data.description}">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" fill="none"/>
                            <text x="8" y="11" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor">?</text>
                        </svg>
                    </span>
                ` : '';
                
                div.innerHTML = `
                    <input type="checkbox" id="int-${data.id}" name="intervention" value="${data.id}">
                    <label for="int-${data.id}">
                        ${data.name}
                        ${tooltip}
                    </label>
                `;
                categoryWrapper.appendChild(div);
            });

            interventionsList.appendChild(categoryWrapper);
        }
    }

    // FUNZIONE DISABILITATA: La sezione premialità è stata nascosta
    // function populatePremiums() {
    //     // Mostra SOLO le premialità di tipo globale applicabili al contesto corrente
    //     premiumsList.innerHTML = '';
    //     
    //     let hasAnyPremium = false;
    //     for (const [id, data] of Object.entries(calculatorData.premiums)) {
    //         if (data.scope !== 'global') continue;
    //         if (id === 'multi-intervento') continue; // Multi-intervento non selezionabile
    //         // Verifica se la premialità è applicabile al contesto corrente
    //         const isApplicable = data.isApplicable(
    //             state.selectedInterventions, 
    //             state.inputValues, 
    //             state.selectedOperator
    //         );
    //         if (!isApplicable) continue;
    //         hasAnyPremium = true;
    //         const div = document.createElement('div');
    //         div.className = 'premium';
    //         
    //         // Stile speciale per premialità override-100
    //         if (data.type === 'override-100') {
    //             div.style.backgroundColor = '#e3f2fd';
    //             div.style.border = '2px solid #1976d2';
    //             div.style.padding = '12px';
    //             div.style.borderRadius = '8px';
    //         }
    //         
    //         let description = data.description ? `<small style="display: block; opacity: 0.8; margin-top: 4px;">${data.description}</small>` : '';
    //         
    //         // Badge per override-100
    //         const badge = data.type === 'override-100' ? '<span style="background: #1976d2; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; margin-left: 8px;">100% SPESA</span>' : '';
    //         
    //         div.innerHTML = `
    //             <input type="checkbox" id="prem-${id}" name="premium" value="${id}">
    //             <label for="prem-${id}">${data.name}${badge}${description}</label>
    //         `;
    //         premiumsList.appendChild(div);
    //     }
    //     
    //     if (!hasAnyPremium) {
    //         premiumsList.innerHTML = '<p class="notice">Nessuna premialità globale applicabile al contesto attuale.</p>';
    //     }
    // }

    // --- GESTIONE EVENTI ---

    function addEventListeners() {
        // Step 1: Selezione soggetto
        subjectTypeSelect.addEventListener('change', (e) => {
            state.selectedSubject = e.target.value;
            
            // Reset dati specifici del soggetto precedente
            state.subjectSpecificData = {};
            
            // Mostra step 2
            buildingCategoryGroup.style.display = 'block';
            
            // Filtra categorie immobile ammissibili per questo soggetto
            updateBuildingCategoryOptions();
            
            // Step 3 (modalità) rimosso dall'interfaccia; manteniamo solo i campi
            // specifici del soggetto
            
            // Mostra campi specifici del soggetto (es. popolazione comune per PA)
            renderSubjectSpecificFields();

            // Reset step successivi
            state.selectedBuilding = '';
            state.selectedOperator = '';
            buildingCategorySelect.value = '';
            // implementationModeGroup removed from UI
            renderInterventions();
            // populatePremiums(); // Rimosso: sezione premialità nascosta
        });

        // Step 2: Selezione categoria immobile
        buildingCategorySelect.addEventListener('change', (e) => {
            state.selectedBuilding = e.target.value;
            
            // Calcola operatorType dalla matrice
            updateOperatorType();
            
            // Step 3 (modalità) rimosso dall'interfaccia
            
            // Aggiorna interventi e premialità
            renderInterventions();
            // Rerender subject-specific fields because operator type may have changed
            renderSubjectSpecificFields();
            // populatePremiums(); // Rimosso: sezione premialità nascosta
        });

        // Step 3 removed from UI: no listener

        interventionsList.addEventListener('change', (e) => {
            if (e.target.name === 'intervention') {
                // Compute new selection
                const newSelected = Array.from(
                    interventionsList.querySelectorAll('input[name="intervention"]:checked')
                ).map(input => input.value);

                // Incompatibility rule: NZEB cannot be selected with any other intervention
                const nzebSelected = newSelected.includes('nzeb');
                const otherSelected = newSelected.filter(id => id !== 'nzeb');
                if (nzebSelected && otherSelected.length > 0) {
                    // Revert the change and show modal informing the user with action to resolve
                    restoreSelection(prevSelectedInterventions);
                    showIncompatibilityModal('Gli interventi NZEB sono incompatibili con qualsiasi altro intervento. Seleziona NZEB da solo oppure deseleziona NZEB per scegliere altri interventi.', { type: 'nzeb_conflict', desiredSelection: ['nzeb'] });
                    return;
                }

                // If user selected non-nzeb while nzeb was previously selected, prevent it and provide actions
                if (!nzebSelected && prevSelectedInterventions.includes('nzeb') && newSelected.length > 0) {
                    restoreSelection(prevSelectedInterventions);
                    showIncompatibilityModal('Gli interventi NZEB sono incompatibili con qualsiasi altro intervento. Deseleziona NZEB prima di aggiungere altri interventi.', { type: 'others_conflict', desiredSelection: otherSelected });
                    return;
                }

                // Accept new selection
                state.selectedInterventions = newSelected;
                prevSelectedInterventions = state.selectedInterventions.slice();

                // Update dynamic inputs and visual disabling of incompatible choices
                updateDynamicInputs();
                enforceNzebExclusivity();
            }
        });

        // Restore checkbox selection to a given array of ids
        function restoreSelection(ids) {
            const checkboxes = interventionsList.querySelectorAll('input[name="intervention"]');
            checkboxes.forEach(cb => {
                cb.checked = ids.includes(cb.value);
            });
        }

        // Enforce disabling rules in UI: if any non-nzeb is selected, disable nzeb; if nzeb is selected, disable others
        function enforceNzebExclusivity() {
            const allCheckboxes = Array.from(interventionsList.querySelectorAll('input[name="intervention"]'));
            const nzebCb = interventionsList.querySelector('input[value="nzeb"][name="intervention"]');
            const anyNonNzebSelected = state.selectedInterventions.some(id => id !== 'nzeb');
            const nzebIsSelected = state.selectedInterventions.includes('nzeb');

            allCheckboxes.forEach(cb => {
                if (!nzebCb) return;
                if (cb === nzebCb) {
                    // disable NZEB when any other selected (and not itself selected alone)
                    cb.disabled = anyNonNzebSelected && !nzebIsSelected;
                } else {
                    // disable other checkboxes when nzeb is selected
                    cb.disabled = nzebIsSelected;
                }
            });
        }

        // Show an informational modal for incompatibility
        function showIncompatibilityModal(message, options = {}) {
            // If a modal already exists, update text and return (but also update buttons)
            let modal = document.getElementById('incompat-modal');
            const type = options.type || null;
            const desired = Array.isArray(options.desiredSelection) ? options.desiredSelection.slice() : [];
            function buildButtons() {
                // Default close button
                let btns = `<button id="incompat-close" style="padding:8px 12px; margin-left:8px;">Chiudi</button>`;
                if (type === 'nzeb_conflict') {
                    btns = `<button id="incompat-select-nzeb" style="padding:8px 12px;">Deseleziona altri e seleziona NZEB</button>` + btns;
                } else if (type === 'others_conflict') {
                    btns = `<button id="incompat-select-others" style="padding:8px 12px;">Deseleziona NZEB e seleziona altri</button>` + btns;
                }
                return btns;
            }

            if (modal) {
                modal.querySelector('.modal-body').textContent = message;
                const controls = modal.querySelector('.modal-controls');
                if (controls) controls.innerHTML = buildButtons();
                modal.style.display = 'block';
            } else {
                modal = document.createElement('div');
                modal.id = 'incompat-modal';
                modal.style.position = 'fixed';
                modal.style.left = '0';
                modal.style.top = '0';
                modal.style.right = '0';
                modal.style.bottom = '0';
                modal.style.background = 'rgba(0,0,0,0.5)';
                modal.style.display = 'flex';
                modal.style.alignItems = 'center';
                modal.style.justifyContent = 'center';
                modal.style.zIndex = '9999';

                modal.innerHTML = `
                    <div style="background:white; padding:20px; border-radius:8px; max-width:560px; text-align:left; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
                        <h3 style="margin-top:0;">Selezione incompatibile</h3>
                        <div class="modal-body" style="margin-bottom:16px;">${message}</div>
                        <div class="modal-controls" style="text-align:right;">${buildButtons()}</div>
                    </div>
                `;
                document.body.appendChild(modal);
            }

            // Attach handlers for dynamic buttons
            const closeBtn = document.getElementById('incompat-close');
            if (closeBtn) closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });

            const selNzebBtn = document.getElementById('incompat-select-nzeb');
            if (selNzebBtn) selNzebBtn.addEventListener('click', () => {
                // Deselect all and select nzeb
                restoreSelection(['nzeb']);
                state.selectedInterventions = ['nzeb'];
                prevSelectedInterventions = ['nzeb'];
                enforceNzebExclusivity();
                updateDynamicInputs();
                modal.style.display = 'none';
            });

            const selOthersBtn = document.getElementById('incompat-select-others');
            if (selOthersBtn) selOthersBtn.addEventListener('click', () => {
                // Deselect nzeb and select desired others
                restoreSelection(desired);
                state.selectedInterventions = desired.slice();
                prevSelectedInterventions = desired.slice();
                enforceNzebExclusivity();
                updateDynamicInputs();
                modal.style.display = 'none';
            });
        }

        // DISABILITATO: Event listener per premiums (sezione nascosta)
        // premiumsList.addEventListener('change', (e) => {
        //     if (e.target.name === 'premium') {
        //         state.selectedPremiums = Array.from(
        //             premiumsList.querySelectorAll('input[name="premium"]:checked')
        //         ).map(input => input.value);
        //     }
        // });

        calculateButton.addEventListener('click', calculateIncentive);
        
        resetButton.addEventListener('click', () => {
            location.reload();
        });

        // Event listener per il pulsante stampa
        const printButton = document.getElementById('print-btn');
        if (printButton) {
            printButton.addEventListener('click', printReport);
        }
    }

    function updateBuildingCategoryOptions() {
        // Ripopola il select delle categorie in base al soggetto selezionato
        buildingCategorySelect.innerHTML = '<option value="" disabled selected>Seleziona la categoria...</option>';
        
        if (!state.selectedSubject) {
            return;
        }
        
        calculatorData.buildingCategories.forEach(building => {
            // Se la categoria ha sottocategorie, mostra solo quelle compatibili
            if (building.subcategories && building.subcategories.length > 0) {
                // Special-case: per le imprese piccole/medie vogliamo mostrare il
                // terziario senza optgroup (come per le grandi imprese): presentare
                // direttamente l'opzione "tertiario_generic" come scelta singola.
                if (building.id === 'tertiary' && ['small_company', 'medium_company', 'large_company', 'person'].includes(state.selectedSubject)) {
                    const sub = building.subcategories.find(s => s.id === 'tertiary_generic');
                    if (sub) {
                        const option = document.createElement('option');
                        option.value = sub.id;
                        option.textContent = `${sub.name}` + (sub.description ? ` - ${sub.description}` : '');
                        if (sub.note) option.title = sub.note;
                        buildingCategorySelect.appendChild(option);
                    }
                    // Salta il normale rendering delle sottocategorie
                    return;
                }

                const compatibleSubcategories = building.subcategories.filter(sub => 
                    sub.allowedSubjects.includes(state.selectedSubject)
                );
                
                if (compatibleSubcategories.length > 0) {
                    // Crea optgroup per le sottocategorie
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = building.name;
                    
                    compatibleSubcategories.forEach(sub => {
                        const option = document.createElement('option');
                        option.value = sub.id;
                        option.textContent = `${sub.name}`;
                        if (sub.description) {
                            option.textContent += ` - ${sub.description}`;
                        }
                        if (sub.note) {
                            option.title = sub.note;
                        }
                        optgroup.appendChild(option);
                    });
                    
                    buildingCategorySelect.appendChild(optgroup);
                } else {
                    // Nessuna sottocategoria compatibile, mostra categoria principale
                    if (building.allowedSubjects.includes(state.selectedSubject)) {
                        const option = document.createElement('option');
                        option.value = building.id;
                        option.textContent = `${building.name} - ${building.description}`;
                        buildingCategorySelect.appendChild(option);
                    }
                }
            } else {
                // Nessuna sottocategoria, mostra categoria principale
                if (building.allowedSubjects.includes(state.selectedSubject)) {
                    const option = document.createElement('option');
                    option.value = building.id;
                    option.textContent = `${building.name} - ${building.description}`;
                    buildingCategorySelect.appendChild(option);
                }
            }
        });
        
        // Mostra nota informativa se PA/ETS su residenziale
        const buildingNoteDiv = document.getElementById('building-category-note');
        if (buildingNoteDiv && state.selectedBuilding === 'residential') {
            const isPAorETSnonEcon = state.selectedSubject === 'pa' || state.selectedSubject === 'ets_non_economic';
            if (isPAorETSnonEcon) {
                buildingNoteDiv.style.display = 'block';
                buildingNoteDiv.innerHTML = `
                    <strong>ℹ️ Nota per PA/ETS:</strong> Su edifici residenziali sono ammessi:<br>
                    • <strong>Titolo III</strong> (fonti rinnovabili): sempre<br>
                    • <strong>Titolo II</strong> (efficienza energetica): solo su edifici di <strong>proprietà pubblica</strong> (es. ex IACP/ATER su edilizia sociale)
                `;
            } else {
                buildingNoteDiv.style.display = 'none';
            }
        }
    }

    // --- AGGIORNAMENTO UI DINAMICA ---
    
    // Funzione per validare i campi obbligatori
    function validateRequiredFields() {
        let allValid = true;
        const missingFields = [];
        
        // Verifica che sia selezionato almeno un intervento
        if (state.selectedInterventions.length === 0) {
            return { valid: false, message: 'Seleziona almeno un intervento' };
        }
        
        // Verifica che ogni intervento selezionato abbia tutti i campi compilati
        state.selectedInterventions.forEach(intId => {
            const intervention = calculatorData.interventions[intId];
            if (!intervention.inputs) return;
            
            intervention.inputs.forEach(input => {
                // Se è un input di tipo table, validate riga per riga
                if (input.type === 'table') {
                    const rows = state.inputValues[intId]?.[input.id] || [];
                    if (!Array.isArray(rows) || rows.length === 0) {
                        allValid = false;
                        missingFields.push(`${intervention.name}: ${input.name} (aggiungi almeno una riga)`);
                    } else {
                        rows.forEach((row, rIdx) => {
                            // Per ogni colonna della tabella
                                (input.columns || []).forEach(col => {
                                // I campi computed non sono obbligatori
                                if (col.type === 'computed') return;
                                // For certain optional columns (gwp/cop) treat them as required only
                                // if their DOM cell is both visible and enabled. Also, if a cell
                                // exists but is disabled by UI logic, skip validating it entirely.
                                let treatOptional = col.optional === true;
                                const tbody = document.getElementById(`tbody-${intId}-${input.id}`);
                                const tr = tbody ? tbody.querySelector(`tr[data-row-index="${rIdx}"]`) : null;
                                const cellEl = tr ? tr.querySelector(`[data-column-id="${col.id}"]`) : null;

                                // If the cell exists and is disabled, skip validation for this column.
                                // Also clear any previous error visuals so a disabled field doesn't
                                // remain highlighted red from an earlier validation pass.
                                if (cellEl && cellEl.disabled) {
                                    try { if (cellEl.classList) cellEl.classList.remove('invalid'); } catch (e) {}
                                    try { cellEl.style.borderColor = ''; cellEl.style.backgroundColor = ''; } catch (e) {}
                                    try { cellEl.setCustomValidity(''); } catch (e) {}
                                    try {
                                        const errElIdSkip = `error-${intId}-${input.id}-${rIdx}-${col.id}`;
                                        const errElSkip = tr ? tr.querySelector(`#${errElIdSkip}`) : null;
                                        if (errElSkip) { errElSkip.textContent = ''; errElSkip.style.display = 'none'; }
                                    } catch (e) {}
                                    return; // continue to next column
                                }

                                // Special UI rule: for fixed double duct rows the SCOP and
                                // eff_stagionale fields must NOT be validated (they are
                                // disabled and COP is used instead). Some parts of the UI
                                // may set required=true briefly; defensively skip validation
                                // when the row type indicates fixed double duct.
                                try {
                                    const trForType = tr;
                                    const tipoElForType = trForType ? trForType.querySelector('[data-column-id="tipo_pompa"]') : null;
                                    const tipoValForType = tipoElForType ? String(tipoElForType.value || '').toLowerCase() : '';
                                    let isFixedDouble = false;
                                    try {
                                        const utils = (typeof window !== 'undefined' && window.pumpUtils) ? window.pumpUtils : (typeof require === 'function' ? require('./tools/pump-utils.js') : null);
                                        if (utils && typeof utils.detectPumpFlags === 'function') {
                                            const f = utils.detectPumpFlags(tipoValForType);
                                            isFixedDouble = !!f.needsCop;
                                        } else {
                                            isFixedDouble = tipoValForType.includes('fixed') && tipoValForType.includes('double');
                                        }
                                    } catch (e) {
                                        isFixedDouble = tipoValForType.includes('fixed') && tipoValForType.includes('double');
                                    }
                                    if (isFixedDouble && (col.id === 'eff_stagionale' || col.id === 'scop')) {
                                        // ensure any previous error visuals are removed
                                        if (cellEl && cellEl.classList) cellEl.classList.remove('invalid');
                                        if (cellEl) { cellEl.style.borderColor = ''; cellEl.style.backgroundColor = ''; try { cellEl.setCustomValidity(''); } catch (e) {} }
                                        const errElIdSkip = `error-${intId}-${input.id}-${rIdx}-${col.id}`;
                                        const errElSkip = tr ? tr.querySelector(`#${errElIdSkip}`) : null;
                                        if (errElSkip) { errElSkip.textContent = ''; errElSkip.style.display = 'none'; }
                                        return;
                                    }
                                } catch (e) { /* ignore detection errors and continue validation */ }

                                // If the DOM element explicitly sets required, respect that even
                                // if the column metadata marks it optional (fixes SCOP behavior).
                                if (cellEl && cellEl.required) {
                                    treatOptional = false;
                                }

                                if (treatOptional && (col.id === 'gwp' || col.id === 'cop')) {
                                    // If the cell exists and is visible and enabled, then it's required
                                    if (cellEl && cellEl.offsetParent !== null && !cellEl.disabled) {
                                        treatOptional = false;
                                    }
                                }

                                if (treatOptional) return;

                                // Prefer the value shown in the DOM (so deletions are detected immediately)
                                let val;
                                if (cellEl) {
                                    let domVal = cellEl.value;
                                    if (domVal === undefined || domVal === null) domVal = '';
                                    if (col.type === 'number') {
                                        // parse number, but keep empty as empty string
                                        const parsed = (domVal === '') ? '' : parseFloat(String(domVal).replace(',', '.'));
                                        val = (parsed === '' || isNaN(parsed)) ? (domVal === '' ? '' : domVal) : parsed;
                                    } else {
                                        val = String(domVal).trim();
                                    }
                                } else {
                                    // Fallback: use the value in state
                                    val = row ? row[col.id] : undefined;
                                }

                                const isEmptyCell = val === null || val === undefined || val === '';

                                let cellInvalid = false;
                                if (!isEmptyCell && cellEl) {
                                    // For number inputs, do a manual parse/limit check so typed values
                                    // are validated immediately (spinners not required).
                                    if (col.type === 'number') {
                                        const raw = String(cellEl.value || '').replace(',', '.');
                                        const num = raw === '' ? NaN : parseFloat(raw);
                                        const minV = (typeof col.min !== 'undefined') ? Number(col.min) : -Infinity;
                                        const maxV = (typeof col.max !== 'undefined' && col.max !== '') ? Number(col.max) : Infinity;
                                        if (isNaN(num) || num < minV || num > maxV) {
                                            cellInvalid = true;
                                            if (cellEl.classList) cellEl.classList.add('invalid');
                                            try { cellEl.setCustomValidity(`Valore invalido`); } catch (e) {}
                                        } else {
                                            try { cellEl.setCustomValidity(''); } catch (e) {}
                                        }
                                            // Also respect any programmatic customValidity set elsewhere
                                            try {
                                                if (cellEl.validationMessage && cellEl.validationMessage.trim() !== '') {
                                                    cellInvalid = true;
                                                    if (cellEl.classList) cellEl.classList.add('invalid');
                                                }
                                            } catch (e) {}
                                    } else {
                                        // Fallback to HTML5 validity for non-number fields
                                        if (typeof cellEl.checkValidity === 'function' && !cellEl.checkValidity()) {
                                            cellInvalid = true;
                                            if (cellEl.classList) cellEl.classList.add('invalid');
                                        }
                                    }
                                }

                                if (isEmptyCell || cellInvalid) {
                                    allValid = false;
                                    missingFields.push(`${intervention.name} — riga ${rIdx + 1}: ${col.name}`);
                                    if (cellEl && cellEl.classList) cellEl.classList.add('invalid');
                                    if (cellEl) { cellEl.style.borderColor = '#d32f2f'; cellEl.style.backgroundColor = '#ffebee'; }

                                    // Mostra messaggio inline se presente
                                    const errElId = `error-${intId}-${input.id}-${rIdx}-${col.id}`;
                                    const errEl = tr ? tr.querySelector(`#${errElId}`) : null;
                                    if (errEl) {
                                        errEl.textContent = isEmptyCell ? 'Campo obbligatorio' : (cellEl && cellEl.validationMessage) || 'Valore non valido';
                                        errEl.style.display = 'block';
                                    }
                                } else {
                                    if (cellEl && cellEl.classList) cellEl.classList.remove('invalid');
                                    if (cellEl) { cellEl.style.borderColor = ''; cellEl.style.backgroundColor = ''; }
                                    const errElId = `error-${intId}-${input.id}-${rIdx}-${col.id}`;
                                    const errEl = tr ? tr.querySelector(`#${errElId}`) : null;
                                    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
                                }
                            });
                        });
                    }
                    return; // procediamo alla prossima input
                }

                // Campo singolo (non table) - comportamento precedente
                const value = state.inputValues[intId]?.[input.id];
                const inputEl = document.querySelector(`#input-${intId}-${input.id}`);

                // Valida il campo
                const isEmpty = value === null || value === undefined || value === '';
                // By default numeric fields are invalid when empty or outside bounds. For
                // intervento `infrastrutture-ricarica` we must NOT block user input on
                // the `costo_totale` field: allow empty entry and only mark invalid if
                // a non-empty value is malformed or out of range.
                let isInvalid;
                if (intId === 'infrastrutture-ricarica' && input.id === 'costo_totale') {
                    isInvalid = input.type === 'number' && (!isEmpty && (isNaN(value) || value < (input.min || 0)));
                } else {
                    isInvalid = input.type === 'number' && (isEmpty || isNaN(value) || value < (input.min || 0));
                }

                // Se l'elemento DOM esiste, considera anche la validità HTML5 (es. customValidity/max)
                // EXCEPTION: for `infrastrutture-ricarica` -> `costo_totale` we explicitly
                // skip the HTML5 checkValidity() because we want to allow free editing
                // (we handle max warnings visually). This avoids the browser marking the
                // field as invalid while the user types a value above the indicative max.
                if (!isInvalid && inputEl && typeof inputEl.checkValidity === 'function') {
                    const skipHtmlValidity = (intId === 'infrastrutture-ricarica' && input.id === 'costo_totale');
                    if (!skipHtmlValidity && !inputEl.checkValidity()) {
                        // Marca come invalido in modo che venga evidenziato e bloccato
                        inputEl.classList.add('invalid');
                        isInvalid = true;
                    }
                }

                // Regola speciale per infrastrutture-ricarica: obbligatorietà condizionale
                if (intId === 'infrastrutture-ricarica') {
                    const tipo = state.inputValues[intId]?.['tipo_infrastruttura'];
                    const needPunti = tipo === 'Standard monofase (7.4-22kW)' || tipo === 'Standard trifase (7.4-22kW)';
                    const needPotenza = tipo === 'Media (22-50kW)';
                    if (input.id === 'numero_punti' && !needPunti) {
                        return; // non richiesto
                    }
                    if (input.id === 'potenza' && !needPotenza) {
                        return; // non richiesto
                    }
                }

                if (isEmpty || isInvalid) {
                    allValid = false;
                    missingFields.push(`${intervention.name}: ${input.name}`);
                    if (inputEl) {
                        inputEl.classList.add('invalid');
                    }
                } else {
                    if (inputEl) {
                        inputEl.classList.remove('invalid');
                    }
                }
            });
        });
        
        if (!allValid) {
            return { 
                valid: false, 
                message: 'Completa tutti i campi obbligatori evidenziati in rosso',
                fields: missingFields 
            };
        }
        
        return { valid: true };
    }

    // Validazione specifica per pompe di calore: potenza deve rispettare i limiti per tipo
    function validatePompePowerConstraints() {
        const intId = 'pompa-calore';
        const inputId = 'righe_pompe';
        const tbody = document.getElementById(`tbody-${intId}-${inputId}`);
        if (!tbody) return { valid: true };

        const rows = Array.from(tbody.querySelectorAll('tr'));
        const smallTypes = ['aria/aria split/multisplit', 'aria/aria fixed double duct'];
        const errors = [];

        rows.forEach((tr, idx) => {
            const tipoEl = tr.querySelector('[data-column-id="tipo_pompa"]');
            const potEl = tr.querySelector('[data-column-id="potenza_nominale"]');
            if (!tipoEl || !potEl) return;
            const tipo = String(tipoEl.value || '').trim();
            const raw = String(potEl.value || '').replace(',', '.').trim();
            const pot = raw === '' ? NaN : parseFloat(raw);

            // small types: max 12 kW
            if (smallTypes.includes(tipo)) {
                if (isNaN(pot) || pot > 12) {
                    errors.push({ row: idx + 1, tipo, pot, msg: 'Potenza massima ammessa 12 kW per la tipologia selezionata' });
                    if (potEl.classList) potEl.classList.add('invalid');
                    try { potEl.setCustomValidity('Potenza massima ammessa 12 kW'); } catch (e) {}
                } else {
                    try { potEl.setCustomValidity(''); } catch (e) {}
                    potEl.classList.remove('invalid');
                }
            }

            // VRF/VRV: min 13 kW
            const lowerTipo = tipo.toLowerCase();
            const isVrf = lowerTipo.includes('vrf') || lowerTipo.includes('vrv');
            if (isVrf) {
                if (isNaN(pot) || pot < 13) {
                    errors.push({ row: idx + 1, tipo, pot, msg: 'Potenza minima ammessa 13 kW per VRF/VRV' });
                    if (potEl.classList) potEl.classList.add('invalid');
                    try { potEl.setCustomValidity('Potenza minima ammessa 13 kW'); } catch (e) {}
                } else {
                    try { potEl.setCustomValidity(''); } catch (e) {}
                    potEl.classList.remove('invalid');
                }
            }
        });

        if (errors.length > 0) {
            return { valid: false, errors };
        }
        return { valid: true };
    }

    // Ensure the global/site-level Zona climatica selector exists and is wired.
    function ensureGlobalZonaClimatica() {
        const existing = document.getElementById('global-zona-climatica-wrapper');
        if (existing) return; // already present

        const zonaWrapper = document.createElement('div');
        zonaWrapper.id = 'global-zona-climatica-wrapper';
        zonaWrapper.className = 'form-group';
        zonaWrapper.style.marginTop = '12px';
        zonaWrapper.style.padding = '12px';

        const zonaLabel = document.createElement('label');
        zonaLabel.textContent = 'Zona climatica (edificio)';
        zonaLabel.style.display = 'block';
        zonaLabel.style.marginBottom = '6px';
        zonaWrapper.appendChild(zonaLabel);

        const zonaSelect = document.createElement('select');
        zonaSelect.id = 'global-zona-climatica';
        ['','A','B','C','D','E','F'].forEach(opt => {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt === '' ? '-- Seleziona zona climatica --' : opt;
            zonaSelect.appendChild(o);
        });
        if (state.subjectSpecificData && state.subjectSpecificData.zona_climatica) {
            zonaSelect.value = state.subjectSpecificData.zona_climatica;
        }

        zonaSelect.addEventListener('change', (e) => {
            const v = e.target.value || null;
            if (!state.subjectSpecificData) state.subjectSpecificData = {};
            state.subjectSpecificData.zona_climatica = v;

            (state.selectedInterventions || []).forEach(intId => {
                if (!state.inputValues[intId]) state.inputValues[intId] = {};
                state.inputValues[intId]['zona_climatica'] = v;
            });

            renderInterventions();
            validateRequiredFields();
        });

        zonaWrapper.appendChild(zonaSelect);

        // NOTE: intentionally no reset link — the site-level zona_climatica is
        // persistent for the session and can be changed via the select itself.

        const buildingGroup = document.getElementById('building-category-group');
        if (buildingGroup && buildingGroup.parentNode) {
            buildingGroup.parentNode.insertBefore(zonaWrapper, buildingGroup.nextSibling);
        }
    }

    function renderSubjectSpecificFields() {
        // Verifica se ci sono campi specifici per il soggetto selezionato
    let specificFields = calculatorData.subjectSpecificFields?.[state.selectedSubject];
        
        // Ensure we have an array to iterate; even when there are no subject-specific
        // fields defined in `calculatorData`, we still render the container so that
        // the LOCALIZZAZIONE subsection (company flags) can be displayed when
        // appropriate.
        if (!specificFields || specificFields.length === 0) {
            specificFields = [];
        }

        // If there are no subject-specific fields and the operator is not a company,
        // don't render the whole container (avoids showing an empty blue box for
        // residential selections).
        const companyTypes = ['private_tertiary_small','private_tertiary_medium','private_tertiary_large'];
        const isCompany = companyTypes.includes(state.selectedOperator);

        // Ensure the site-level selector exists (implementation is in ensureGlobalZonaClimatica)
        ensureGlobalZonaClimatica();

        if ((!specificFields || specificFields.length === 0) && !isCompany) {
            // Remove existing container if present
            const existingContainer = document.getElementById('subject-specific-fields');
            if (existingContainer) existingContainer.remove();
            return;
        }

        // Crea (o riusa) una sezione dedicata nell'HTML dopo il building category
        let specificFieldsContainer = document.getElementById('subject-specific-fields');
        if (!specificFieldsContainer) {
            specificFieldsContainer = document.createElement('div');
            specificFieldsContainer.id = 'subject-specific-fields';
            specificFieldsContainer.className = 'form-group';
            specificFieldsContainer.style.marginTop = '20px';
            specificFieldsContainer.style.padding = '16px';
            specificFieldsContainer.style.background = '#f0f8ff';
            specificFieldsContainer.style.borderRadius = '8px';
            specificFieldsContainer.style.border = '2px solid #2196f3';
            
            // Inseriscilo dopo il building-category-group
            const buildingGroup = document.getElementById('building-category-group');
            buildingGroup.parentNode.insertBefore(specificFieldsContainer, buildingGroup.nextSibling);
        }

        specificFieldsContainer.innerHTML = '<h4 style="margin: 0 0 16px 0; color: #1976d2;">Dati aggiuntivi</h4>';

        // --- LOCALIZZAZIONE: sezione visibile solo per imprese (piccola/media/grande)
        // Verrà montata qui e sincronizzerà i flag INCREMENTO_INT3/INT4/INT5 nello state
    const existingLocal = document.getElementById('localizzazione-section');
    if (existingLocal) existingLocal.remove();
        if (isCompany) {
            const locDiv = document.createElement('div');
            locDiv.id = 'localizzazione-section';
            locDiv.style.marginTop = '12px';
            locDiv.style.padding = '12px';
            locDiv.style.border = '1px solid #c5cae9';
            locDiv.style.borderRadius = '6px';
            locDiv.style.background = '#f8f9ff';

            const locTitle = document.createElement('h4');
            locTitle.textContent = 'LOCALIZZAZIONE';
            locTitle.style.margin = '0 0 8px 0';
            locTitle.style.color = '#303f9f';
            locDiv.appendChild(locTitle);

            // Helper to create one checkbox row
            function makeLocCheckbox(id, labelText) {
                const wrapper = document.createElement('div');
                wrapper.className = 'form-group';
                wrapper.style.marginBottom = '8px';

                const checkboxWrapper = document.createElement('div');
                checkboxWrapper.style.display = 'flex';
                checkboxWrapper.style.alignItems = 'flex-start';
                checkboxWrapper.style.gap = '8px';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = `local-${id}`;
                input.name = id;
                input.checked = !!state.subjectSpecificData[id];
                input.style.marginTop = '4px';

                const labelWrapper = document.createElement('div');
                labelWrapper.style.flex = '1';

                const label = document.createElement('label');
                label.htmlFor = input.id;
                label.style.cursor = 'pointer';
                label.style.display = 'block';
                label.style.fontWeight = 'normal';
                label.style.fontSize = '0.95em';
                label.innerHTML = labelText;

                labelWrapper.appendChild(label);
                checkboxWrapper.appendChild(input);
                checkboxWrapper.appendChild(labelWrapper);
                wrapper.appendChild(checkboxWrapper);

                // Event: update state and enforce exclusivity between INT3 and INT4
                input.addEventListener('change', (e) => {
                    state.subjectSpecificData[id] = e.target.checked;

                    // exclusivity: if INT3 checked -> disable INT4; if INT4 checked -> disable INT3
                    if (id === 'INCREMENTO_INT3' && e.target.checked) {
                        state.subjectSpecificData['INCREMENTO_INT4'] = false;
                        const other = document.getElementById('local-INCREMENTO_INT4');
                        if (other) { other.checked = false; other.disabled = true; }
                    } else if (id === 'INCREMENTO_INT3' && !e.target.checked) {
                        const other = document.getElementById('local-INCREMENTO_INT4');
                        if (other) { other.disabled = false; }
                    }

                    if (id === 'INCREMENTO_INT4' && e.target.checked) {
                        state.subjectSpecificData['INCREMENTO_INT3'] = false;
                        const other = document.getElementById('local-INCREMENTO_INT3');
                        if (other) { other.checked = false; other.disabled = true; }
                    } else if (id === 'INCREMENTO_INT4' && !e.target.checked) {
                        const other = document.getElementById('local-INCREMENTO_INT3');
                        if (other) { other.disabled = false; }
                    }

                    // INT5 independent — no extra logic
                    // Trigger any dependant UI updates
                    console.log(`LOCALIZZAZIONE ${id} =>`, state.subjectSpecificData[id]);
                });

                return wrapper;
            }

            // Labels per richiesta utente (italiano, precise)
            const labelINT3 = `Gli interventi di incremento dell'efficienza energetica sono realizzati in zone assistite che soddisfano le condizioni di cui all'articolo 107, paragrafo 3, lettera a), del Trattato sul funzionamento dell’Unione Europea?`;
            const labelINT4 = `Gli interventi di incremento dell'efficienza energetica sono realizzati in zone assistite che soddisfano le condizioni di cui all'articolo 107, paragrafo 3, lettera c), del Trattato sul funzionamento dell’Unione Europea?`;
            const labelINT5 = `Gli interventi di incremento dell'efficienza energetica realizzati hanno determinato un miglioramento della prestazione energetica dell'edificio misurata in energia primaria di almeno il 40 %  rispetto alla situazione precedente all'investimento?`;

            locDiv.appendChild(makeLocCheckbox('INCREMENTO_INT3', labelINT3));
            locDiv.appendChild(makeLocCheckbox('INCREMENTO_INT4', labelINT4));
            locDiv.appendChild(makeLocCheckbox('INCREMENTO_INT5', labelINT5));

            specificFieldsContainer.appendChild(locDiv);

            // apply initial mutual-disable state if needed
            if (state.subjectSpecificData['INCREMENTO_INT3']) {
                const other = document.getElementById('local-INCREMENTO_INT4'); if (other) other.disabled = true;
            }
            if (state.subjectSpecificData['INCREMENTO_INT4']) {
                const other = document.getElementById('local-INCREMENTO_INT3'); if (other) other.disabled = true;
            }
        }
        specificFields.forEach(field => {
            // Verifica se il campo deve essere visibile in base alle condizioni
            if (field.visible_if) {
                const conditionField = field.visible_if.field;
                const conditionValue = field.visible_if.value;
                const currentValue = state.subjectSpecificData[conditionField];
                
                // Se la condizione non è soddisfatta, salta questo campo
                if (currentValue !== conditionValue) {
                    return;
                }
            }

            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'form-group';
            fieldDiv.style.marginBottom = '12px';
            fieldDiv.id = `field-wrapper-${field.id}`;

            if (field.type === 'checkbox') {
                // Gestione checkbox
                const checkboxWrapper = document.createElement('div');
                checkboxWrapper.style.display = 'flex';
                checkboxWrapper.style.alignItems = 'center';
                checkboxWrapper.style.gap = '8px';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = `subject-field-${field.id}`;
                input.name = field.id;
                input.checked = state.subjectSpecificData[field.id] || false;
                
                input.addEventListener('change', (e) => {
                    state.subjectSpecificData[field.id] = e.target.checked;
                    console.log(`Aggiornato ${field.id}:`, e.target.checked);
                    
                    // Se questo campo controlla la visibilità di altri, ri-renderizza
                    if (field.shows && field.shows.length > 0) {
                        renderSubjectSpecificFields();
                    }
                });

                const label = document.createElement('label');
                label.htmlFor = input.id;
                label.textContent = field.name;
                label.style.cursor = 'pointer';
                label.style.fontWeight = 'bold';

                checkboxWrapper.appendChild(input);
                checkboxWrapper.appendChild(label);
                fieldDiv.appendChild(checkboxWrapper);

                if (field.help) {
                    const help = document.createElement('small');
                    help.className = 'info-text';
                    help.textContent = field.help;
                    help.style.display = 'block';
                    help.style.marginTop = '4px';
                    help.style.marginLeft = '28px';
                    help.style.color = '#666';
                    fieldDiv.appendChild(help);
                }
            } else {
                // Gestione input standard
                const label = document.createElement('label');
                label.textContent = field.name;
                if (!field.optional) {
                    label.innerHTML += ' <span style="color: #d32f2f;">*</span>';
                }
                fieldDiv.appendChild(label);

                const input = document.createElement('input');
                input.type = field.type || 'text';
                input.id = `subject-field-${field.id}`;
                input.name = field.id;
                if (field.min !== undefined) input.min = field.min;
                if (field.max !== undefined) input.max = field.max;
                if (field.help) input.title = field.help;
                input.value = state.subjectSpecificData[field.id] || '';
                
                input.addEventListener('input', (e) => {
                    const value = field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                    state.subjectSpecificData[field.id] = value;
                    console.log(`Aggiornato ${field.id}:`, value);
                });

                fieldDiv.appendChild(input);

                if (field.help) {
                    const help = document.createElement('small');
                    help.className = 'info-text';
                    help.textContent = field.help;
                    help.style.display = 'block';
                    help.style.marginTop = '4px';
                    help.style.color = '#666';
                    fieldDiv.appendChild(help);
                }
            }

            specificFieldsContainer.appendChild(fieldDiv);
        });
    }

    function renderImplementationModeFields() {
        // If the implementation-mode group isn't present in the DOM (we removed
        // step 3 from the UI), do nothing. This keeps backward compatibility
        // for any code that still calls this function.
        const modeGroup = document.getElementById('implementation-mode-group');
        if (!modeGroup) {
            console.log('renderImplementationModeFields: implementation-mode-group not present, skipping');
            return;
        }

        // Otherwise proceed with the original behavior (if present)
        const fieldKey = `${state.selectedSubject}_${state.selectedMode}`;
        const modeFields = calculatorData.implementationModeFields?.[fieldKey];

        // Rimuovi contenitore esistente se presente
        const existingContainer = document.getElementById('implementation-mode-fields');
        if (existingContainer) existingContainer.remove();

        if (!modeFields || modeFields.length === 0) return;

        const fieldsContainer = document.createElement('div');
        fieldsContainer.id = 'implementation-mode-fields';
        fieldsContainer.className = 'form-group';
        fieldsContainer.style.marginTop = '20px';
        fieldsContainer.style.padding = '16px';
        fieldsContainer.style.background = '#fff3e0';
        fieldsContainer.style.borderRadius = '8px';
        fieldsContainer.style.border = '2px solid #ff9800';

        modeGroup.parentNode.insertBefore(fieldsContainer, modeGroup.nextSibling);
        fieldsContainer.innerHTML = '<h4 style="margin: 0 0 16px 0; color: #e65100;">📋 Verifica requisiti maggiorazione</h4>';

        modeFields.forEach(field => {
            if (field.visible_if) {
                const conditionField = field.visible_if.field;
                const conditionValue = field.visible_if.value;
                const currentValue = state.subjectSpecificData[conditionField];
                if (currentValue !== conditionValue) return;
            }

            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'form-group';
            fieldDiv.style.marginBottom = '12px';
            fieldDiv.id = `field-wrapper-${field.id}`;

            if (field.type === 'checkbox') {
                const checkboxWrapper = document.createElement('div');
                checkboxWrapper.style.display = 'flex';
                checkboxWrapper.style.alignItems = 'flex-start';
                checkboxWrapper.style.gap = '8px';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = `mode-field-${field.id}`;
                input.name = field.id;
                input.checked = state.subjectSpecificData[field.id] || false;
                input.style.marginTop = '4px';

                input.addEventListener('change', (e) => {
                    state.subjectSpecificData[field.id] = e.target.checked;
                    if (field.shows && field.shows.length > 0) renderImplementationModeFields();
                });

                const labelWrapper = document.createElement('div');
                labelWrapper.style.flex = '1';

                const label = document.createElement('label');
                label.htmlFor = input.id;
                label.textContent = field.name;
                label.style.cursor = 'pointer';
                label.style.fontWeight = 'bold';
                label.style.display = 'block';
                labelWrapper.appendChild(label);

                if (field.help) {
                    const help = document.createElement('small');
                    help.className = 'info-text';
                    help.textContent = field.help;
                    help.style.display = 'block';
                    help.style.marginTop = '4px';
                    help.style.color = '#666';
                    help.style.fontSize = '0.9em';
                    labelWrapper.appendChild(help);
                }

                checkboxWrapper.appendChild(input);
                checkboxWrapper.appendChild(labelWrapper);
                fieldDiv.appendChild(checkboxWrapper);
            }

            fieldsContainer.appendChild(fieldDiv);
        });
    }

    // Helper per verificare se un campo deve essere visibile
    function isFieldVisible(input, intId) {
        if (!input.visible_if) return true;
        
        const conditionField = input.visible_if.field;
        const currentValue = state.inputValues[intId]?.[conditionField];
        
        // Supporto sia per valore singolo (value) che multiplo (values)
        if (input.visible_if.values) {
            return input.visible_if.values.includes(currentValue);
        } else if (input.visible_if.value !== undefined) {
            return currentValue === input.visible_if.value;
        }
        return true;
    }

    function updateDynamicInputs() {
        dynamicInputsContainer.innerHTML = '';
        
        // NON resettare completamente, ma rimuovi solo gli interventi deselezionati
        const currentInterventions = new Set(state.selectedInterventions);
        const keysToRemove = Object.keys(state.inputValues).filter(key => !currentInterventions.has(key));
        keysToRemove.forEach(key => delete state.inputValues[key]);

        if (state.selectedInterventions.length === 0) {
            dynamicInputsContainer.innerHTML = '<p class="notice">Seleziona almeno un intervento per visualizzare i campi richiesti.</p>';
            return;
        }

        state.selectedInterventions.forEach(intId => {
            const interventionData = calculatorData.interventions[intId];
            if (!interventionData.inputs) return;

            const groupDiv = document.createElement('div');
            groupDiv.className = 'input-group';
            groupDiv.id = `group-${intId}`;

            const title = document.createElement('h3');
            title.textContent = interventionData.name;
            groupDiv.appendChild(title);

            // Inizializza solo se non esiste già
            if (!state.inputValues[intId]) {
                state.inputValues[intId] = { premiums: {} };
            }

            interventionData.inputs.forEach(input => {
                    // Verifica visibilità del campo
                    if (!isFieldVisible(input, intId)) {
                        return; // Salta questo campo
                    }
                
                const inputDiv = document.createElement('div');
                inputDiv.className = 'form-group';
                
                const label = document.createElement('label');
                label.setAttribute('for', `input-${intId}-${input.id}`);
                label.textContent = input.name;
                inputDiv.appendChild(label);

                let inputEl;
                if (input.type === 'table') {
                    // Render tabella dinamica
                    const tableContainer = document.createElement('div');
                    tableContainer.className = 'table-input-container';
                    tableContainer.style.marginTop = '12px';
                    
                    const table = document.createElement('table');
                    table.className = 'dynamic-table';
                    table.style.width = '100%';
                    table.style.borderCollapse = 'collapse';
                    table.style.marginBottom = '12px';
                    
                    // Header
                    const thead = document.createElement('thead');
                    const headerRow = document.createElement('tr');
                    input.columns.forEach(col => {
                        const th = document.createElement('th');
                        th.textContent = col.name;
                        th.style.border = '1px solid #ddd';
                        th.style.padding = '8px';
                        th.style.background = '#f5f5f5';
                        th.style.textAlign = 'left';
                        headerRow.appendChild(th);
                    });
                    // Colonna azioni
                    const thActions = document.createElement('th');
                    thActions.textContent = 'Azioni';
                    thActions.style.border = '1px solid #ddd';
                    thActions.style.padding = '8px';
                    thActions.style.background = '#f5f5f5';
                    thActions.style.width = '80px';
                    headerRow.appendChild(thActions);
                    thead.appendChild(headerRow);
                    table.appendChild(thead);
                    
                    // Body
                    const tbody = document.createElement('tbody');
                    tbody.id = `tbody-${intId}-${input.id}`;
                    table.appendChild(tbody);
                    
                    tableContainer.appendChild(table);
                    
                    // Pulsante aggiungi riga
                    const addButton = document.createElement('button');
                    addButton.type = 'button';
                    addButton.textContent = '+ Aggiungi tipologia';
                    addButton.className = 'button primary';
                    addButton.style.marginTop = '8px';
                    addButton.addEventListener('click', () => {
                        addTableRow(intId, input.id, input.columns, tbody);
                    });
                    tableContainer.appendChild(addButton);
                    
                    inputDiv.appendChild(tableContainer);
                    
                    // Inizializza array vuoto se non esiste
                    if (!state.inputValues[intId][input.id]) {
                        state.inputValues[intId][input.id] = [];
                    }
                    
                    // Ripristina righe esistenti
                    const existingRows = state.inputValues[intId][input.id];
                    if (existingRows && existingRows.length > 0) {
                        existingRows.forEach(() => {
                            addTableRow(intId, input.id, input.columns, tbody);
                        });
                    } else {
                        // Aggiungi una riga iniziale
                        addTableRow(intId, input.id, input.columns, tbody);
                    }
                    
                    groupDiv.appendChild(inputDiv);
                    // Per il tipo table, il rendering è completo, saltiamo il resto
                } else {
                    // Gestione input normali (select, computed, text, number, ecc.)
                    let inputEl;
                    if (input.type === 'select') {
                    // If a site-level zona_climatica is present, render the per-intervention
                    // zona_climatica as a disabled select with the chosen value to make it
                    // clearly non-editable while still visible.
                    if (input.id === 'zona_climatica' && state.subjectSpecificData && state.subjectSpecificData.zona_climatica) {
                        inputEl = document.createElement('select');
                        const option = document.createElement('option');
                        option.value = state.subjectSpecificData.zona_climatica;
                        option.textContent = state.subjectSpecificData.zona_climatica;
                        inputEl.appendChild(option);
                        inputEl.disabled = true;
                    } else {
                        inputEl = document.createElement('select');
                        input.options.forEach(opt => {
                            const option = document.createElement('option');
                            // Supporta sia stringhe semplici che oggetti {value, label}
                            if (typeof opt === 'string') {
                                option.value = opt;
                                option.textContent = opt;
                            } else {
                                option.value = opt.value;
                                option.textContent = opt.label || opt.value;
                                if (opt.cmax) {
                                    option.dataset.cmax = opt.cmax;
                                }
                            }
                            inputEl.appendChild(option);
                        });
                    }
                } else if (input.type === 'computed') {
                    // Campo calcolato automaticamente (readonly)
                    inputEl = document.createElement('input');
                    inputEl.type = 'text';
                    inputEl.readOnly = true;
                    inputEl.className = 'computed-field';
                    inputEl.style.backgroundColor = '#f0f0f0';
                    inputEl.style.cursor = 'not-allowed';
                } else {
                    inputEl = document.createElement('input');
                    inputEl.type = input.type;
                    if (input.min !== undefined) inputEl.min = input.min;
                    if (input.max !== undefined) inputEl.max = input.max;
                    if (input.step !== undefined) inputEl.step = input.step;
                }
                
                inputEl.id = `input-${intId}-${input.id}`;
                inputEl.dataset.intervention = intId;
                inputEl.dataset.inputId = input.id;
                
                // Aggiungi tooltip se presente
                if (input.help) {
                    inputEl.title = input.help;
                }
                
                inputDiv.appendChild(inputEl);

                // Placeholder per messaggi di errore specifici del campo
                const errId = `error-${intId}-${input.id}`;
                let errEl = document.getElementById(errId);
                if (!errEl) {
                    errEl = document.createElement('small');
                    errEl.id = errId;
                    errEl.className = 'field-error';
                    errEl.style.color = '#d32f2f';
                    errEl.style.display = 'none';
                    errEl.style.marginTop = '4px';
                    inputDiv.appendChild(errEl);
                }

                groupDiv.appendChild(inputDiv);

                // Ripristina il valore salvato se esiste, altrimenti inizializza
                if (input.type === 'computed') {
                    // I campi computed vengono aggiornati dinamicamente
                    const computedValue = input.compute ? input.compute(state.inputValues[intId] || {}) : '';
                    inputEl.value = computedValue;
                    state.inputValues[intId][input.id] = computedValue;
                } else {
                    const savedValue = state.inputValues[intId][input.id];
                    if (savedValue !== undefined && savedValue !== null) {
                        inputEl.value = savedValue;
                    } else {
                        state.inputValues[intId][input.id] = inputEl.value || null;
                    }
                    
                    if (!inputEl.disabled) {
                        inputEl.addEventListener('change', handleInputChange);
                        inputEl.addEventListener('keyup', handleInputChange);
                    }

                    // Se il campo è numerico e dichiara un max, comportamenti speciali per alcuni campi
                    if (input.type === 'number' && input.max !== undefined) {
                        if (intId === 'fotovoltaico-accumulo' && input.id === 'potenza_fv') {
                            inputEl.placeholder = `Max: ${input.max} kWp`;
                            inputEl.addEventListener('input', (e) => {
                                const raw = e.target.value;
                                const num = parseFloat(raw);
                                if (!isNaN(num) && num > input.max) {
                                        if (!state.inputValues[intId]) state.inputValues[intId] = {};
                                        state.inputValues[intId][input.id] = null;
                                        e.target.classList.add('invalid');
                                        e.target.setCustomValidity(`Valore massimo ammesso: ${input.max}`);
                                    } else {
                                        e.target.classList.remove('invalid');
                                        e.target.setCustomValidity('');
                                    }
                            });
                            const sv = state.inputValues[intId] && state.inputValues[intId][input.id];
                            if (sv !== undefined && sv !== null && !isNaN(Number(sv)) && Number(sv) > input.max) {
                                state.inputValues[intId][input.id] = null;
                                inputEl.classList.add('invalid');
                                inputEl.setCustomValidity(`Valore massimo ammesso: ${input.max}`);
                            }
                        } else {
                            inputEl.addEventListener('input', (e) => {
                                const raw = e.target.value;
                                const num = parseFloat(raw);
                                if (!isNaN(num) && num > input.max) {
                                    e.target.value = input.max;
                                    if (!state.inputValues[intId]) state.inputValues[intId] = {};
                                    state.inputValues[intId][input.id] = input.max;
                                    e.target.classList.add('clamped-max');
                                    setTimeout(() => e.target.classList.remove('clamped-max'), 900);
                                }
                            });
                        }
                    }

                    // Aggiungi classe per campi obbligatori
                    inputEl.classList.add('required-field');
                }
                } // fine else (gestione input normali)
            });

            // Sezione premi per-intervento
            const perPremWrapper = document.createElement('div');
            perPremWrapper.className = 'form-group';
            const perPremTitle = document.createElement('label');
            perPremTitle.textContent = 'Premialità applicabili a questo intervento:';
            // Questa etichetta non rappresenta un campo obbligatorio: rimuoviamo l'asterisco rosso
            perPremTitle.classList.add('no-asterisk');
            perPremWrapper.appendChild(perPremTitle);

            let hasPerInterventionPrem = false;
            for (const [premId, premData] of Object.entries(calculatorData.premiums)) {
                if (premData.scope !== 'per-intervention') continue;
                // Il premio multi-intervento è applicato automaticamente: non mostrare la checkbox
                if (premId === 'multi-intervento') continue;
                const applicable = premData.applicableToInterventions?.includes('all') || premData.applicableToInterventions?.includes(intId);
                if (!applicable) continue;
                hasPerInterventionPrem = true;
                const premDiv = document.createElement('div');
                premDiv.className = 'premium inline';
                // Aggiungiamo classe `no-asterisk` alla label per evitare l'asterisco rosso
                // (il premio prodotti UE non è un dato obbligatorio)
                premDiv.innerHTML = `
                    <input type="checkbox" id="prem-int-${intId}-${premId}" data-intervention="${intId}" data-premium-id="${premId}" name="premium-int" value="${premId}">
                    <label class="no-asterisk" for="prem-int-${intId}-${premId}">${premData.name}</label>
                `;
                perPremWrapper.appendChild(premDiv);

                // Inizializza lo stato solo se non esiste già
                if (state.inputValues[intId].premiums[premId] === undefined) {
                    state.inputValues[intId].premiums[premId] = false;
                }
                
                // Ripristina lo stato della checkbox
                const checkboxEl = premDiv.querySelector(`#prem-int-${intId}-${premId}`);
                checkboxEl.checked = state.inputValues[intId].premiums[premId];
                checkboxEl.addEventListener('change', handleInputChange);
            }

            if (hasPerInterventionPrem) {
                groupDiv.appendChild(perPremWrapper);
            }

            // Applica limiti dinamici DOPO che tutti gli input sono stati creati
            applyDynamicMaxLimits(intId, groupDiv);

            // Ricollega eventi di dipendenza per aggiornare i limiti quando cambiano i select
            groupDiv.querySelectorAll('select').forEach(sel => {
                sel.addEventListener('change', () => applyDynamicMaxLimits(intId, groupDiv));
            });
            groupDiv.querySelectorAll('input[type="number"]').forEach(inp => {
                inp.addEventListener('input', () => applyDynamicMaxLimits(intId, groupDiv));
            });

            dynamicInputsContainer.appendChild(groupDiv);
        });
    }

    // Limiti massimi su input numerici, applicati SOLO dove la norma è certa
    function applyDynamicMaxLimits(intId, groupDiv) {
        // Utility per trovare input dentro il gruppo
        const byId = (fieldId) => groupDiv.querySelector(`#input-${intId}-${fieldId}`);

        if (intId === 'infrastrutture-ricarica') {
            // Limite su costo_totale in base al tipo (numero_punti per standard, potenza per 22-50kW)
            const tipoSel = byId('tipo_infrastruttura');
            const puntiEl = byId('numero_punti');
            const potenzaEl = byId('potenza');
            const costoTot = byId('costo_totale');
            
            // Se gli elementi non esistono (perché nascosti da visible_if), esci
            if (!tipoSel) return;
            
            // Imposta limiti max sui campi potenza/punti in base al tipo selezionato
            if (tipoSel && potenzaEl) {
                const tipo = tipoSel.value;
                if (tipo === 'Media (22-50kW)') {
                    potenzaEl.min = '22';
                    potenzaEl.max = '50';
                    potenzaEl.setAttribute('min', '22');
                    potenzaEl.setAttribute('max', '50');
                    potenzaEl.title = 'Potenza tra 22 e 50 kW';
                    potenzaEl.placeholder = 'Min: 22 kW, Max: 50 kW';
                    potenzaEl.disabled = false;
                    potenzaEl.required = true;
                } else if (tipo === 'Alta (50-100kW)') {
                    potenzaEl.min = '50';
                    potenzaEl.max = '100';
                    potenzaEl.setAttribute('min', '50');
                    potenzaEl.setAttribute('max', '100');
                    potenzaEl.title = 'Potenza tra 50 e 100 kW';
                    potenzaEl.placeholder = 'Min: 50 kW, Max: 100 kW';
                    potenzaEl.disabled = false;
                    potenzaEl.required = true;
                } else if (tipo === 'Oltre 100kW') {
                    potenzaEl.min = '100';
                    potenzaEl.max = '';
                    potenzaEl.setAttribute('min', '100');
                    potenzaEl.removeAttribute('max');
                    potenzaEl.title = 'Potenza superiore a 100 kW';
                    potenzaEl.placeholder = 'Min: 100 kW';
                    potenzaEl.disabled = false;
                    potenzaEl.required = true;
                } else {
                    // Standard monofase/trifase: potenza non usata
                    potenzaEl.disabled = true;
                    potenzaEl.required = false;
                    potenzaEl.value = '';
                    potenzaEl.placeholder = 'Non applicabile';
                }
                
                // Validazione live su potenza
                potenzaEl.addEventListener('input', function() {
                    const val = parseFloat(this.value) || 0;
                    const minVal = parseFloat(this.min) || 0;
                    const maxVal = parseFloat(this.max) || Infinity;
                    if (val < minVal || val > maxVal) {
                        this.style.borderColor = '#d32f2f';
                        this.style.backgroundColor = '#ffebee';
                        if (maxVal === Infinity) {
                            this.setCustomValidity(`La potenza deve essere almeno ${minVal} kW`);
                        } else {
                            this.setCustomValidity(`La potenza deve essere tra ${minVal} e ${maxVal} kW`);
                        }
                    } else {
                        this.style.borderColor = '';
                        this.style.backgroundColor = '';
                        this.setCustomValidity('');
                    }
                });
            }
            
            // Abilita/disabilita numero_punti in base al tipo
            if (tipoSel && puntiEl) {
                const tipo = tipoSel.value;
                if (tipo === 'Standard monofase (7.4-22kW)' || tipo === 'Standard trifase (7.4-22kW)') {
                    puntiEl.disabled = false;
                    puntiEl.required = true;
                    puntiEl.min = '1';
                    puntiEl.setAttribute('min', '1');
                    puntiEl.placeholder = 'Numero punti di ricarica';
                } else {
                    puntiEl.disabled = true;
                    puntiEl.required = false;
                    puntiEl.value = '';
                    puntiEl.placeholder = 'Non applicabile';
                }
            }
            
            if (tipoSel && costoTot) {
                let maxCost;
                switch (tipoSel.value) {
                    case 'Standard monofase (7.4-22kW)': {
                        const n = parseInt(puntiEl?.value || '0');
                        maxCost = (isFinite(n) ? n : 0) * 2400; break;
                    }
                    case 'Standard trifase (7.4-22kW)': {
                        const n = parseInt(puntiEl?.value || '0');
                        maxCost = (isFinite(n) ? n : 0) * 8400; break;
                    }
                    case 'Media (22-50kW)': {
                            const p = parseFloat(potenzaEl?.value || '0') || 0;
                            maxCost = p * 1200; // valore da norma (€/kW)
                        }
                        break;
                    case 'Alta (50-100kW)': maxCost = 60000; break;
                    case 'Oltre 100kW': maxCost = 110000; break;
                }
                if (maxCost) {
                    // Do NOT set the HTML `max` attribute — that would make the browser
                    // mark the field invalid when the user types a number > max. We want
                    // to allow free editing and only show a non-blocking visual
                    // warning. Store the computed max in dataset for reference.
                    costoTot.dataset.max = String(Math.max(0, Math.round(maxCost)));
                    costoTot.title = `Spesa massima ammissibile: ${calculatorData.formatNumber(Math.round(maxCost),0)} € (Regole Applicative)`;
                    costoTot.placeholder = `Max: ${calculatorData.formatNumber(Math.round(maxCost),0)} €`;
                    
                    // Validazione live
                    costoTot.addEventListener('input', function() {
                        const val = parseFloat(this.value) || 0;
                        let currentMaxCost;
                        switch (tipoSel.value) {
                            case 'Standard monofase (7.4-22kW)': {
                                const n = parseInt(puntiEl?.value || '0');
                                currentMaxCost = (isFinite(n) ? n : 0) * 2400; break;
                            }
                            case 'Standard trifase (7.4-22kW)': {
                                const n = parseInt(puntiEl?.value || '0');
                                currentMaxCost = (isFinite(n) ? n : 0) * 8400; break;
                            }
                            case 'Media (22-50kW)': {
                                const p = parseFloat(potenzaEl?.value || '0') || 0;
                                currentMaxCost = p * 1200;
                            }
                                break;
                            case 'Alta (50-100kW)': currentMaxCost = 60000; break;
                            case 'Oltre 100kW': currentMaxCost = 110000; break;
                        }
                        if (currentMaxCost && val > currentMaxCost) {
                            // Do not add a visual CSS warning (no yellow border).
                            // Keep a descriptive title so users can see the informative message on hover.
                            this.title = `La spesa supera il massimale indicativo: ${calculatorData.formatNumber(Math.round(currentMaxCost),0)} €`;
                        } else {
                            // restore the default informative title (use dataset value if present)
                            const ds = this.dataset.max ? Number(this.dataset.max) : Math.round(currentMaxCost || 0);
                            this.title = `Spesa massima ammissibile: ${calculatorData.formatNumber(ds,0)} €`;
                        }
                    });
                    // Aggiorna lo stato anche su input (in tempo reale, incluse cancellazioni)
                    cellInput.addEventListener('input', (e) => {
                        const row = parseInt(e.target.dataset.rowIndex);
                        const colId = e.target.dataset.columnId;
                        let value = e.target.value;
                        if (e.target.type === 'number') {
                            value = parseFloat(value);
                            // keep null if empty
                            value = isNaN(value) ? null : value;
                        }
                        state.inputValues[interventionId][inputId][row][colId] = value;
                        updateTableRowComputed(interventionId, inputId, row, columns, tr);
                        // trigger global validation
                        handleInputChange(e);
                    });
                    // Se questa colonna è il tipo di pompa, ri-applica la validazione sulla riga
                    // (automatico popolamento SCOP rimosso: l'utente inserisce SCOP/SCOP_min manualmente)
                    if (col.id === 'tipo_pompa') {
                        cellInput.addEventListener('change', (e) => {
                            // Aggiorna stato
                            const row = parseInt(e.target.dataset.rowIndex);
                            const colId = e.target.dataset.columnId;
                            state.inputValues[interventionId][inputId][row][colId] = e.target.value;
                            // Ri-applica validazione specifica pompa
                            attachPompaRowValidation(interventionId, inputId, rowIndex, tr);
                        });
                    }
                }
            }
        }
        
        // Limiti specifici per pompe di calore: alcune famiglie aria/aria sono
        // tipicamente split/fixed con potenze ridotte; limitiamo la potenza a 12 kW
        // quando l'utente seleziona le tipologie indicate.
        if (intId === 'pompa-calore') {
            const tipoSel = byId('tipo_pompa');
            const potEl = byId('potenza_nominale');
            if (!tipoSel || !potEl) return;

            const tipo = (tipoSel.value || '').toString();
            const smallTypes = ['aria/aria split/multisplit', 'aria/aria fixed double duct'];
            const vrfCondition = tipo.includes('VRF') || tipo.includes('VRV') || tipo.toLowerCase().includes('vrf') || tipo.toLowerCase().includes('vrv');

            if (smallTypes.includes(tipo)) {
                // Applichiamo max = 12 kW e comportamento di clamping in input
                potEl.min = '0';
                potEl.max = '12';
                potEl.setAttribute('min', '0');
                potEl.setAttribute('max', '12');
                potEl.placeholder = 'Max: 12 kW (tipologia split/fixed)';
                potEl.title = 'Per la tipologia selezionata la potenza massima consigliata è 12 kW';
                potEl.disabled = false;
                potEl.required = true;

                // Validazione live: non clampare, ma segnala errore (rosso) e imposta
                // customValidity per bloccare l'invio del form.
                potEl.addEventListener('input', function() {
                    const raw = this.value;
                    const num = parseFloat(raw);
                    if (!isNaN(num) && num > 12) {
                        // Segnala errore: aggiungi classe visuale e messaggio di validità
                        this.classList.add('invalid');
                        this.style.borderColor = '#d32f2f';
                        this.style.backgroundColor = '#ffebee';
                        this.setCustomValidity('Per la tipologia selezionata la potenza massima ammessa è 12 kW');
                        if (!state.inputValues[intId]) state.inputValues[intId] = {};
                        state.inputValues[intId]['potenza_nominale'] = num;
                        // Mostra messaggio di errore inline se presente
                        const errEl = document.getElementById(`error-${intId}-potenza_nominale`);
                        if (errEl) {
                            errEl.textContent = 'Per la tipologia selezionata la potenza massima ammessa è 12 kW';
                            errEl.style.display = 'block';
                        }
                    } else {
                        // Rimuovi stato di errore
                        this.classList.remove('invalid');
                        this.style.borderColor = '';
                        this.style.backgroundColor = '';
                        this.setCustomValidity('');
                        if (!state.inputValues[intId]) state.inputValues[intId] = {};
                        state.inputValues[intId]['potenza_nominale'] = isNaN(num) ? null : num;
                        const errEl = document.getElementById(`error-${intId}-potenza_nominale`);
                        if (errEl) {
                            errEl.textContent = '';
                            errEl.style.display = 'none';
                        }
                    }
                });

            } else if (vrfCondition) {
                // Per VRF/VRV imponiamo una potenza minima di 13 kW
                potEl.removeAttribute('max');
                potEl.max = '';
                potEl.min = '13';
                potEl.setAttribute('min', '13');
                potEl.placeholder = 'Min: 13 kW (VRF/VRV)';
                potEl.title = 'Per la tipologia selezionata la potenza minima ammessa è 13 kW';
                potEl.disabled = false;
                potEl.required = true;

                potEl.addEventListener('input', function() {
                    const raw = this.value;
                    const num = parseFloat(raw);
                    if (!isNaN(num) && num < 13) {
                        // Segnala errore per valore troppo basso
                        this.classList.add('invalid');
                        this.style.borderColor = '#d32f2f';
                        this.style.backgroundColor = '#ffebee';
                        this.setCustomValidity('Per la tipologia selezionata la potenza minima ammessa è 13 kW');
                        if (!state.inputValues[intId]) state.inputValues[intId] = {};
                        state.inputValues[intId]['potenza_nominale'] = num;
                        const errEl = document.getElementById(`error-${intId}-potenza_nominale`);
                        if (errEl) {
                            errEl.textContent = 'Per la tipologia selezionata la potenza minima ammessa è 13 kW';
                            errEl.style.display = 'block';
                        }
                    } else {
                        this.classList.remove('invalid');
                        this.style.borderColor = '';
                        this.style.backgroundColor = '';
                        this.setCustomValidity('');
                        if (!state.inputValues[intId]) state.inputValues[intId] = {};
                        state.inputValues[intId]['potenza_nominale'] = isNaN(num) ? null : num;
                        const errEl = document.getElementById(`error-${intId}-potenza_nominale`);
                        if (errEl) {
                            errEl.textContent = '';
                            errEl.style.display = 'none';
                        }
                    }
                });
            } else {
                // Rimuoviamo il vincolo se la tipologia non è tra quelle "small"
                potEl.removeAttribute('max');
                potEl.removeAttribute('min');
                potEl.max = '';
                potEl.min = '';
                potEl.placeholder = '';
                potEl.title = '';
                potEl.required = true;
            }
        }
    }
    
    // Applica validazione per riga della tabella `righe_pompe` per intervento pompa-calore
    function attachPompaRowValidation(interventionId, inputId, rowIndex, tr) {
        try {
            if (interventionId !== 'pompa-calore' || inputId !== 'righe_pompe') return;
            const tipoSel = tr.querySelector('select[data-column-id="tipo_pompa"]');
            const potEl = tr.querySelector('input[data-column-id="potenza_nominale"]');
            if (!tipoSel || !potEl) return;

            // Evita di ri-agganciare multipli listener alla stessa cella
            if (potEl.dataset.validatorAttached === '1') return;
            potEl.dataset.validatorAttached = '1';

            const errEl = tr.querySelector('small.field-error') || tr.querySelector(`#error-${interventionId}-${inputId}-${rowIndex}-potenza_nominale`);

            const smallTypes = ['aria/aria split/multisplit', 'aria/aria fixed double duct'];
            function isVrf(tipo) {
                if (!tipo) return false;
                const t = tipo.toString();
                return t.includes('VRF') || t.includes('VRV') || t.toLowerCase().includes('vrf') || t.toLowerCase().includes('vrv');
            }

            function applyConstraintAndValidate() {
                const tipo = (tipoSel.value || '').toString();
                const val = parseFloat(potEl.value);

                // Reset visual state
                potEl.classList.remove('invalid');
                potEl.style.borderColor = '';
                potEl.style.backgroundColor = '';
                potEl.setCustomValidity('');
                if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

                if (smallTypes.includes(tipo)) {
                    potEl.setAttribute('min', '0');
                    potEl.setAttribute('max', '12');
                    potEl.placeholder = 'Max: 12 kW (split/fixed)';
                    if (!isNaN(val) && val > 12) {
                        potEl.classList.add('invalid');
                        potEl.style.borderColor = '#d32f2f';
                        potEl.style.backgroundColor = '#ffebee';
                        potEl.setCustomValidity('Per la tipologia selezionata la potenza massima ammessa è 12 kW');
                        if (errEl) { errEl.textContent = 'Per la tipologia selezionata la potenza massima ammessa è 12 kW'; errEl.style.display = 'block'; }
                    }
                } else if (isVrf(tipo)) {
                    potEl.removeAttribute('max');
                    potEl.setAttribute('min', '13');
                    potEl.placeholder = 'Min: 13 kW (VRF/VRV)';
                    if (!isNaN(val) && val < 13) {
                        potEl.classList.add('invalid');
                        potEl.style.borderColor = '#d32f2f';
                        potEl.style.backgroundColor = '#ffebee';
                        potEl.setCustomValidity('Per la tipologia selezionata la potenza minima ammessa è 13 kW');
                        if (errEl) { errEl.textContent = 'Per la tipologia selezionata la potenza minima ammessa è 13 kW'; errEl.style.display = 'block'; }
                    }
                } else {
                    potEl.removeAttribute('min');
                    potEl.removeAttribute('max');
                    potEl.placeholder = '';
                }

                // Aggiorna stato condiviso
                if (!state.inputValues[interventionId]) state.inputValues[interventionId] = {};
                if (!state.inputValues[interventionId][inputId]) state.inputValues[interventionId][inputId] = [];
                const idx = Number(rowIndex) || 0;
                if (!state.inputValues[interventionId][inputId][idx]) state.inputValues[interventionId][inputId][idx] = {};
                state.inputValues[interventionId][inputId][idx]['potenza_nominale'] = isNaN(val) ? null : val;

                // Trigger global validation
                validateRequiredFields();
            }

            // Attach listeners
            tipoSel.addEventListener('change', () => applyConstraintAndValidate());

            // Ensure per-row toggle for cop/scop/gwp is attached here (centralized)
            try {
                if (!tipoSel.dataset.toggleAttached) {
                    const copEl = tr.querySelector('input[data-column-id="cop"]');
                    const scopEl = tr.querySelector('input[data-column-id="scop"]');
                    const gwpEl = tr.querySelector('select[data-column-id="gwp"]');

                    function toggleFieldsByTipoRow() {
                        const tipoVal = (tipoSel.value || '').toString().toLowerCase();
                        const alimentazioneEl = tr.querySelector('[data-column-id="alimentazione"]');
                        const alimentazioneVal = alimentazioneEl ? (String(alimentazioneEl.value || '').toLowerCase()) : 'elettrica';
                        // Determine flags via shared helper (keeps logic DRY and testable)
                        let needsCop = false; let needsGwp = false;
                        try {
                            const utils = (typeof window !== 'undefined' && window.pumpUtils) ? window.pumpUtils : (typeof require === 'function' ? require('./tools/pump-utils.js') : null);
                            if (utils && typeof utils.detectPumpFlags === 'function') {
                                const flags = utils.detectPumpFlags(tipoVal);
                                needsCop = !!flags.needsCop;
                                needsGwp = !!flags.needsGwp;
                            } else {
                                needsCop = tipoVal.includes('fixed') && tipoVal.includes('double');
                                needsGwp = tipoVal.includes('split') || tipoVal.includes('multisplit') || (tipoVal.includes('salamoia') && tipoVal.includes('aria')) || (tipoVal.includes('fixed') && tipoVal.includes('double'));
                            }
                        } catch (e) {
                            needsCop = tipoVal.includes('fixed') && tipoVal.includes('double');
                            needsGwp = tipoVal.includes('split') || tipoVal.includes('multisplit') || (tipoVal.includes('salamoia') && tipoVal.includes('aria')) || (tipoVal.includes('fixed') && tipoVal.includes('double'));
                        }

                        // If alimentation is GAS, enforce SCOP/SPER and seasonal efficiency as required and disable COP
                        if (alimentazioneVal === 'gas') {
                            if (copEl) {
                                copEl.disabled = true;
                                copEl.setAttribute('aria-hidden', 'true');
                                copEl.required = false;
                                copEl.classList.add('disabled-input');
                                copEl.classList.remove('invalid');
                                try { copEl.setCustomValidity(''); } catch (e) {}
                                try { copEl.value = ''; } catch (e) {}
                            }
                            if (scopEl) {
                                scopEl.disabled = false;
                                scopEl.removeAttribute('aria-hidden');
                                scopEl.required = true;
                                scopEl.classList.remove('disabled-input');
                            }
                            if (gwpEl) {
                                // GWP is not relevant for GAS alimentazione in most rules; keep disabled
                                gwpEl.disabled = true;
                                gwpEl.setAttribute('aria-hidden', 'true');
                                gwpEl.required = false;
                                gwpEl.classList.add('disabled-input');
                                gwpEl.classList.remove('invalid');
                                try { gwpEl.setCustomValidity(''); } catch (e) {}
                                try { gwpEl.value = ''; } catch (e) {}
                            }
                        } else {
                            if (copEl) {
                                if (needsCop) {
                                    copEl.disabled = false;
                                    copEl.removeAttribute('aria-hidden');
                                    copEl.required = true;
                                    copEl.classList.remove('disabled-input');
                                } else {
                                    copEl.disabled = true;
                                    copEl.setAttribute('aria-hidden', 'true');
                                    copEl.required = false;
                                    copEl.classList.add('disabled-input');
                                    copEl.classList.remove('invalid');
                                    try { copEl.setCustomValidity(''); } catch (e) {}
                                    try { copEl.value = ''; } catch (e) {}
                                }
                            }

                            if (scopEl) {
                                if (needsCop) {
                                    scopEl.disabled = true;
                                    scopEl.setAttribute('aria-hidden', 'true');
                                    scopEl.required = false;
                                    scopEl.classList.add('disabled-input');
                                    scopEl.classList.remove('invalid');
                                    try { scopEl.setCustomValidity(''); } catch (e) {}
                                    try { scopEl.value = ''; } catch (e) {}
                                } else {
                                    scopEl.disabled = false;
                                    scopEl.removeAttribute('aria-hidden');
                                    scopEl.required = true;
                                    scopEl.classList.remove('disabled-input');
                                }
                            }

                            if (gwpEl) {
                                if (needsGwp) {
                                    gwpEl.disabled = false;
                                    gwpEl.removeAttribute('aria-hidden');
                                    gwpEl.required = true;
                                    gwpEl.classList.remove('disabled-input');
                                } else {
                                    gwpEl.disabled = true;
                                    gwpEl.setAttribute('aria-hidden', 'true');
                                    gwpEl.required = false;
                                    gwpEl.classList.add('disabled-input');
                                    gwpEl.classList.remove('invalid');
                                    try { gwpEl.setCustomValidity(''); } catch (e) {}
                                    try { gwpEl.value = ''; } catch (e) {}
                                }
                            }
                        }

                        // re-run scop minima update
                        applyScopMinConstraintForRow(tr);
                        validateRequiredFields();
                    }

                    tipoSel.addEventListener('change', toggleFieldsByTipoRow);
                    // initial run
                    try { toggleFieldsByTipoRow(); } catch (e) { console.warn('toggleFieldsByTipoRow initial run error', e); }
                    tipoSel.dataset.toggleAttached = '1';
                }
            } catch (e) { /* ignore */ }
            potEl.addEventListener('input', () => applyConstraintAndValidate());

            // Applica subito la regola alla riga appena creata
            applyConstraintAndValidate();
        } catch (e) {
            console.warn('attachPompaRowValidation error', e);
        }
    }

    // NOTE: automatic ecodesign application function removed per user request.
    // The SCOP/SCOP_min fields remain user-editable and are not set automatically.

    function handleInputChange(e) {
        const { intervention, inputId, rowIndex, columnId } = e.target.dataset || {};

        // Se l'evento proviene da una cella di tabella (input con rowIndex/columnId),
        // lo stato è già stato aggiornato nei listener della tabella.
        // Evitiamo di sovrascrivere l'intero array (es. righe_opache) con un valore scalare.
        if (rowIndex !== undefined && columnId) {
            // Aggiorna solo validazioni o altri effetti collaterali globali.
            validateRequiredFields();
            return;
        }
        if (e.target.name === 'premium-int') {
            const premId = e.target.dataset.premiumId;
            const checked = e.target.checked;
            state.inputValues[intervention].premiums[premId] = checked;
            return;
        }
        const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
        const meta = calculatorData.interventions?.[intervention]?.inputs?.find(i => i.id === inputId);
        if (e.target.type === 'number' && meta && meta.max !== undefined && intervention === 'fotovoltaico-accumulo' && inputId === 'potenza_fv' && !isNaN(value) && value > meta.max) {
            if (!state.inputValues[intervention]) state.inputValues[intervention] = {};
            state.inputValues[intervention][inputId] = null;
            e.target.classList.add('invalid');
            e.target.setCustomValidity(`Valore massimo ammesso: ${meta.max}`);
        } else {
            if (!state.inputValues[intervention]) state.inputValues[intervention] = {};
            state.inputValues[intervention][inputId] = value;
            e.target.classList.remove('invalid');
            e.target.setCustomValidity('');
        }
        
            // Se questo campo influenza la visibilità di altri campi, ricarica la UI
            const interventionData = calculatorData.interventions[intervention];
            const hasVisibilityDependencies = interventionData?.inputs?.some(inp => 
                inp.visible_if?.field === inputId
            );
            if (hasVisibilityDependencies) {
                updateDynamicInputs();
                applyDynamicMaxLimits(intervention, document.getElementById(`group-${intervention}`));
                return;
            }
        
        // Aggiorna i campi computed per questo intervento
        updateComputedFields(intervention);
        
        // Valida in tempo reale
        validateRequiredFields();
    }

    // Funzione per aggiornare i campi calcolati automaticamente
    function updateComputedFields(interventionId) {
        const interventionData = calculatorData.interventions[interventionId];
        if (!interventionData || !interventionData.inputs) return;
        
        interventionData.inputs.forEach(input => {
            if (input.type === 'computed' && input.compute) {
                const inputEl = document.getElementById(`input-${interventionId}-${input.id}`);
                if (inputEl) {
                    const computedValue = input.compute(state.inputValues[interventionId] || {});
                    inputEl.value = computedValue;
                    state.inputValues[interventionId][input.id] = computedValue;
                }
            }
        });
    }

    // --- LOGICA DI CALCOLO ---

    function calculateIncentive() {
        // Verifica che siano completati gli step obbligatori
        if (!state.selectedSubject) {
            alert('Completa lo Step 1: seleziona chi ha la disponibilità dell\'immobile');
            return;
        }
        
        if (!state.selectedBuilding) {
            alert('Completa lo Step 2: seleziona la categoria catastale dell\'immobile');
            return;
        }
        
        if (!state.selectedOperator) {
            alert('Errore: non è stato possibile determinare il tipo di operatore. Verifica i dati inseriti.');
            return;
        }
        
        // Valida tutti i campi obbligatori
        const validation = validateRequiredFields();
        if (!validation.valid) {
            let message = validation.message;
            if (validation.fields && validation.fields.length > 0) {
                message += '\n\nCampi mancanti:\n' + validation.fields.join('\n');
            }
            alert(message);
            return;
        }

        // Validazione aggiuntiva: vincoli di potenza per pompe di calore (2.A)
        if (state.selectedInterventions.includes('pompa-calore')) {
            const pompeValidation = validatePompePowerConstraints();
            if (!pompeValidation.valid) {
                const lines = pompeValidation.errors.map(e => `Riga ${e.row}: ${e.msg} (tipo: ${e.tipo}, potenza: ${isNaN(e.pot) ? 'vuoto' : e.pot + ' kW'})`);
                alert('Errore nei limiti di potenza per Pompe di Calore:\n' + lines.join('\n'));
                return;
            }
        }

        // Additional strict validation for pompe-calore: ensure SCOP is provided
        // when required (i.e., not disabled) and respects the ecodesign minima.
        if (state.selectedInterventions.includes('pompa-calore')) {
            const scErrors = [];
            const intId = 'pompa-calore';
            const inputId = 'righe_pompe';
            const tbody = document.getElementById(`tbody-${intId}-${inputId}`);
            const rows = Array.isArray(state.inputValues[intId]?.[inputId]) ? state.inputValues[intId][inputId] : [];
            // iterate DOM rows if present to respect per-row disabled state
            const trEls = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
            rows.forEach((row, idx) => {
                const tr = trEls[idx] || null;
                const scopEl = tr ? tr.querySelector('[data-column-id="scop"]') : null;
                const copEl = tr ? tr.querySelector('[data-column-id="cop"]') : null;
                const tipo = String((row && row.tipo_pompa) || (tr && (tr.querySelector('[data-column-id="tipo_pompa"]')?.value)) || '').trim();

                // If scop field exists in DOM and is disabled, skip
                if (scopEl && scopEl.disabled) return;

                // Determine the user-supplied value (prefer DOM if present)
                let scopVal = null;
                if (scopEl) {
                    const raw = String(scopEl.value || '').trim();
                    scopVal = raw === '' ? null : Number(raw.replace(',', '.'));
                } else if (row && typeof row.scop !== 'undefined' && row.scop !== null && row.scop !== '') {
                    const raw = row.scop;
                    scopVal = (raw === '' ? null : Number(raw));
                }

                // If scop is empty but cop exists and is used for this type, allow
                const lower = tipo.toLowerCase();
                const needsCop = lower.includes('fixed') && lower.includes('double');
                if (needsCop) return; // scop not required

                if (scopVal === null || isNaN(scopVal)) {
                    scErrors.push(`Riga ${idx + 1}: SCOP non fornito`);
                    return;
                }

                // Check against ecodesign minima if available
                try {
                    const gwpVal = row?.gwp || (tr ? (tr.querySelector('[data-column-id="gwp"]')?.value || null) : null);
                    const alimentazioneVal = row?.alimentazione || (tr ? (tr.querySelector('[data-column-id="alimentazione"]')?.value || 'Elettrica') : 'Elettrica');
                    const spec = (typeof getPumpEcodesignSpec === 'function') ? getPumpEcodesignSpec(tipo, gwpVal, alimentazioneVal) : null;
                    const minScop = spec && spec.scop ? spec.scop : null;
                    if (minScop !== null && typeof minScop !== 'undefined') {
                        if (scopVal < Number(minScop)) {
                            scErrors.push(`Riga ${idx + 1}: SCOP fornito (${scopVal}) inferiore al minimo normativo (${minScop})`);
                        }
                    }
                } catch (e) {
                    // ignore helper errors
                }
            });

            if (scErrors.length > 0) {
                alert('Errore nei campi SCOP:\n' + scErrors.join('\n'));
                return;
            }
        }

        // Prepara input per calcolo combinato ufficiale (include premi per-intervento selezionati)
            const inputsByIntervention = {};
            const normalizedInputsByIntervention = {};
            state.selectedInterventions.forEach(intId => {
                const raw = { ...(state.inputValues[intId] || {}), premiums: { ...(state.inputValues[intId]?.premiums || {}) } };
                inputsByIntervention[intId] = raw;
                normalizedInputsByIntervention[intId] = prepareParamsForCalculation(raw);
            });

        // Prepara dati di contesto per incentivo al 100% automatico
        // Merge any subject-specific flags (LOCALIZZAZIONE) into selectedPremiums
        const mergedPremiums = Array.isArray(state.selectedPremiums) ? state.selectedPremiums.slice() : [];
        ['INCREMENTO_INT3','INCREMENTO_INT4','INCREMENTO_INT5'].forEach(f => {
            if (state.subjectSpecificData && state.subjectSpecificData[f]) {
                if (!mergedPremiums.includes(f)) mergedPremiums.push(f);
            }
        });

        const contextData = {
            buildingSubcategory: state.buildingSubcategory,
            is_comune: state.subjectSpecificData.is_comune || false,
            is_edificio_comunale: state.subjectSpecificData.is_edificio_comunale || false,
            is_piccolo_comune: state.subjectSpecificData.is_piccolo_comune || false,
            subjectType: state.selectedSubject,
            implementationMode: state.selectedMode,
            // Include selected interventions and premiums so determinePercentuale/explain
            // can evaluate multi-intervento and UE premi correctly.
            selectedInterventions: Array.isArray(state.selectedInterventions) ? state.selectedInterventions.slice() : [],
            selectedPremiums: mergedPremiums,
            globalPremiums: mergedPremiums,
            inputValues: state.inputValues || {},
            subjectSpecificData: state.subjectSpecificData || {}
        };

        // 1. Calcolo combinato con gestione automatica di premi globali e massimali
        const combo = calculatorData.calculateCombinedIncentives(
            state.selectedInterventions,
            normalizedInputsByIntervention,
            state.selectedOperator,
            state.selectedPremiums,
            contextData
        );

        // DIAGNOSTICA: log completo del risultato di calcolo per debugging header vs details
        console.log('DEBUG calculateIncentive - inputsByIntervention:', normalizedInputsByIntervention);
        console.log('DEBUG calculateIncentive - selectedInterventions:', state.selectedInterventions);
        console.log('DEBUG calculateIncentive - operator:', state.selectedOperator);
    console.log('DEBUG calculateIncentive - combo:', combo);
    // Expose last combo for easier debugging in browser console
    try { window.__LAST_COMBO = combo; } catch (e) { /* ignore if not allowed */ }

        let detailsHtml = '<h4>Dettaglio Calcolo per Intervento:</h4><ul class="int-list">';

        // 1.a Dettaglio per ciascun intervento con formula e variabili
        state.selectedInterventions.forEach(intId => {
            const intervention = calculatorData.interventions[intId];
            const params = inputsByIntervention[intId];
            const detail = combo.details.find(d => d.id === intId);
            const value = detail ? detail.finalIncentive : 0;

            // Spiegazione dettagliata
            let explainBlock = '';
            if (typeof intervention.explain === 'function') {
                try {
                    // Passiamo anche `contextData` in modo che le explain possano
                    // valutare Art.48-ter, multi-intervento e altre condizioni
                    // dipendenti dal contesto (comune, subjectType, implementationMode).
                    // Usiamo i params normalizzati e con campi derivati calcolati
                    const safeParams = normalizedInputsByIntervention[intId] || normalizeParams(params);
                    const exp = intervention.explain(safeParams, state.selectedOperator, contextData) || {};
                    const vars = exp.variables || {};
                    const steps = exp.steps || [];
                    const formula = exp.formula ? `<div class="formula">🧮 Formula: <span>${exp.formula}</span></div>` : '';
                    const varsRows = Object.entries(vars).map(([k,v]) => `<tr><td>${k}</td><td>${formatValue(v)}</td></tr>`).join('');
                    const stepsList = steps.length ? `<ol class="steps">${steps.map(s=>`<li>${s}</li>`).join('')}</ol>` : '';
                    const refs = intervention.category === 'Efficienza Energetica' ? ['Art. 5 - Interventi di efficienza energetica'] : ['Art. 8 - Fonti rinnovabili per la produzione di energia termica'];
                    const refsHtml = `<div class="refs"><strong>Riferimenti:</strong> ${refs.join(' · ')}</div>`;

                    // Premi per-intervento applicati
                    let perPremHtml = '';
                    if (detail && detail.appliedPremiums && detail.appliedPremiums.length) {
                        const items = detail.appliedPremiums.map(p => {
                            const note = p.note ? ` — ${escapeHtml(p.note)}` : '';
                            if (!p.value) return `<li>${escapeHtml(p.name)}${note}</li>`;
                            return `<li>${escapeHtml(p.name)}: € ${formatMoney(p.value)}${note}</li>`;
                        }).join('');
                        perPremHtml = `<div class="premi-int"><strong>Premialità sull'intervento:</strong> <ul>` + items + `</ul></div>`;
                    }

                    // Se nessuna info è stata restituita, mostriamo un messaggio diagnostico
                    const hasContent = Boolean(formula || varsRows.length || stepsList.length || perPremHtml.length);
                    const emptyNotice = `
                        <div class="empty-explain-note" style="padding:10px; background:#fff3cd; border:1px solid #ffecb5; margin-bottom:8px;">
                            <strong>Nota:</strong> Nessun dettaglio calcolabile restituito da <code>explain()</code> per questo intervento.
                            Verificare che i parametri richiesti siano stati inseriti correttamente e che il contesto (soggetto, categoria, modalità) sia valido.
                            <details style="margin-top:8px;"><summary>Visualizza debug (params / context)</summary>
                                <pre style="white-space:pre-wrap; font-size:12px;">PARAMS: ${escapeHtml(JSON.stringify(params || {}, null, 2))}\nCONTEXT: ${escapeHtml(JSON.stringify(contextData || {}, null, 2))}</pre>
                            </details>
                        </div>
                    `;

                    explainBlock = `
                        <button class="details-toggle" data-target="det-${intId}">Mostra dettagli</button>
                        <div id="det-${intId}" class="details-panel" hidden>
                            ${hasContent ? formula : ''}
                            <div class="vars-wrapper">
                                ${hasContent ? `<table class="vars-table"><thead><tr><th>Variabile</th><th>Valore</th></tr></thead><tbody>${varsRows}</tbody></table>` : emptyNotice}
                            </div>
                            ${hasContent ? stepsList : ''}
                            ${perPremHtml}
                            ${refsHtml}
                        </div>
                    `;
                } catch (e) {
                    console.warn('Spiegazione non disponibile per', intId, e);
                    explainBlock = `
                        <div class="empty-explain-note" style="padding:10px; background:#f8d7da; border:1px solid #f5c6cb; margin-bottom:8px;">
                            <strong>Errore:</strong> Impossibile generare dettagli per questo intervento. Vedi console per dettagli.
                        </div>
                    `;
                }
            }

            detailsHtml += `<li>Incentivo per "${intervention.name}": <strong>€ ${formatMoney(value)}</strong>${explainBlock}</li>`;
        });
        detailsHtml += '</ul>';

        // 3. Documentazione richiesta per le premialità selezionate
        const documentationRequired = [];
        state.selectedPremiums.forEach(premId => {
            const premium = calculatorData.premiums[premId];
            if (premium && premium.requiresDocumentation && premium.isApplicable(state.selectedInterventions, state.inputValues, state.selectedOperator)) {
                documentationRequired.push(`<strong>${premium.name}</strong>: ${premium.requiresDocumentation}`);
            }
        });
        if (documentationRequired.length > 0) {
            detailsHtml += '<h4>📋 Documentazione Obbligatoria per Premialità:</h4>';
            detailsHtml += '<ul class="notice">';
            documentationRequired.forEach(doc => {
                detailsHtml += `<li>${doc}</li>`;
            });
            detailsHtml += '</ul>';
        }

        // 4. Informazioni sui vincoli e sulla documentazione generale
        detailsHtml += '<h4>⚠️ Requisiti Generali:</h4>';
        detailsHtml += '<ul class="notice">';
        detailsHtml += '<li>Non devono essere percepiti altri incentivi statali sulla medesima spesa</li>';
        detailsHtml += '<li>Gli apparecchi devono essere nuovi o ricondizionati e rispettare i requisiti minimi ecodesign</li>';
        detailsHtml += '<li>Deve essere disponibile la diagnosi energetica e l\'APE (dove obbligatori)</li>';
        detailsHtml += '<li>I limiti di spesa ammissibile devono rispettare i massimali previsti dalla normativa</li>';
        detailsHtml += '</ul>';

        // Premi Globali e Massimali: sezione rimossa come da richiesta
        
        // 5. Disclaimer legale
        detailsHtml += '<div class="disclaimer">';
        detailsHtml += '<h4>⚖️ Avvertenze Legali</h4>';
        detailsHtml += '<p><strong>ATTENZIONE:</strong> Il presente simulatore fornisce una <strong>stima indicativa</strong> dell\'incentivo spettante basata sui dati inseriti dall\'utente. ';
        detailsHtml += 'Il <strong>calcolo definitivo dell\'incentivo</strong> sarà effettuato dal GSE (Gestore dei Servizi Energetici) in fase di:</p>';
        detailsHtml += '<ul>';
        detailsHtml += '<li>Presentazione della pratica ufficiale</li>';
        detailsHtml += '<li>Istruttoria tecnico-amministrativa</li>';
        detailsHtml += '<li>Verifica della documentazione probatoria</li>';
        detailsHtml += '</ul>';
        detailsHtml += '<p>Il GSE <strong>non assume alcuna responsabilità</strong> per eventuali inesattezze, errori o discrepanze tra i valori stimati dal presente simulatore e gli importi effettivamente riconosciuti. ';
        detailsHtml += 'L\'ammissione all\'incentivo e la determinazione del suo ammontare sono subordinate all\'esito positivo dell\'istruttoria condotta dal GSE secondo i criteri stabiliti dal D.M. Conto Termico 3.0.</p>';
        detailsHtml += '</div>';

        // 6. Mostra i risultati (usa fallback se combo.total non è un numero valido ma i dettagli contengono valori)
        // Helper: parse numbers possibly formatted in Italian locale (e.g. "1.234,56")
        function parseLocaleNumber(v) {
            if (v === null || v === undefined) return NaN;
            if (typeof v === 'number') return v;
            let s = String(v).trim();
            if (s === '') return NaN;
            // Remove currency symbols, euro sign, non-breaking spaces and ordinary spaces
            s = s.replace(/€/g, '').replace(/\u00A0/g, '').replace(/\s+/g, '');
            // Remove any surrounding parentheses
            s = s.replace(/^\(|\)$/g, '');
            // If contains comma, treat '.' as thousands sep and ',' as decimal
            if (s.indexOf(',') >= 0) {
                const cleaned = s.replace(/\./g, '').replace(/,/g, '.');
                const n = Number(cleaned);
                return isNaN(n) ? NaN : n;
            }
            // Otherwise try plain Number after removing thousand separators like dots
            const n = Number(s.replace(/\./g, ''));
            return isNaN(n) ? NaN : n;
        }

        let displayTotal = parseLocaleNumber(combo.total);
        // If combo.total is not a finite positive number, compute fallback from details
        if ((!Number.isFinite(displayTotal) || displayTotal === 0) && Array.isArray(combo.details) && combo.details.length > 0) {
            const sumDetails = combo.details.reduce((s, d) => {
                const v = parseLocaleNumber(d.finalIncentive);
                return s + (Number.isFinite(v) ? v : 0);
            }, 0);
            if (sumDetails > 0) {
                console.warn('DEBUG: combo.total is invalid/zero — falling back to sum of details for display:', sumDetails);
                displayTotal = sumDetails;
                // Annotate detailsHtml so the user knows this was a fallback
                detailsHtml = '<div class="notice">⚠️ Nota: il valore mostrato in header è calcolato come somma dei dettagli poiché il totale combinato risultava non valido o 0.</div>' + detailsHtml;
            }
        }

        incentiveResultEl.textContent = `€ ${formatMoney(displayTotal)}`;
        resultDetailsEl.innerHTML = detailsHtml;
        resultsContainer.style.display = 'block';

        // Wiring toggle eventi
        resultDetailsEl.querySelectorAll('.details-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-target');
                const panel = document.getElementById(id);
                const isHidden = panel.hasAttribute('hidden');
                if (isHidden) { panel.removeAttribute('hidden'); btn.textContent = 'Nascondi dettagli'; }
                else { panel.setAttribute('hidden', ''); btn.textContent = 'Mostra dettagli'; }
            });
        });
    }

    // Avvia l'applicazione
    initialize();
}

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', initCalculator);

// Utilità formattazione/esportazione
function formatMoney(v){
    const n = Number(v)||0; return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatValue(v){
    if (typeof v === 'number') return formatMoney(v);
    if (typeof v === 'boolean') return v ? 'Sì' : 'No';
    return v;
}
// Helper per escape HTML (usato per visualizzare JSON di debug in modo sicuro)
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Normalizza i parametri: converte stringhe numeriche (es. "123.45" o "1.234,56") in Number
function normalizeParams(input) {
    if (input === null || input === undefined) return input;
    if (Array.isArray(input)) return input.map(normalizeParams);
    if (typeof input === 'object') {
        const out = {};
        for (const k of Object.keys(input)) {
            const v = input[k];
            if (typeof v === 'string') {
                // Prova a riconoscere numeri anche con separatore decimale comma
                const cleaned = v.replace(/\u00A0/g,'').trim();
                // Locale-aware normalization:
                // - If the string contains a comma, treat '.' as thousands sep and ',' as decimal (e.g. "1.234,56" -> "1234.56").
                // - If it contains no comma, assume '.' is the decimal separator and leave it (e.g. "102.68" -> "102.68").
                const dotNormalized = cleaned.indexOf(',') > -1 ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
                const num = Number(dotNormalized);
                out[k] = (!isNaN(num) && cleaned !== '') ? num : v;
            } else if (typeof v === 'object') {
                out[k] = normalizeParams(v);
            } else {
                out[k] = v;
            }
        }
        return out;
    }
    return input;
}

// Prepara i params per il calcolo: normalizza e popola campi derivati come `costo_specifico` se possibile.
function prepareParamsForCalculation(input) {
    const normalized = normalizeParams(input);
    if (!normalized || typeof normalized !== 'object') return normalized;

    // Se è una tabella di righe (es. righe_opache), normalizza ogni riga e calcola costo_specifico
    if (Array.isArray(normalized.righe_opache)) {
        normalized.righe_opache = normalized.righe_opache.map(row => {
            const r = normalizeParams(row);
            // If costo_specifico is missing, null, the string '0.00' or numerically zero,
            // but we have costo_totale and superficie, compute it from totals.
            const costoSpecMissing = r.costo_specifico === undefined || r.costo_specifico === null || r.costo_specifico === '0.00' || Number(r.costo_specifico) === 0;
            if (costoSpecMissing && r.costo_totale && r.superficie) {
                const sup = Number(r.superficie) || 0;
                if (sup > 0) r.costo_specifico = (Number(r.costo_totale) / sup);
            }
            return r;
        });
    }

    // Se campi singoli
    const costoSpecMissing = normalized.costo_specifico === undefined || normalized.costo_specifico === null || normalized.costo_specifico === '0.00' || Number(normalized.costo_specifico) === 0;
    if (costoSpecMissing && normalized.costo_totale && normalized.superficie) {
        const sup = Number(normalized.superficie) || 0;
        if (sup > 0) normalized.costo_specifico = (Number(normalized.costo_totale) / sup);
    }

    return normalized;
}
function downloadText(content, filename, mime){
    const blob = new Blob([content], { type: mime||'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

// Funzione per stampare il report della simulazione
function printReport() {
    // Aggiungi la data corrente al report
    const resultCard = document.getElementById('result-container');
    const currentDate = new Date().toLocaleDateString('it-IT', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    resultCard.setAttribute('data-print-date', currentDate);
    
    // Espandi tutti i dettagli prima della stampa
    const allDetailsToggles = document.querySelectorAll('.details-toggle');
    const detailsPanels = document.querySelectorAll('.details-panel');
    
    // Salva lo stato corrente
    const originalStates = Array.from(detailsPanels).map(panel => panel.style.display);
    
    // Espandi tutto
    detailsPanels.forEach(panel => {
        panel.style.display = 'block';
    });
    
    // Nascondi i toggle nella stampa
    allDetailsToggles.forEach(toggle => {
        toggle.style.display = 'none';
    });
    
    // Aggiungi info sul browser e timestamp al documento
    const printInfo = document.createElement('div');
    printInfo.className = 'print-info';
    printInfo.style.display = 'none';
    printInfo.innerHTML = `
        <div style="text-align: center; margin: 20px 0; padding: 20px; border-top: 2px solid #000;">
            <h3>SIMULAZIONE CONTO TERMICO 3.0</h3>
            <p><strong>Data simulazione:</strong> ${currentDate}</p>
            <p><em>Documento generato dal Simulatore Conto Termico 3.0<br>
            Questo è un calcolo indicativo. Per informazioni ufficiali consultare www.gse.it</em></p>
        </div>
    `;
    
    // Aggiungi stile per la stampa dell'info
    printInfo.innerHTML += `
        <style>
            @media print {
                .print-info {
                    display: block !important;
                }
            }
        </style>
    `;
    
    resultCard.appendChild(printInfo);
    
    // Avvia la stampa
    window.print();
    
    // Ripristina lo stato originale dopo la stampa
    setTimeout(() => {
        detailsPanels.forEach((panel, index) => {
            panel.style.display = originalStates[index];
        });
        
        allDetailsToggles.forEach(toggle => {
            toggle.style.display = '';
        });
        
        // Rimuovi l'elemento info
        if (printInfo.parentNode) {
            printInfo.parentNode.removeChild(printInfo);
        }
    }, 1000);
}
