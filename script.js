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

    // --- INIZIALIZZAZIONE ---

    function initialize() {
        populateSubjectTypes();
        populateBuildingCategories();
        addEventListeners();
    }

    function populateSubjectTypes() {
        subjectTypeSelect.innerHTML = '<option value="" disabled selected>Seleziona il soggetto ammesso...</option>';
        
        calculatorData.subjectTypes.forEach(subject => {
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
            }
            
            // Event listener per aggiornare lo stato e i campi computed
            if (col.type !== 'computed') {
                cellInput.addEventListener('change', (e) => {
                    const row = parseInt(e.target.dataset.rowIndex);
                    const colId = e.target.dataset.columnId;
                    
                    // Converti in numero se è un input number
                    let value = e.target.value;
                    if (e.target.type === 'number') {
                        value = parseFloat(value) || 0;
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
                    
                    // Converti in numero se è un input number
                    let value = e.target.value;
                    if (e.target.type === 'number') {
                        value = parseFloat(value) || 0;
                    }
                    
                    state.inputValues[interventionId][inputId][row][colId] = value;
                    
                    // Aggiorna campi computed nella stessa riga
                    updateTableRowComputed(interventionId, inputId, row, columns, tr);
                });
            }
            
            td.appendChild(cellInput);
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
            // populatePremiums(); // Rimosso: sezione premialità nascosta
        });

        // Step 3 removed from UI: no listener

        interventionsList.addEventListener('change', (e) => {
            if (e.target.name === 'intervention') {
                state.selectedInterventions = Array.from(
                    interventionsList.querySelectorAll('input[name="intervention"]:checked')
                ).map(input => input.value);
                updateDynamicInputs();
                // populatePremiums(); // Rimosso: sezione premialità nascosta
            }
        });

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
                const value = state.inputValues[intId]?.[input.id];
                const inputEl = document.querySelector(`#input-${intId}-${input.id}`);
                
                // Valida il campo
                const isEmpty = value === null || value === undefined || value === '';
                const isInvalid = input.type === 'number' && (isEmpty || isNaN(value) || value < (input.min || 0));
                
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

    function renderSubjectSpecificFields() {
        // Verifica se ci sono campi specifici per il soggetto selezionato
        const specificFields = calculatorData.subjectSpecificFields?.[state.selectedSubject];
        
        if (!specificFields || specificFields.length === 0) {
            // Nessun campo specifico, nascondi la sezione
            const existingContainer = document.getElementById('subject-specific-fields');
            if (existingContainer) {
                existingContainer.remove();
            }
            return;
        }

        // Crea una sezione dedicata nell'HTML dopo il building category
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
                    
                    inputEl.addEventListener('change', handleInputChange);
                    inputEl.addEventListener('keyup', handleInputChange);
                    
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
                    costoTot.max = String(Math.max(0, Math.round(maxCost)));
                    costoTot.setAttribute('max', String(Math.max(0, Math.round(maxCost))));
                    costoTot.title = `Spesa massima ammissibile: ${Math.round(maxCost).toLocaleString('it-IT')} € (Regole Applicative)`;
                    costoTot.placeholder = `Max: ${Math.round(maxCost).toLocaleString('it-IT')} €`;
                    
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
                            this.style.borderColor = '#d32f2f';
                            this.style.backgroundColor = '#ffebee';
                            this.setCustomValidity(`La spesa non può superare ${Math.round(currentMaxCost).toLocaleString('it-IT')} € (limite normativo)`);
                        } else {
                            this.style.borderColor = '';
                            this.style.backgroundColor = '';
                            this.setCustomValidity('');
                        }
                    });
                }
            }
        }
    }
    
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
        state.inputValues[intervention][inputId] = value;
        
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

        // Prepara input per calcolo combinato ufficiale (include premi per-intervento selezionati)
            const inputsByIntervention = {};
            const normalizedInputsByIntervention = {};
            state.selectedInterventions.forEach(intId => {
                const raw = { ...(state.inputValues[intId] || {}), premiums: { ...(state.inputValues[intId]?.premiums || {}) } };
                inputsByIntervention[intId] = raw;
                normalizedInputsByIntervention[intId] = prepareParamsForCalculation(raw);
            });

        // Prepara dati di contesto per incentivo al 100% automatico
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
            selectedPremiums: Array.isArray(state.selectedPremiums) ? state.selectedPremiums.slice() : [],
            globalPremiums: Array.isArray(state.selectedPremiums) ? state.selectedPremiums.slice() : [],
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

        // 4.b Riepilogo premi globali e massimali
        detailsHtml += '<h4>🎯 Premi Globali e Massimali:</h4>';
        if (combo.appliedGlobalPremiums && combo.appliedGlobalPremiums.length) {
            const globalItems = combo.appliedGlobalPremiums.map(p => {
                const note = p.note ? ` — ${escapeHtml(p.note)}` : '';
                if (!p.value) return `<li>${escapeHtml(p.name)}${note}</li>`;
                return `<li>${escapeHtml(p.name)}: <strong>€ ${formatMoney(p.value)}</strong>${note}</li>`;
            }).join('');
            detailsHtml += '<ul>' + globalItems + '</ul>';
        } else {
            detailsHtml += '<p class="notice">Nessuna premialità globale applicata.</p>';
        }
        if (combo.wasCapped) {
            detailsHtml += `<p class="notice">Tetto massimo per soggetto applicato: totale originario € ${formatMoney(combo.originalTotal)}, totale dopo cap € ${formatMoney(combo.total)}.</p>`;
        }
        
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

        // 6. Mostra i risultati (usa fallback se combo.total è zero ma i dettagli contengono valori)
        let displayTotal = combo.total || 0;
        if ((!displayTotal || displayTotal === 0) && Array.isArray(combo.details) && combo.details.length > 0) {
            const sumDetails = combo.details.reduce((s, d) => s + (Number(d.finalIncentive) || 0), 0);
            if (sumDetails > 0) {
                console.warn('DEBUG: combo.total is zero — falling back to sum of details for display:', sumDetails);
                displayTotal = sumDetails;
                // Annotate detailsHtml so the user knows this was a fallback
                detailsHtml = '<div class="notice">⚠️ Nota: il valore mostrato in header è calcolato come somma dei dettagli poiché il totale combinato risultava a 0.</div>' + detailsHtml;
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
                const dotNormalized = cleaned.replace(/\./g, '').replace(',', '.');
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
            if ((r.costo_specifico === undefined || r.costo_specifico === '0.00') && r.costo_totale && r.superficie) {
                const sup = Number(r.superficie) || 0;
                if (sup > 0) r.costo_specifico = (Number(r.costo_totale) / sup);
            }
            return r;
        });
    }

    // Se campi singoli
    if ((normalized.costo_specifico === undefined || normalized.costo_specifico === '0.00') && normalized.costo_totale && normalized.superficie) {
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
