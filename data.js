// Questo file contiene i dati di configurazione per il calcolatore.
// Modificando questo file è possibile aggiornare le opzioni, i parametri
// e le logiche di calcolo senza toccare il codice principale.

// Normative SCOP minima mapping (tabella ecodesign) — shared helper
const PUMP_SCOP_MIN_TABLE = {
    'aria/aria split/multisplit': 3.8,
    'aria/aria fixed double duct': 3.42,
    'aria/aria vrf/vrv': 3.5,
    'aria/aria rooftop': 3.2,
    'acqua/aria': 3.625,
    'aria/acqua': 2.825,
    'acqua/acqua': 3.325,
    'salamoia/aria': 3.2,
    'salamoia/acqua': 3.325
};

function getScopMinFromTipo(tipo) {
    const tcanon = String(tipo || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    for (const k of Object.keys(PUMP_SCOP_MIN_TABLE)) {
        const kcanon = String(k).toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        if (tcanon === kcanon || tcanon.indexOf(kcanon) !== -1 || kcanon.indexOf(tcanon) !== -1) {
            return PUMP_SCOP_MIN_TABLE[k];
        }
    }
    return 1;
}

const calculatorData = { // Updated: 2025-11-04 15:45:25
    // STEP 1: Soggetti Ammessi (chi ha disponibilità dell'immobile)
    subjectTypes: [
        {
            id: 'pa',
            name: 'Pubblica Amministrazione',
            description: 'PA ex D.Lgs 165/2001, enti pubblici, società in house, ex IACP, concessionari'
        },
        {
            id: 'ets_non_economic',
            name: 'ETS non economico',
            description: 'Enti del Terzo Settore iscritti al RUNTS che NON svolgono attività economica'
        },
        {
            id: 'person',
            name: 'Persona fisica o condominio',
            description: 'Soggetti privati non imprese'
        },
        {
            id: 'small_company',
            name: 'Piccola Impresa',
            description: 'Micro e piccole imprese secondo criteri UE (Raccomandazione 361/2003): <50 dipendenti e fatturato/bilancio <€10M. Maggiorazione +20% automatica su interventi ammissibili.'
        },
        {
            id: 'medium_company', 
            name: 'Media Impresa',
            description: 'Medie imprese secondo criteri UE (Raccomandazione 361/2003): <250 dipendenti e fatturato <€50M o bilancio <€43M. Maggiorazione +10% automatica su interventi ammissibili.'
        },
        {
            id: 'large_company',
            name: 'Grande Impresa',
            description: 'Grandi imprese che superano i limiti delle medie imprese secondo criteri UE'
        },
        {
            id: 'ets_economic',
            name: 'ETS economico',
            description: 'Enti del Terzo Settore iscritti al RUNTS che svolgono attività economica'
        }
    ],

    // STEP 2: Categorie catastali immobile
    buildingCategories: [
        {
            id: 'residential',
            name: 'Residenziale',
            description: 'Gruppo A (escluso A/8, A/9, A/10)',
            allowedSubjects: ['pa', 'ets_non_economic', 'person', 'small_company', 'medium_company', 'large_company', 'ets_economic'],
            note: 'PA/ETS: Titolo II solo su edifici di proprietà pubblica (es. ex IACP/ATER)'
        },
        {
            id: 'tertiary',
            name: 'Terziario',
            description: 'A/10, Gruppo B, C, D, E',
            allowedSubjects: ['pa', 'ets_non_economic', 'person', 'small_company', 'medium_company', 'large_company', 'ets_economic'],
            subcategories: [
                {
                    id: 'tertiary_generic',
                    name: 'Terziario generico',
                    description: 'Uffici, negozi, attività commerciali',
                    allowedSubjects: ['pa', 'ets_non_economic', 'person', 'small_company', 'large_company', 'ets_economic'],
                    art48ter: false
                },
                {
                    id: 'tertiary_school',
                    name: 'Scuola',
                    description: 'Edificio pubblico adibito a uso scolastico (non università)',
                    allowedSubjects: ['pa', 'ets_non_economic'],
                    art48ter: true,
                    note: 'Art. 48-ter: incentivo al 100% della spesa ammissibile'
                },
                {
                    id: 'tertiary_hospital',
                    name: 'Ospedale/Struttura sanitaria pubblica',
                    description: 'Strutture ospedaliere e sanitarie pubbliche del SSN (incluse residenziali, assistenza, cura, ricovero)',
                    allowedSubjects: ['pa', 'ets_non_economic'],
                    art48ter: true,
                    note: 'Art. 48-ter: incentivo al 100% della spesa ammissibile'
                },
                // 'tertiary_prison' rimosso: non più mostrato nelle categorie catastali
            ]
        }
    ],

    // STEP 3 (opzionale): Modalità di realizzazione
    implementationModes: [
        {
            id: 'direct',
            name: 'Intervento diretto',
            description: 'Il soggetto ammesso realizza direttamente l\'intervento e ne sostiene le spese.',
            allowedSubjects: ['pa', 'ets_non_economic', 'person', 'small_company', 'large_company', 'ets_economic'] // Tutti
        },
        {
            id: 'esco',
            name: 'Tramite ESCO/Contratto EPC',
            description: 'Energy Service Company che sostiene le spese per conto del soggetto ammesso.',
            allowedSubjects: ['pa', 'ets_non_economic', 'person', 'small_company', 'large_company', 'ets_economic'], // Tutti, ma con condizioni
            note: 'Per i privati in ambito RESIDENZIALE, è ammessa solo per interventi Titolo III con P > 70 kW o S > 20 m². Altrimenti, si usa il mandato all\'incasso.'
        },
        {
            id: 'energy_community',
            name: 'Tramite Comunità Energetica',
            description: 'Configurazione di autoconsumo collettivo o comunità energetica rinnovabile (CER).',
            allowedSubjects: ['pa', 'ets_non_economic', 'person', 'small_company', 'large_company', 'ets_economic'] // Tutti
        },
        {
            id: 'ppp',
            name: 'Partenariato Pubblico-Privato',
            description: 'Contratto PPP per interventi su immobili pubblici (non per soggetti privati).',
            allowedSubjects: ['pa', 'ets_non_economic'] // Solo PA ed enti assimilati
        }
    ],

    // Matrice di compatibilità: soggetto + categoria → operatorType interno (per calcoli)
    // Questo mantiene la compatibilità con la logica esistente
    operatorMatrix: {
        'pa_tertiary': {
            operatorTypeId: 'pa',
            maxIncentiveRate: 1.0,
            defaultRate: 0.65,
            allowedInterventions: 'all_titolo2_and_3'
        },
        'pa_tertiary_generic': {
            operatorTypeId: 'pa',
            maxIncentiveRate: 1.0,
            defaultRate: 0.65,
            allowedInterventions: 'all_titolo2_and_3',
            art48ter: false
        },
        'pa_tertiary_school': {
            operatorTypeId: 'pa',
            maxIncentiveRate: 1.0,
            defaultRate: 1.0, // 100% per Art. 48-ter
            allowedInterventions: 'all_titolo2_and_3',
            art48ter: true
        },
        'pa_tertiary_hospital': {
            operatorTypeId: 'pa',
            maxIncentiveRate: 1.0,
            defaultRate: 1.0, // 100% per Art. 48-ter
            allowedInterventions: 'all_titolo2_and_3',
            art48ter: true
        },
        // 'pa_tertiary_prison' removed (carceri non mostrate come sottocategoria)
        'pa_residential': {
            operatorTypeId: 'pa',
            maxIncentiveRate: 1.0,
            defaultRate: 0.65,
            allowedInterventions: 'all_titolo2_and_3',
            requiresPublicOwnership: true, // Titolo II richiede proprietà pubblica (es. ex IACP)
            note: 'Titolo II ammesso solo per edifici di proprietà pubblica (es. ex IACP/ATER su edilizia sociale)'
        },
        'ets_non_economic_tertiary': {
            operatorTypeId: 'pa',
            maxIncentiveRate: 1.0,
            defaultRate: 0.65,
            allowedInterventions: 'all_titolo2_and_3'
        },
        'ets_non_economic_tertiary_generic': {
            operatorTypeId: 'pa',
            maxIncentiveRate: 1.0,
            defaultRate: 0.65,
            allowedInterventions: 'all_titolo2_and_3',
            art48ter: false
        },
        'ets_non_economic_tertiary_school': {
            operatorTypeId: 'pa',
            maxIncentiveRate: 1.0,
            defaultRate: 1.0, // 100% per Art. 48-ter
            allowedInterventions: 'all_titolo2_and_3',
            art48ter: true
        },
        'ets_non_economic_tertiary_hospital': {
            operatorTypeId: 'pa',
            maxIncentiveRate: 1.0,
            defaultRate: 1.0, // 100% per Art. 48-ter
            allowedInterventions: 'all_titolo2_and_3',
            art48ter: true
        },
        'ets_non_economic_residential': {
            operatorTypeId: 'pa',
            maxIncentiveRate: 1.0,
            defaultRate: 0.65,
            allowedInterventions: 'all_titolo2_and_3',
            requiresPublicOwnership: true, // Titolo II richiede proprietà pubblica
            note: 'Titolo II ammesso solo per edifici di proprietà pubblica (equiparati a PA)'
        },
        'person_residential': {
            operatorTypeId: 'private_residential',
            maxIncentiveRate: 0.65,
            allowedInterventions: 'only_titolo3'
        },
        'person_tertiary': {
            operatorTypeId: 'private_tertiary_person',
            maxIncentiveRate: 0.65,
            allowedInterventions: 'all_titolo2_and_3'
        },
        'person_tertiary_generic': {
            operatorTypeId: 'private_tertiary_person',
            maxIncentiveRate: 0.65,
            allowedInterventions: 'all_titolo2_and_3',
            art48ter: false
        },
        'small_company_residential': {
            operatorTypeId: 'private_residential',
            maxIncentiveRate: 0.50,
            allowedInterventions: 'only_titolo3'
        },
        'small_company_tertiary': {
            operatorTypeId: 'private_tertiary_small',
            maxIncentiveRate: 0.50,
            allowedInterventions: 'all_titolo2_and_3'
        },
        'small_company_tertiary_generic': {
            operatorTypeId: 'private_tertiary_small',
            maxIncentiveRate: 0.50,
            allowedInterventions: 'all_titolo2_and_3',
            art48ter: false
        },
        'medium_company_residential': {
            operatorTypeId: 'private_residential',
            maxIncentiveRate: 0.50,
            allowedInterventions: 'only_titolo3'
        },
        'medium_company_tertiary': {
            operatorTypeId: 'private_tertiary_medium',
            maxIncentiveRate: 0.50,
            allowedInterventions: 'all_titolo2_and_3'
        },
        'medium_company_tertiary_generic': {
            operatorTypeId: 'private_tertiary_medium',
            maxIncentiveRate: 0.50,
            allowedInterventions: 'all_titolo2_and_3',
            art48ter: false
        },
        'large_company_residential': {
            operatorTypeId: 'private_residential',
            maxIncentiveRate: 0.30,
            allowedInterventions: 'only_titolo3'
        },
        'large_company_tertiary': {
            operatorTypeId: 'private_tertiary_large',
            maxIncentiveRate: 0.30,
            allowedInterventions: 'all_titolo2_and_3'
        },
        'large_company_tertiary_generic': {
            operatorTypeId: 'private_tertiary_large',
            maxIncentiveRate: 0.30,
            allowedInterventions: 'all_titolo2_and_3',
            art48ter: false
        },
        'ets_economic_residential': {
            operatorTypeId: 'private_residential',
            maxIncentiveRate: 0.50,
            allowedInterventions: 'only_titolo3'
        },
        'ets_economic_tertiary': {
            operatorTypeId: 'private_tertiary_small', // ETS economici equiparati alle piccole imprese
            maxIncentiveRate: 0.50,
            allowedInterventions: 'all_titolo2_and_3'
        },
        'ets_economic_tertiary_generic': {
            operatorTypeId: 'private_tertiary_small', // ETS economici equiparati alle piccole imprese
            maxIncentiveRate: 0.50,
            allowedInterventions: 'all_titolo2_and_3',
            art48ter: false
        }
    },

    // Helper per determinare la percentuale di incentivo (p) secondo le regole unificate
    // selectedInterventions: array di interventi selezionati (per valutare multi-intervento)
    // params: parametri specifici dell'intervento (contiene zona_climatica, premi, ecc.)
    // operatorType: tipo di operatore (pa, private_tertiary_..., ecc.)
    // contextData: dati di contesto (buildingSubcategory, is_comune, is_piccolo_comune, subjectType, implementationMode, selectedInterventions)
    // interventionId: id dell'intervento corrente (es. 'isolamento-opache') per regole specifiche
    determinePercentuale: function(selectedInterventions = [], params = {}, operatorType = '', contextData = {}, interventionId = '') {
        // Regole richieste:
        // 1) base 40%
        // 2) zona climatica E/F => 50%
        // 3) multi-intervento: 55% per 1.A (isolamento-opache) se insieme a almeno uno dei 2A/2B/2C/2E;
        //    55% per 1.B (sostituzione-infissi) solo se il multi-intervento è stato applicato al 1.A (cioè c'è 1A + almeno uno dei 2A/2B/2C/2E)
        // 4) premio prodotti-UE: incrementa p di +10 percentage point (es. 50% -> 60%), limitando al 100%
        // 5) p = 100% se edificio su scuole/ospedali/carceri (Art.48-ter) o Comune <15k (piccolo comune). Applichiamo questa regola indipendentemente dalla modalità di realizzazione.

        // Normalizza input
        const sel = Array.isArray(selectedInterventions) ? selectedInterventions : (contextData && contextData.selectedInterventions) ? contextData.selectedInterventions : [];
        const zona = params?.zona_climatica || params?.zonaClimatica || contextData?.zona_climatica || contextData?.zonaClimatica;
        const hasUE = (params?.premiums && params.premiums['prodotti-ue']) || (contextData?.globalPremiums && contextData.globalPremiums.includes && contextData.globalPremiums.includes('prodotti-ue')) || (contextData?.selectedPremiums && contextData.selectedPremiums.includes && contextData.selectedPremiums.includes('prodotti-ue')) || false;

        // Art.48-ter check
        const isArt48ter = contextData?.buildingSubcategory && ['tertiary_school', 'tertiary_hospital'].includes(contextData.buildingSubcategory);

        // Piccolo comune: applicazione semplificata (non richiediamo più implementationMode === 'direct')
        const isPiccoloComune = contextData?.is_comune === true && contextData?.is_edificio_comunale === true && contextData?.is_piccolo_comune === true && contextData?.subjectType === 'pa';
        // Escludiamo alcuni interventi (1.G e 1.H) dall'effetto "Piccolo Comune" 100%
        const piccoloComuneExclusions = ['infrastrutture-ricarica', 'fotovoltaico-accumulo'];
        const isPiccoloComuneEffective = isPiccoloComune && !piccoloComuneExclusions.includes(interventionId);

        // Multi-intervento: valutiamo la combinazione (Titolo II 1.A/1.B con almeno uno di Titolo III 2.A/2.B/2.C/2.E)
        // Use a dynamic detection of Titolo III interventions to avoid brittle hard-coded lists.
        // Heuristic: interventions whose description mentions 'Art. 8' or whose name starts with '2.'
        const titoloIIIset = Object.keys(this.interventions || {}).filter(id => {
            const it = this.interventions[id];
            if (!it) return false;
            const desc = (it.description || '').toString();
            const name = (it.name || '').toString();
            return desc.includes('Art. 8') || name.trim().startsWith('2.');
        });
        const hasTitoloIII = sel.some(id => titoloIIIset.includes(id));
        const has1A = sel.includes('isolamento-opache');
        const has1B = sel.includes('sostituzione-infissi');

        let p = 0.40;
        let pDesc = '40% (base)';

        // --- Special rule: NZEB (1.D) has its own percentuale logic ---
        if (interventionId === 'nzeb') {
            // NZEB: base 65%; if premio UE present -> 75%; but if Art.48-ter or piccolo comune -> 100%
            let p_nzeb = 0.65;
            let pDesc_nzeb = '65% (base NZEB)';

            if (isArt48ter || isPiccoloComuneEffective) {
                p_nzeb = 1.0;
                pDesc_nzeb = isArt48ter ? '100% (Art. 48-ter: edifici speciali)' : '100% (Comune < 15.000 abitanti)';
                return { p: p_nzeb, pDesc: pDesc_nzeb };
            }

            if (hasUE) {
                p_nzeb = 0.75;
                pDesc_nzeb = '75% (NZEB + premio Prodotti UE)';
            }

            // enforce cap at 100%
            if (p_nzeb > 1.0) p_nzeb = 1.0;
            return { p: p_nzeb, pDesc: pDesc_nzeb };
        }

        // --- New rule: for companies (imprese) apply simplified Category 1 logic ---
        // Applicable operatorType values for companies
        const companyTypes = ['private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large'];
        // Helper to check selected/global premiums/flags
        const hasFlag = (flag) => {
            return (params?.premiums && params.premiums[flag]) || (contextData?.globalPremiums && contextData.globalPremiums.includes && contextData.globalPremiums.includes(flag)) || (contextData?.selectedPremiums && contextData.selectedPremiums.includes && contextData.selectedPremiums.includes(flag)) || false;
        };

        // Identify Category 1 interventions by name starting with '1.'
        const isCategory1 = (this.interventions && this.interventions[interventionId] && (this.interventions[interventionId].name || '').toString().trim().startsWith('1.'));

        if (companyTypes.includes(operatorType) && isCategory1) {
            // Base percentages per company size
            const baseMap = {
                'private_tertiary_small': 0.45,
                'private_tertiary_medium': 0.35,
                'private_tertiary_large': 0.25
            };
            p = baseMap[operatorType] || 0.25;
            pDesc = `${Math.round(p*100)}% (base per imprese)`;

            // If more than one intervention from Category 1 selected, +5 percentage points
            const selectedCat1Count = sel.filter(id => this.interventions[id] && (this.interventions[id].name || '').toString().trim().startsWith('1.')).length;
            if (selectedCat1Count > 1) {
                p = +(p + 0.05).toFixed(2);
                pDesc = `${Math.round(p*100)}% (+5pp per multi-intervento categoria 1)`;
            }

            // Apply incremental flags (only when selectable for imprese): INCREMENTO INT3/INT4/INT5
            // Flags names expected: 'INCREMENTO_INT3', 'INCREMENTO_INT4', 'INCREMENTO_INT5'
            const inc3 = hasFlag('INCREMENTO_INT3');
            const inc4 = hasFlag('INCREMENTO_INT4');
            const inc5 = hasFlag('INCREMENTO_INT5');

            // First two flags are exclusive: if both present, take the larger (15pp over 5pp)
            let add = 0;
            if (inc3 || inc4) {
                add += (inc3 ? 0.15 : 0) + (inc4 ? 0.05 : 0);
                // enforce exclusivity: if both present, prefer the larger (keep 0.15)
                if (inc3 && inc4) add = 0.15;
            }
            if (inc5) add += 0.15;

            if (add > 0) {
                p = +(p + add).toFixed(2);
                pDesc = `${Math.round(p*100)}% (inclusi incrementi)`;
            }

            // Cap a 65% per regola generale per le imprese
            if (p > 0.65) {
                p = 0.65;
                // Aggiorna la descrizione per riflettere il limite massimo applicato
                pDesc = `${Math.round(p*100)}% (massimo applicabile per imprese)`;
            }

            return { p, pDesc };
        }

        // Special-case per 1.G: infrastrutture di ricarica -> base 30% (normativa Art.5.1.g)
        if (interventionId === 'infrastrutture-ricarica') {
            if (isArt48ter) {
                p = 1.0;
                const buildingNames = { 'tertiary_school': 'scuole', 'tertiary_hospital': 'ospedali' };
                pDesc = `100% (Art. 48-ter: ${buildingNames[contextData.buildingSubcategory] || 'edifici speciali'})`;
            } else {
                p = 0.30;
                pDesc = '30% (infrastrutture di ricarica - Art.5.1.g)';
            }
            // Se il premio UE fosse applicabile, lo applichiamo dopo (in genere non è applicato a 1.G)
            if (hasUE) {
                p = Math.min(1.0, +(p + 0.10).toFixed(2));
                pDesc = `${Math.round(p*100)}% (incluso premio Prodotti UE)`;
            }
            return { p, pDesc };
        }

        // Priorità: Art.48-ter o (piccolo comune quando applicabile) => 100%
        if (isArt48ter) {
            p = 1.0;
            const buildingNames = { 'tertiary_school': 'scuole', 'tertiary_hospital': 'ospedali' };
            pDesc = `100% (Art. 48-ter: ${buildingNames[contextData.buildingSubcategory] || 'edifici speciali'})`;
        } else if (isPiccoloComuneEffective) {
            p = 1.0;
            pDesc = '100% (Comune < 15.000 abitanti)';
        } else {
            // Multi-intervento: regole per 1.A e 1.B
            if (interventionId === 'isolamento-opache') {
                if (hasTitoloIII && has1A) {
                    p = 0.55;
                    pDesc = '55% (multi-intervento 1.A + 2.A/2.B/2.C/2.E)';
                }
            } else if (interventionId === 'sostituzione-infissi') {
                // 1.B: 55% solo se multi-intervento è stato applicato al 1.A (cioè esiste 1.A + almeno uno dei Titolo III)
                if (has1A && hasTitoloIII) {
                    p = 0.55;
                    pDesc = '55% (multi-intervento su 1.A, applicato anche a 1.B)';
                }
            }

            // Se non impostato da multi-intervento, valutiamo zona climatica e fallback base
            if (p === 0.40) {
                // Zona climatica E/F => 50%
                if (zona === 'E' || zona === 'F') {
                    p = 0.50;
                    pDesc = `50% (zona climatica ${zona})`;
                } else {
                    // Default: base 40%
                    p = 0.40;
                    pDesc = '40% (base)';
                }
            }
        }

        // Premio UE: incrementa la percentuale di incentivo di +10 punti percentuali (es. 0.50 -> 0.60)
        if (hasUE) {
            p = Math.min(1.0, +(p + 0.10).toFixed(2));
            pDesc = `${Math.round(p*100)}% (incluso premio Prodotti UE)`;
        }

        return { p, pDesc };
    },

    // Campi aggiuntivi specifici per soggetto e modalità di realizzazione
    // NOTA: La maggiorazione per comuni sotto 15.000 abitanti si applica SOLO quando:
    // 1. Il soggetto è un Comune (non altra PA)
    // 2. Modalità di realizzazione: Intervento Diretto
    // 3. L'edificio è di proprietà E utilizzato dal Comune
    // Riferimento: Regole Applicative CT 3.0, paragrafo 586
    subjectSpecificFields: {
        // Campi specifici per i soggetti (es. PA)
        // Spostiamo qui i campi relativi al Comune/piccolo comune in modo che
        // siano sempre visibili quando il soggetto selezionato è una PA,
        // indipendentemente dalla modalità di realizzazione.
        pa: [
            {
                id: 'is_comune',
                name: 'Il soggetto richiedente è un Comune?',
                type: 'checkbox',
                help: 'Seleziona se sei un Comune (non altra PA come Regione, Provincia, ASL, Università, etc.)',
                optional: false,
                affects_incentive: false,
                shows: ['is_edificio_comunale'] // Mostra il campo successivo solo se checked
            },
            {
                id: 'is_edificio_comunale',
                name: 'L\'edificio è di proprietà del Comune ed è utilizzato dallo stesso Comune?',
                type: 'checkbox',
                help: 'Entrambe le condizioni devono essere vere: proprietà comunale E utilizzo da parte del Comune',
                optional: true,
                affects_incentive: false,
                visible_if: { field: 'is_comune', value: true },
                shows: ['is_piccolo_comune']
            },
            {
                id: 'is_piccolo_comune',
                name: 'Il Comune ha popolazione inferiore a 15.000 abitanti?',
                type: 'checkbox',
                help: 'Se SÌ, si applica automaticamente l\'incentivo al 100% della spesa ammissibile. Dovrai attestare questa condizione in fase di richiesta al GSE.',
                optional: true,
                affects_incentive: true,
                visible_if: { field: 'is_edificio_comunale', value: true }
            }
        ]
    },

    // Campi specifici che compaiono dopo la selezione della modalità di realizzazione
    implementationModeFields: {
        
        // Campi per dichiarazione dimensionamento imprese (piccole/medie)
        small_company_all: [
            {
                id: 'conferma_piccola_impresa',
                name: 'Conferma che l\'impresa rientra nella definizione di piccola impresa',
                type: 'checkbox',
                help: 'Secondo la Raccomandazione UE 361/2003: <50 dipendenti E (fatturato annuo <€10M O bilancio <€10M). Dovrai attestare questa condizione in fase di richiesta al GSE.',
                optional: false,
                affects_incentive: true
            },
            {
                id: 'dipendenti_piccola',
                name: 'Numero di dipendenti',
                type: 'number',
                min: 0,
                max: 49,
                help: 'Numero massimo: 49 dipendenti (media annua)',
                optional: false,
                affects_incentive: false
            },
            {
                id: 'fatturato_piccola',
                name: 'Fatturato annuo (€)',
                type: 'number',
                min: 0,
                max: 10000000,
                help: 'Massimo €10.000.000 annui',
                optional: true,
                affects_incentive: false
            }
        ],
        
        medium_company_all: [
            {
                id: 'conferma_media_impresa',
                name: 'Conferma che l\'impresa rientra nella definizione di media impresa',
                type: 'checkbox',
                help: 'Secondo la Raccomandazione UE 361/2003: <250 dipendenti E (fatturato annuo <€50M O bilancio <€43M). Dovrai attestare questa condizione in fase di richiesta al GSE.',
                optional: false,
                affects_incentive: true
            },
            {
                id: 'dipendenti_media',
                name: 'Numero di dipendenti',
                type: 'number',
                min: 50,
                max: 249,
                help: 'Numero da 50 a 249 dipendenti (media annua)',
                optional: false,
                affects_incentive: false
            },
            {
                id: 'fatturato_media',
                name: 'Fatturato annuo (€)',
                type: 'number',
                min: 10000001,
                max: 50000000,
                help: 'Da €10.000.001 a €50.000.000 annui',
                optional: true,
                affects_incentive: false
            }
        ]
    },

    // Note normative importanti per l'applicazione corretta del decreto
    regulatoryNotes: {
        pa_residential_titolo2: {
            title: 'PA/ETS su edifici residenziali - Interventi Titolo II',
            text: 'Gli interventi di efficienza energetica (Titolo II) su edifici residenziali sono ammessi per PA e ETS non economici SOLO quando l\'edificio è di proprietà pubblica. Esempio: ex IACP/ATER su edilizia sociale. Riferimento: Paragrafo 12.10.4 delle Regole Applicative.',
            severity: 'warning',
            applies_to: ['pa_residential', 'ets_non_economic_residential']
        },
        private_residential_restrictions: {
            title: 'Soggetti Privati su edifici residenziali',
            text: 'I soggetti privati (persone fisiche, condomini, imprese, ETS economici) su edifici residenziali possono accedere SOLO agli interventi del Titolo III (fonti rinnovabili). Gli interventi del Titolo II (efficienza energetica) sono esclusi. Riferimento: Tabella ammissibilità, righe 335-385 Regole Applicative.',
            severity: 'info',
            applies_to: ['person_residential', 'sme_residential', 'large_company_residential', 'ets_economic_residential']
        },
        public_buildings_special: {
            title: 'Edifici pubblici speciali (scuole, ospedali)',
            text: 'Per interventi realizzati su edifici pubblici adibiti a uso scolastico, strutture ospedaliere e sanitarie del SSN, l\'incentivo è al 100% delle spese ammissibili. Riferimento: Art. 48-ter D.L. 104/2020 - Paragrafo 12.11 Regole Applicative.',
            severity: 'info',
            applies_to: ['pa_tertiary', 'pa_residential', 'ets_non_economic_tertiary', 'ets_non_economic_residential']
        },
        esco_residential_thresholds: {
            title: 'ESCO su edifici residenziali - Soglie minime',
            text: 'In ambito residenziale, l\'utilizzo di ESCO tramite contratti EPC/Servizio Energia richiede soglie minime: ≥70 kW per impianti climatizzazione, ≥20 m² per solare termico. Sotto tali soglie: solo mandato irrevocabile all\'incasso. Riferimento: Paragrafo 3.5 Regole Applicative.',
            severity: 'info',
            applies_to: ['person_residential', 'sme_residential', 'large_company_residential']
        }
    },

    // Manteniamo operatorTypes per retrocompatibilità con i test
    operatorTypes: [
        {
            id: 'pa',
            name: 'Pubbliche Amministrazioni ed ETS non economici',
            maxIncentiveRate: 1.0,
            defaultRate: 0.65,
            description: 'Include tutte le PA ex D.Lgs 165/2001 e ETS non economici'
        },
        {
            id: 'private_tertiary_person',
            name: 'Soggetti Privati - Ambito Terziario (Persone fisiche, condomini)',
            maxIncentiveRate: 0.65,
            description: 'Persone fisiche e soggetti non imprese per edifici categoria catastale terziaria (A/10, B, C, D, E)'
        },
        {
            id: 'private_tertiary_small',
            name: 'Piccole Imprese ed ETS economici - Ambito Terziario',
            maxIncentiveRate: 0.50,
            description: 'Micro e piccole imprese ed ETS economici - maggiorazione +20% automatica (Titolo V)'
        },
        {
            id: 'private_tertiary_medium',
            name: 'Medie Imprese - Ambito Terziario',
            maxIncentiveRate: 0.50,
            description: 'Medie imprese - maggiorazione +10% automatica (Titolo V)'
        },
        {
            id: 'private_tertiary_large',
            name: 'Grandi Imprese - Ambito Terziario',
            maxIncentiveRate: 0.30,
            description: 'Grandi imprese - limiti Titolo V applicabili'
        },
        {
            id: 'private_residential',
            name: 'Soggetti Privati - Ambito Residenziale',
            maxIncentiveRate: 0.65,
            description: 'Persone fisiche, condomini per edifici categoria catastale residenziale (Gruppo A escluso A/8, A/9, A/10)'
        }
    ],

    // Zone climatiche e relativi coefficienti
    climateZones: {
        A: { gdd: 600, coefficient: 0.8 },
        B: { gdd: 900, coefficient: 0.9 },
        C: { gdd: 1400, coefficient: 1.0 },
        D: { gdd: 2100, coefficient: 1.1 },
        E: { gdd: 3000, coefficient: 1.3 },
        F: { gdd: 3000, coefficient: 1.5 }
    },

    // Definizione degli interventi incentivabili (Art. 5 e Art. 8)
    interventions: {
        // --- INTERVENTI DI EFFICIENZA ENERGETICA (Art. 5) ---
        'isolamento-opache': {
            name: '1.A - Isolamento termico di superfici opache',
            description: 'Art. 5, comma 1, lett. a) - Coibentazione delle superfici opache dell\'edificio (pareti, coperture, pavimenti) per ridurre le dispersioni termiche e migliorare l\'efficienza energetica.',
            category: 'Efficienza Energetica',
            allowedOperators: ['pa', 'private_tertiary_person', 'private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large'],
            restrictionNote: 'SOLO per PA/ETS non economici e Soggetti Privati su edifici TERZIARIO. NO ambito residenziale.',
            inputs: [
                {
                    id: 'righe_opache',
                    name: 'Tabella strutture opache',
                    type: 'table',
                    columns: [
                        {
                            id: 'tipologia_struttura',
                            name: 'Tipologia',
                            type: 'select',
                            options: [
                                { value: 'copertura_esterno', label: 'i. Copertura - Isolamento esterno', cmax: 300 },
                                { value: 'copertura_interno', label: 'i. Copertura - Isolamento interno', cmax: 150 },
                                { value: 'copertura_ventilata', label: 'i. Copertura - Copertura ventilata', cmax: 350 },
                                { value: 'pavimento_esterno', label: 'ii. Pavimento - Isolamento esterno', cmax: 170 },
                                { value: 'pavimento_interno', label: 'ii. Pavimento - Isolamento interno', cmax: 150 },
                                { value: 'parete_esterno', label: 'iii. Parete perimetrale - Isolamento esterno', cmax: 200 },
                                { value: 'parete_interno', label: 'iii. Parete perimetrale - Isolamento interno', cmax: 100 },
                                { value: 'parete_ventilata', label: 'iii. Parete perimetrale - Parete ventilata', cmax: 250 }
                            ]
                        },
                        {
                            id: 'superficie',
                            name: 'Superficie (m²)',
                            type: 'number',
                            min: 0
                        },
                        {
                            id: 'costo_totale',
                            name: 'Costo totale (€)',
                            type: 'number',
                            min: 0
                        },
                        {
                            id: 'costo_specifico',
                            name: 'Costo specifico (€/m²)',
                            type: 'computed',
                            compute: (riga) => {
                    if (!riga.costo_totale || !riga.superficie) return 0;
                        return Number((riga.costo_totale / riga.superficie).toFixed(2));
                            }
                        }
                    ],
                    help: 'Inserisci una riga per ogni tipologia di struttura opaca isolata. Puoi aggiungere più tipologie.'
                },
                { 
                    id: 'zona_climatica', 
                    name: 'Zona climatica', 
                    type: 'select', 
                    options: ['A', 'B', 'C', 'D', 'E', 'F'],
                    help: 'Zona climatica in cui si trova l\'edificio (influisce sulla percentuale di incentivo per zone E ed F)'
                }
            ],
            calculate: (params, operatorType, contextData) => {
                const { righe_opache, zona_climatica } = params;
                
                // Se non ci sono righe o la zona climatica, return 0
                if (!righe_opache || !Array.isArray(righe_opache) || righe_opache.length === 0 || !zona_climatica) return 0;
                
                // Mappa delle tipologie e dei loro Cmax
                const tipologieOptions = [
                    { value: 'copertura_esterno', label: 'i. Copertura - Isolamento esterno', cmax: 300 },
                    { value: 'copertura_interno', label: 'i. Copertura - Isolamento interno', cmax: 150 },
                    { value: 'copertura_ventilata', label: 'i. Copertura - Copertura ventilata', cmax: 350 },
                    { value: 'pavimento_esterno', label: 'ii. Pavimento - Isolamento esterno', cmax: 170 },
                    { value: 'pavimento_interno', label: 'ii. Pavimento - Isolamento interno', cmax: 150 },
                    { value: 'parete_esterno', label: 'iii. Parete perimetrale - Isolamento esterno', cmax: 200 },
                    { value: 'parete_interno', label: 'iii. Parete perimetrale - Isolamento interno', cmax: 100 },
                    { value: 'parete_ventilata', label: 'iii. Parete perimetrale - Parete ventilata', cmax: 250 }
                ];
                
                // Determina la percentuale base
                const isArt48ter = contextData?.buildingSubcategory && 
                                  ['tertiary_school', 'tertiary_hospital'].includes(contextData.buildingSubcategory);
                
                // Piccoli comuni < 15.000 abitanti
                const isPiccoloComune = contextData?.is_comune === true && 
                                       contextData?.is_edificio_comunale === true &&
                                       contextData?.is_piccolo_comune === true &&
                                       contextData?.subjectType === 'pa' &&
                                       contextData?.implementationMode === 'direct';
                
                // Determina la percentuale centralizzata (include eventuale premio UE)
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData, 'isolamento-opache');
                const percentuale = det.p;
                
                // Calcola l'incentivo totale sommando tutte le righe
                let incentivoTotale = 0;
                
                righe_opache.forEach(riga => {
                    const { tipologia_struttura, superficie, costo_totale } = riga;
                    
                    if (!tipologia_struttura || !superficie || !costo_totale || superficie <= 0) return;
                    
                    // Trova il Cmax per questa tipologia
                    const tipologiaData = tipologieOptions.find(t => t.value === tipologia_struttura);
                    const cmax = tipologiaData?.cmax || 300;
                    
                    // Calcola costo specifico
                    const costo_specifico = costo_totale / superficie;
                    
                    // Applica il massimale
                    const costoEffettivo = Math.min(costo_specifico, cmax);
                    
                    // Calcola incentivo per questa riga (premio UE già incluso in percentuale quando applicabile)
                    let incentivoRiga = percentuale * costoEffettivo * superficie;
                    
                    incentivoTotale += incentivoRiga;
                    
                    // Log per debug
                    if (costo_specifico > cmax) {
                        console.warn(`⚠️  Riga ${tipologiaData?.label}: Costo specifico (${costo_specifico.toFixed(2)} €/m²) supera Cmax (${cmax} €/m²)`);
                    }
                });
                
                // Tetto massimo Imas = 1.000.000 €
                const tettoMassimo = 1000000;
                return Math.min(incentivoTotale, tettoMassimo);
            },
            explain: (params, operatorType, contextData) => {
                const { righe_opache, zona_climatica } = params;
                
                if (!righe_opache || !Array.isArray(righe_opache) || righe_opache.length === 0) {
                    return {
                        result: 0,
                        formula: 'Nessuna riga inserita',
                        variables: {},
                        steps: ['Inserire almeno una tipologia di struttura opaca']
                    };
                }
                
                // Mappa delle tipologie
                const tipologieOptions = [
                    { value: 'copertura_esterno', label: 'i. Copertura - Isolamento esterno', cmax: 300 },
                    { value: 'copertura_interno', label: 'i. Copertura - Isolamento interno', cmax: 150 },
                    { value: 'copertura_ventilata', label: 'i. Copertura - Copertura ventilata', cmax: 350 },
                    { value: 'pavimento_esterno', label: 'ii. Pavimento - Isolamento esterno', cmax: 170 },
                    { value: 'pavimento_interno', label: 'ii. Pavimento - Isolamento interno', cmax: 150 },
                    { value: 'parete_esterno', label: 'iii. Parete perimetrale - Isolamento esterno', cmax: 200 },
                    { value: 'parete_interno', label: 'iii. Parete perimetrale - Isolamento interno', cmax: 100 },
                    { value: 'parete_ventilata', label: 'iii. Parete perimetrale - Parete ventilata', cmax: 250 }
                ];
                
                // Determina percentuale
                const isArt48ter = contextData?.buildingSubcategory && 
                                  ['tertiary_school', 'tertiary_hospital'].includes(contextData.buildingSubcategory);
                
                // Piccoli comuni < 15.000 abitanti
                const isPiccoloComune = contextData?.is_comune === true && 
                                       contextData?.is_edificio_comunale === true &&
                                       contextData?.is_piccolo_comune === true &&
                                       contextData?.subjectType === 'pa' &&
                                       contextData?.implementationMode === 'direct';
                
                // Determina percentuale centralmente (include eventuale premio Prodotti UE)
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData || {}, 'isolamento-opache');
                const percentuale = det.p;
                const percentualeDesc = det.pDesc;
                const steps = [];
                let incentivoTotale = 0;

                // Verifica se l'utente ha selezionato il premio Prodotti UE (solo per spiegazione)
                const ueSelected = !!(params?.premiums?.['prodotti-ue'] || (contextData?.selectedPremiums && contextData.selectedPremiums.includes && contextData.selectedPremiums.includes('prodotti-ue')));

                steps.push(`Zona climatica: ${zona_climatica}`);
                steps.push(`Percentuale incentivazione: ${percentualeDesc}`);
                steps.push(ueSelected ? `  Premio Prodotti UE: incluso nella percentuale di incentivazione (p=${percentuale.toFixed(2)})` : `  Premio Prodotti UE: non applicato`);
                steps.push(`---`);

                righe_opache.forEach((riga, index) => {
                    const { tipologia_struttura, superficie, costo_totale } = riga;
                    
                    if (!tipologia_struttura || !superficie || !costo_totale || superficie <= 0) {
                        steps.push(`Riga ${index + 1}: dati incompleti`);
                        return;
                    }
                    
                    const tipologiaData = tipologieOptions.find(t => t.value === tipologia_struttura);
                    const cmax = tipologiaData?.cmax || 300;
                    const tipologiaLabel = tipologiaData?.label || 'Sconosciuta';
                    
                    const costo_specifico = costo_totale / superficie;
                    const costoEffettivo = Math.min(costo_specifico, cmax);
                    const superaMassimale = costo_specifico > cmax;
                    
                    // Il premio UE è già stato integrato nella percentuale (det.p),
                    // quindi non moltiplichiamo nuovamente per 1.10. Tuttavia mostriamo
                    // se l'utente ha selezionato il premio per chiarezza nella spiegazione.
                    const ueSelected = !!(params?.premiums?.['prodotti-ue'] || (contextData?.selectedPremiums && contextData.selectedPremiums.includes && contextData.selectedPremiums.includes('prodotti-ue')));
                    let incentivoRiga = percentuale * costoEffettivo * superficie;
                    incentivoTotale += incentivoRiga;
                    
                    steps.push(`Riga ${index + 1}: ${tipologiaLabel}`);
                    steps.push(`  Superficie: ${superficie.toFixed(2)} m²`);
                    steps.push(`  Costo totale: ${costo_totale.toLocaleString('it-IT')} €`);
                    steps.push(`  C = ${costo_totale.toLocaleString('it-IT')} / ${superficie.toFixed(2)} = ${costo_specifico.toFixed(2)} €/m²`);
                    steps.push(superaMassimale 
                        ? `  ⚠️  C supera Cmax! Uso Cmax=${cmax} €/m²` 
                        : `  ✓ C (${costo_specifico.toFixed(2)}) ≤ Cmax (${cmax})`
                    );
                    steps.push(`  Incentivo riga = ${percentuale.toFixed(2)} × ${costoEffettivo.toFixed(2)} × ${superficie.toFixed(2)} = ${incentivoRiga.toLocaleString('it-IT', {minimumFractionDigits: 2})} €`);
                   
                    steps.push(`---`);
                });
                
                const imas = 1000000;
                const finale = Math.min(incentivoTotale, imas);
                
                steps.push(`Totale = ${incentivoTotale.toLocaleString('it-IT', {minimumFractionDigits: 2})} €`);
                steps.push(`Finale = min(${incentivoTotale.toLocaleString('it-IT', {minimumFractionDigits: 2})}, ${imas.toLocaleString('it-IT')}) = ${finale.toLocaleString('it-IT', {minimumFractionDigits: 2})} €`);
                
                return {
                    result: finale,
                    formula: `Itot = Σ [p × min(Ci, Cmax,i) × Sint,i]${ueSelected ? ' (Prodotti UE inclusi nella percentuale)' : ''}`,
                    variables: {
                        NumeroRighe: righe_opache.length,
                        p: percentuale,
                        pDesc: percentualeDesc,
                        ZonaClimatica: zona_climatica,
                        UE: ueSelected,
                        Imas: imas
                    },
                    steps
                };
            }
        },
        'sostituzione-infissi': {
            name: '1.B - Sostituzione di chiusure trasparenti (infissi)',
            description: 'Art. 5, comma 1, lett. b) - Sostituzione di serramenti e infissi esistenti con nuovi a maggiore efficienza energetica per ridurre le dispersioni termiche attraverso le superfici vetrate.',
            category: 'Efficienza Energetica',
                allowedOperators: ['pa', 'private_tertiary_person', 'private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large'],
                restrictionNote: 'SOLO per PA/ETS non economici e Soggetti Privati su edifici TERZIARIO. NO ambito residenziale.',
            inputs: [
                { id: 'superficie', name: 'Superficie infissi Sint (m²)', type: 'number', min: 0 },
                { id: 'costo_totale', name: 'Costo totale (€)', type: 'number', min: 0 },
                { 
                    id: 'costo_specifico', 
                    name: 'Costo specifico (€/m²)', 
                    type: 'computed',
                    compute: (params) => {
                        if (!params.costo_totale || !params.superficie) return 0;
                        return Number((params.costo_totale / params.superficie).toFixed(2));
                    }
                },
                { id: 'zona_climatica', name: 'Zona climatica', type: 'select', options: ['A', 'B', 'C', 'D', 'E', 'F'] }
            ],
            calculate: (params, operatorType, contextData) => {
                const { superficie, costo_specifico, zona_climatica } = params;
                // Treat numeric zero as valid; only bail out when missing (undefined/null)
                if (!superficie || costo_specifico === undefined || costo_specifico === null) return 0;
                
                // Cmax = 700 €/m² per zone A,B,C o 800 €/m² per zone D,E,F (secondo tabella ufficiale)
                const cmaxInfissi = (zona_climatica === 'D' || zona_climatica === 'E' || zona_climatica === 'F') ? 800 : 700;
                const costoNum = (costo_specifico === undefined || costo_specifico === null) ? 0 : Number(costo_specifico);
                const costoEffettivo = Math.min(costoNum, cmaxInfissi);
                
                // Determina la percentuale base
                const isArt48ter = contextData?.buildingSubcategory && 
                                  ['tertiary_school', 'tertiary_hospital'].includes(contextData.buildingSubcategory);
                
                // Piccoli comuni < 15.000 abitanti
                const isPiccoloComune = contextData?.is_comune === true && 
                                       contextData?.is_edificio_comunale === true &&
                                       contextData?.is_piccolo_comune === true &&
                                       contextData?.subjectType === 'pa' &&
                                       contextData?.implementationMode === 'direct';
                
                // Verifica multi-intervento (55% per 1.A/1.B + 2.A/2.B/2.C/2.E)
                const isMultiIntervento = contextData?.multiInterventionBonus === true;
                
                
                // PRIORITÀ: Art. 48-ter e piccoli comuni hanno precedenza (100%)
                // Determina percentuale centralizzata (include eventuale premio UE)
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData, 'sostituzione-infissi');
                const percentuale = det.p;

                let incentivo = percentuale * costoEffettivo * superficie;
                // percentuale include già il premio UE se applicabile; non moltiplichiamo ulteriormente
                
                // Imas = 500.000 €
                const tettoMassimo = 500000;
                return Math.min(incentivo, tettoMassimo);
            },
            explain: (params, operatorType, contextData) => {
                const { superficie, costo_specifico, zona_climatica } = params;
                
                // Cmax = 700 €/m² per zone A,B,C o 800 €/m² per zone D,E,F (secondo tabella ufficiale)
                const cmaxInfissi = (zona_climatica === 'D' || zona_climatica === 'E' || zona_climatica === 'F') ? 800 : 700;
                const costoNum = (costo_specifico === undefined || costo_specifico === null) ? 0 : Number(costo_specifico);
                const costoEffettivo = Math.min(costoNum, cmaxInfissi);
                
                // Determina percentuale centralmente (include eventuale premio Prodotti UE)
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData || {}, 'sostituzione-infissi');
                const percentuale = det.p;
                const percentualeDesc = det.pDesc;

                const base = percentuale * costoEffettivo * (superficie || 0);
                // UE: verifica richiesta e se effettivamente applicata (la percentuale può essere già al 100%)
                const ueRequested = !!(params?.premiums?.['prodotti-ue'] || (contextData?.selectedPremiums && contextData.selectedPremiums.includes && contextData.selectedPremiums.includes('prodotti-ue')));
                const ueApplicata = ueRequested && percentuale < 1.0;
                const imas = 500000;
                const finale = Math.min(base, imas);
                
                const superaCmax = (Number(costo_specifico || 0) > cmaxInfissi);
                
                return {
                    result: finale,
                    formula: `Itot = p × min(C, ${cmaxInfissi}) × Sint; Imas=${imas.toLocaleString('it-IT')}€`,
                    variables: { 
                        p: percentuale, 
                        pDesc: percentualeDesc,
                        C: costo_specifico || 0, 
                        Cmax: cmaxInfissi,
                        Ceff: costoEffettivo, 
                        Sint: superficie || 0, 
                        UE: ueApplicata,
                        ZonaClimatica: zona_climatica,
                        Imas: imas 
                    },
                    steps: [
                        `Zona climatica: ${zona_climatica}`,
                        `Percentuale incentivazione: ${percentualeDesc}`,
                        `Cmax = ${cmaxInfissi} €/m²`,
                        `C = ${(costo_specifico||0).toFixed(2)} €/m²`,
                        superaCmax 
                            ? `⚠️  C supera Cmax! Uso Cmax=${cmaxInfissi} €/m²` 
                            : `✓ C (${(costo_specifico||0).toFixed(2)}) ≤ Cmax (${cmaxInfissi})`,
                        `Ceff = min(${(costo_specifico||0).toFixed(2)}, ${cmaxInfissi}) = ${costoEffettivo.toFixed(2)} €/m²`,
                        `Base = ${percentuale.toFixed(2)} × ${costoEffettivo.toFixed(2)} × ${(superficie||0).toFixed(2)} = ${base.toFixed(2)} €`,
                        ueApplicata 
                            ? `Premio Prodotti UE: incluso nella percentuale di incentivazione (p=` 
                            : (ueRequested && percentuale >= 1.0)
                                ? `UE: non applicata (già al 100%)`
                                : `UE: non applicata`,
                        `Finale = min(${base.toFixed(2)}, ${imas.toLocaleString('it-IT')}) = ${finale.toLocaleString('it-IT', {minimumFractionDigits: 2})} €`
                    ]
                };
            }
        },
        'schermature-solari': {
            name: '1.C - Installazione di schermature e ombreggiamenti',
            description: 'Art. 5, comma 1, lett. c) - Installazione di sistemi di schermatura solare (tende, veneziane, pellicole) per ridurre l\'apporto termico solare e migliorare il comfort estivo.',
            category: 'Efficienza Energetica',
                allowedOperators: ['pa', 'private_tertiary_person', 'private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large'],
                restrictionNote: 'SOLO per PA/ETS non economici e Soggetti Privati su edifici TERZIARIO. NO ambito residenziale.',
            inputs: [
                {
                    id: 'righe_schermature',
                    name: 'Tabella schermature solari',
                    type: 'table',
                    columns: [
                        {
                            id: 'tipologia_schermatura',
                            name: 'Tipologia',
                            type: 'select',
                            options: [
                                { value: 'Schermature/ombreggiamento', label: 'Schermature/ombreggiamento', cmax: 250, imax: 90000 },
                                { value: 'Meccanismi automatici', label: 'Meccanismi automatici', cmax: 50, imax: 10000 },
                                { value: 'Filtrazione solare selettiva non riflettente', label: 'Filtrazione solare selettiva non riflettente', cmax: 130, imax: 30000 },
                                { value: 'Filtrazione solare selettiva riflettente', label: 'Filtrazione solare selettiva riflettente', cmax: 80, imax: 30000 }
                            ]
                        },
                        {
                            id: 'superficie',
                            name: 'Superficie (m²)',
                            type: 'number',
                            min: 0
                        },
                        {
                            id: 'costo_totale',
                            name: 'Costo totale (€)',
                            type: 'number',
                            min: 0
                        },
                        {
                            id: 'costo_specifico',
                            name: 'Costo specifico (€/m²)',
                            type: 'computed',
                            compute: (riga) => {
                                if (!riga.costo_totale || !riga.superficie) return 0;
                                return Number((riga.costo_totale / riga.superficie).toFixed(2));
                            }
                        }
                    ],
                    help: 'Inserisci una riga per ogni tipologia di schermatura solare. Puoi aggiungere più tipologie.'
                }
            ],
            calculate: (params, operatorType, contextData) => {
                const { righe_schermature } = params;
                if (!righe_schermature || !Array.isArray(righe_schermature) || righe_schermature.length === 0) return 0;

                let incentivoTotale = 0;
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData, 'schermature-solari');
                const percentuale = det.p;

                righe_schermature.forEach(riga => {
                    const { tipologia_schermatura, superficie, costo_totale } = riga;
                    if (!tipologia_schermatura || !superficie || !costo_totale || superficie <= 0) return 0;

                    const tipologiaData = [
                        { value: 'Schermature/ombreggiamento', cmax: 250, imax: 90000 },
                        { value: 'Meccanismi automatici', cmax: 50, imax: 10000 },
                        { value: 'Filtrazione solare selettiva non riflettente', cmax: 130, imax: 30000 },
                        { value: 'Filtrazione solare selettiva riflettente', cmax: 80, imax: 30000 }
                    ].find(t => t.value === tipologia_schermatura);

                    if (!tipologiaData) return 0;

                    const costo_specifico = costo_totale / superficie;
                    const costoEffettivo = Math.min(costo_specifico, tipologiaData.cmax);
                    
                    let incentivoRiga = percentuale * costoEffettivo * superficie;
                    
                    incentivoTotale += Math.min(incentivoRiga, tipologiaData.imax);
                });
                
                return incentivoTotale;
            },
            explain: (params, operatorType, contextData) => {
                const { righe_schermature } = params;
                if (!righe_schermature || !Array.isArray(righe_schermature) || righe_schermature.length === 0) {
                    return {
                        result: 0,
                        formula: 'Nessuna riga inserita',
                        variables: {},
                        steps: ['Inserire almeno una tipologia di schermatura solare']
                    };
                }

                const tipologieOptions = [
                    { value: 'Schermature/ombreggiamento', label: 'Schermature/ombreggiamento', cmax: 250, imax: 90000 },
                    { value: 'Meccanismi automatici', label: 'Meccanismi automatici', cmax: 50, imax: 10000 },
                    { value: 'Filtrazione solare selettiva non riflettente', label: 'Filtrazione solare selettiva non riflettente', cmax: 130, imax: 30000 },
                    { value: 'Filtrazione solare selettiva riflettente', label: 'Filtrazione solare selettiva riflettente', cmax: 80, imax: 30000 }
                ];

                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData, 'schermature-solari');
                const p = det.p;
                const pDesc = det.pDesc;
                const ueSelected = !!(params?.premiums?.['prodotti-ue'] || (contextData?.selectedPremiums && contextData.selectedPremiums.includes && contextData.selectedPremiums.includes('prodotti-ue')));
                const steps = [];
                let incentivoTotale = 0;

                steps.push(`Percentuale incentivazione: ${pDesc}`);
                steps.push(ueSelected ? `Premio Prodotti UE: incluso nella percentuale di incentivazione` : `Premio UE: non applicato`);
                steps.push(`---`);

                righe_schermature.forEach((riga, index) => {
                    const { tipologia_schermatura, superficie, costo_totale } = riga;
                    if (!tipologia_schermatura || !superficie || !costo_totale || superficie <= 0) {
                        steps.push(`Riga ${index + 1}: dati incompleti`);
                        return;
                    }

                    const tipologiaData = tipologieOptions.find(t => t.value === tipologia_schermatura);
                    if (!tipologiaData) return;

                    const cmax = tipologiaData.cmax;
                    const imax = tipologiaData.imax;
                    const tipologiaLabel = tipologiaData.label;

                    const costo_specifico = costo_totale / superficie;
                    const costoEffettivo = Math.min(costo_specifico, cmax);
                    const superaMassimaleC = costo_specifico > cmax;

                    let incentivoRigaBase = p * costoEffettivo * superficie;
                    let incentivoRigaFinale = Math.min(incentivoRigaBase, imax);
                    incentivoTotale += incentivoRigaFinale;

                    steps.push(`Riga ${index + 1}: ${tipologiaLabel}`);
                    steps.push(`  Superficie: ${superficie.toFixed(2)} m²`);
                    steps.push(`  Costo totale: ${costo_totale.toLocaleString('it-IT')} €`);
                    steps.push(`  C = ${costo_totale.toLocaleString('it-IT')} / ${superficie.toFixed(2)} = ${costo_specifico.toFixed(2)} €/m²`);
                    steps.push(superaMassimaleC 
                        ? `  ⚠️  Costo specifico (${costo_specifico.toFixed(2)} €/m²) supera Cmax (${cmax} €/m²)! Uso Cmax.` 
                        : `  ✓ Costo specifico (${costo_specifico.toFixed(2)}) ≤ Cmax (${cmax})`
                    );
                    steps.push(`  Incentivo riga base = ${p.toFixed(2)} × ${costoEffettivo.toFixed(2)} × ${superficie.toFixed(2)} = ${incentivoRigaBase.toLocaleString('it-IT', {minimumFractionDigits: 2})} €`);
                    steps.push(`  Incentivo riga finale = min(${incentivoRigaBase.toLocaleString('it-IT', {minimumFractionDigits: 2})}, ${imax.toLocaleString('it-IT')}) = ${incentivoRigaFinale.toLocaleString('it-IT', {minimumFractionDigits: 2})} €`);
                    steps.push(`---`);
                });

                return {
                    result: incentivoTotale,
                    formula: `Itot = Σ [min(p × min(Ci, Cmax,i) × Sint,i × UE, Imas,i)]`,
                    variables: {
                        NumeroRighe: righe_schermature.length,
                        p: p,
                        UE: ueSelected,
                    },
                    steps
                };
            }
        },
        'nzeb': {
            name: '1.D - Trasformazione in edificio a energia quasi zero (NZEB)',
            description: 'Art. 5, comma 1, lett. d) - Trasformazione di edifici esistenti in edifici a energia quasi zero (Nearly Zero Energy Building) attraverso interventi integrati di efficienza energetica e fonti rinnovabili.',
            category: 'Efficienza Energetica',
                allowedOperators: ['pa', 'private_tertiary_person', 'private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large'],
                restrictionNote: 'SOLO per PA/ETS non economici e Soggetti Privati su edifici TERZIARIO. NO ambito residenziale.',
            inputs: [
                { id: 'superficie', name: 'Superficie utile Sed (m²)', type: 'number', min: 0 },
                { id: 'costo_totale', name: 'Costo totale (€)', type: 'number', min: 0 },
                { 
                    id: 'costo_specifico', 
                    name: 'Costo specifico (€/m²)', 
                    type: 'computed',
                    compute: (params) => {
                        if (!params.costo_totale || !params.superficie) return 0;
                        return Number((params.costo_totale / params.superficie).toFixed(2));
                    }
                },
                { id: 'zona_climatica', name: 'Zona climatica', type: 'select', options: ['A', 'B', 'C', 'D', 'E', 'F'] }
            ],
            calculate: (params, operatorType, contextData) => {
                const { superficie, costo_specifico, zona_climatica } = params;
                // Treat numeric zero as valid; only bail out when missing (undefined/null)
                if (!superficie || costo_specifico === undefined || costo_specifico === null) return 0;
                
                // Cmax e Imas variano per zona climatica
                let cmax, imax;
                if (zona_climatica === 'A' || zona_climatica === 'B' || zona_climatica === 'C') {
                    cmax = 1000; // €/m²
                    imax = 2500000; // €
                } else {
                    cmax = 1300; // €/m²
                    imax = 3000000; // €
                }
                
                const costoEffettivo = Math.min(costo_specifico, cmax);
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData, 'nzeb');
                const percentuale = det.p;

                let incentivo = percentuale * costoEffettivo * superficie;

                return Math.min(incentivo, imax);
            },
            explain: (params, operatorType, contextData) => {
                const { superficie, costo_specifico, zona_climatica } = params;
                let cmax, imax;
                if (['A','B','C'].includes(zona_climatica)) { cmax=1000; imax=2500000; } else { cmax=1300; imax=3000000; }
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData, 'nzeb');
                const percentuale = det.p;
                const percentualeDesc = det.pDesc;
                const Ceff = Math.min(costo_specifico||0, cmax);
                const base = percentuale * Ceff * (superficie||0);
                const ueSelected = !!(params?.premiums?.['prodotti-ue'] || (contextData?.selectedPremiums && contextData.selectedPremiums.includes && contextData.selectedPremiums.includes('prodotti-ue')));
                const finale = Math.min(base, imax);
                return {
                    result: finale,
                    formula: `Itot = p × min(C, ${cmax}) × Sed${ueSelected?' (premio UE incluso nella percentuale)':''}; Imas=${imax.toLocaleString('it-IT')}€`,
                    variables: { p: percentuale, pDesc: percentualeDesc, C: costo_specifico||0, Ceff, Sed: superficie||0, UE: ueSelected, Imas: imax },
                    steps: [
                        `Percentuale incentivazione: ${percentualeDesc}`,
                        ueSelected ? `  Premio Prodotti UE: incluso nella percentuale di incentivazione (p=${percentuale.toFixed(2)})` : `  Premio Prodotti UE: non applicato`,
                        `Ceff=min(${(costo_specifico||0).toFixed(2)}, ${cmax})=${Ceff.toFixed(2)}`,
                        `Base=${percentuale.toFixed(4)}×${Ceff.toFixed(2)}×${(superficie||0).toFixed(2)}=${base.toFixed(2)}`,
                        `Finale=min(${base.toFixed(2)}, ${imax})=${finale.toFixed(2)}`
                    ]
                };
            }
        },
        'illuminazione-led': {
            name: '1.E - Sostituzione sistemi di illuminazione con LED',
            description: 'Art. 5, comma 1, lett. e) - Sostituzione di corpi illuminanti tradizionali con sistemi ad alta efficienza (LED) per ridurre i consumi elettrici per l\'illuminazione.',
            category: 'Efficienza Energetica',
                allowedOperators: ['pa', 'private_tertiary_person', 'private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large'],
                restrictionNote: 'SOLO per PA/ETS non economici e Soggetti Privati su edifici TERZIARIO. NO ambito residenziale.',
            inputs: [
                {
                    id: 'righe_illuminazione',
                    name: 'Tabella illuminazione LED',
                    type: 'table',
                    columns: [
                        {
                            id: 'tipo_lampada',
                            name: 'Tipo di lampada',
                            type: 'select',
                            options: [
                                { value: 'Alta efficienza', label: 'Alta efficienza', cmax: 15, imax: 50000 },
                                { value: 'LED', label: 'LED', cmax: 35, imax: 140000 }
                            ]
                        },
                        {
                            id: 'superficie',
                            name: 'Superficie (m²)',
                            type: 'number',
                            min: 0
                        },
                        {
                            id: 'costo_totale',
                            name: 'Costo totale (€)',
                            type: 'number',
                            min: 0
                        },
                        {
                            id: 'costo_specifico',
                            name: 'Costo specifico (€/m²)',
                            type: 'computed',
                            compute: (riga) => {
                                if (!riga.costo_totale || !riga.superficie) return 0;
                                return Number((riga.costo_totale / riga.superficie).toFixed(2));
                            }
                        }
                    ],
                    help: 'Inserisci una riga per ogni tipologia di lampada. Puoi aggiungere più tipologie.'
                }
            ],
            calculate: (params, operatorType, contextData) => {
                const { righe_illuminazione } = params;
                if (!righe_illuminazione || !Array.isArray(righe_illuminazione) || righe_illuminazione.length === 0) return 0;

                let incentivoTotale = 0;
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData, 'illuminazione-led');
                const percentuale = det.p;

                righe_illuminazione.forEach(riga => {
                    const { tipo_lampada, superficie, costo_totale } = riga;
                    if (!tipo_lampada || !superficie || !costo_totale || superficie <= 0) return 0;

                    const tipologiaData = [
                        { value: 'Alta efficienza', cmax: 15, imax: 50000 },
                        { value: 'LED', cmax: 35, imax: 140000 }
                    ].find(t => t.value === tipo_lampada);

                    if (!tipologiaData) return 0;

                    const costo_specifico = costo_totale / superficie;
                    const costoEffettivo = Math.min(costo_specifico, tipologiaData.cmax);
                    
                    let incentivoRiga = percentuale * costoEffettivo * superficie;
                    
                    incentivoTotale += Math.min(incentivoRiga, tipologiaData.imax);
                });
                
                return incentivoTotale;
            },
            explain: (params, operatorType, contextData) => {
                const { righe_illuminazione } = params;
                if (!righe_illuminazione || !Array.isArray(righe_illuminazione) || righe_illuminazione.length === 0) {
                    return {
                        result: 0,
                        formula: 'Nessuna riga inserita',
                        variables: {},
                        steps: ['Inserire almeno una tipologia di lampada']
                    };
                }

                const tipologieOptions = [
                    { value: 'Alta efficienza', label: 'Alta efficienza', cmax: 15, imax: 50000 },
                    { value: 'LED', label: 'LED', cmax: 35, imax: 140000 }
                ];

                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData, 'illuminazione-led');
                const p = det.p;
                const pDesc = det.pDesc;
                const ueSelected = !!(params?.premiums?.['prodotti-ue'] || (contextData?.selectedPremiums && contextData.selectedPremiums.includes && contextData.selectedPremiums.includes('prodotti-ue')));
                const steps = [];
                let incentivoTotale = 0;
                steps.push(`Percentuale incentivazione: ${pDesc}`);
                steps.push(ueSelected ? `Premio Prodotti UE: incluso nella percentuale di incentivazione` : `Premio UE: non applicato`);
                steps.push(`---`);

                righe_illuminazione.forEach((riga, index) => {
                    const { tipo_lampada, superficie, costo_totale } = riga;
                    if (!tipo_lampada || !superficie || !costo_totale || superficie <= 0) {
                        steps.push(`Riga ${index + 1}: dati incompleti`);
                        return;
                    }

                    const tipologiaData = tipologieOptions.find(t => t.value === tipo_lampada);
                    if (!tipologiaData) return;

                    const cmax = tipologiaData.cmax;
                    const imax = tipologiaData.imax;
                    const tipologiaLabel = tipologiaData.label;

                    const costo_specifico = costo_totale / superficie;
                    const costoEffettivo = Math.min(costo_specifico, cmax);
                    const superaMassimaleC = costo_specifico > cmax;

                    let incentivoRigaBase = p * costoEffettivo * superficie;
                    let incentivoRigaFinale = Math.min(incentivoRigaBase, imax);
                    incentivoTotale += incentivoRigaFinale;

                    steps.push(`Riga ${index + 1}: ${tipologiaLabel}`);
                    steps.push(`  Superficie: ${superficie.toFixed(2)} m²`);
                    steps.push(`  Costo totale: ${costo_totale.toLocaleString('it-IT')} €`);
                    steps.push(`  C = ${costo_totale.toLocaleString('it-IT')} / ${superficie.toFixed(2)} = ${costo_specifico.toFixed(2)} €/m²`);
                    steps.push(superaMassimaleC 
                        ? `  ⚠️  Costo specifico (${costo_specifico.toFixed(2)} €/m²) supera Cmax (${cmax} €/m²)! Uso Cmax.` 
                        : `  ✓ Costo specifico (${costo_specifico.toFixed(2)}) ≤ Cmax (${cmax})`
                    );
                    steps.push(`  Incentivo riga base = ${p.toFixed(2)} × ${costoEffettivo.toFixed(2)} × ${superficie.toFixed(2)} = ${incentivoRigaBase.toLocaleString('it-IT', {minimumFractionDigits: 2})} €`);
                    steps.push(`  Incentivo riga finale = min(${incentivoRigaBase.toLocaleString('it-IT', {minimumFractionDigits: 2})}, ${imax.toLocaleString('it-IT')}) = ${incentivoRigaFinale.toLocaleString('it-IT', {minimumFractionDigits: 2})} €`);
                    steps.push(`---`);
                });

                return {
                    result: incentivoTotale,
                    formula: `Itot = Σ [min(p × min(Ci, Cmax,i) × Sint,i × UE, Imas,i)]`,
                    variables: {
                        NumeroRighe: righe_illuminazione.length,
                        p: p,
                        UE: ueSelected,
                    },
                    steps
                };
            }
        },
        'building-automation': {
            name: '1.F - Installazione di sistemi di building automation',
            description: 'Art. 5, comma 1, lett. f) - Installazione di sistemi intelligenti per il controllo e la gestione automatica degli impianti termici e dell\'illuminazione per ottimizzare i consumi energetici.',
            category: 'Efficienza Energetica',
                allowedOperators: ['pa', 'private_tertiary_person', 'private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large'],
                restrictionNote: 'SOLO per PA/ETS non economici e Soggetti Privati su edifici TERZIARIO. NO ambito residenziale.',
            inputs: [
                { id: 'superficie', name: 'Superficie edificio Sed (m²)', type: 'number', min: 0 },
                { id: 'costo_totale', name: 'Costo totale intervento (€)', type: 'number', min: 0 },
                { id: 'costo_specifico', name: 'Costo specifico C (€/m²)', type: 'computed', compute: (params) => params.superficie > 0 ? Number((params.costo_totale / params.superficie).toFixed(2)) : 0 }
            ],
            calculate: (params, operatorType, contextData) => {
                const { superficie, costo_specifico } = params;
                // Treat numeric zero as valid; only bail out when missing (undefined/null)
                if (!superficie || costo_specifico === undefined || costo_specifico === null) return 0;
                
                // Formula: Itot = %spesa × C × Sed, con Itot ≤ Imas
                const cmax = 60; // €/m²
                const imax = 100000; // €
                
                const costoEffettivo = Math.min(costo_specifico, cmax);
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData, 'building-automation');
                const percentuale = det.p;

                let incentivo = percentuale * costoEffettivo * superficie;

                return Math.min(incentivo, imax);
            },
            explain: (params, operatorType, contextData) => {
                const { superficie, costo_specifico } = params;
                const cmax = 60, imax = 100000;
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData, 'building-automation');
                const p = det.p;
                const pDesc = det.pDesc;
                const Ceff = Math.min(costo_specifico || 0, cmax);
                const base = p * Ceff * (superficie || 0);
                const finale = Math.min(base, imax);

                // Verifica se l'utente ha selezionato il premio Prodotti UE (solo per spiegazione)
                const ueSelected = !!(params?.premiums?.['prodotti-ue'] || (contextData?.selectedPremiums && contextData.selectedPremiums.includes && contextData.selectedPremiums.includes('prodotti-ue')));

                const steps = [];
                steps.push(`Percentuale incentivazione: ${pDesc}`);
                steps.push(ueSelected ? `UE: premio UE applicato e incluso nella percentuale (p=${p.toFixed(2)})` : `UE: non applicata`);
                steps.push(`Ceff=min(${(costo_specifico||0).toFixed(2)}, ${cmax})=${Ceff.toFixed(2)}`);
                steps.push(`Base=${p.toFixed(2)}×${Ceff.toFixed(2)}×${(superficie||0).toFixed(2)}=${base.toFixed(2)}`);
                steps.push(`Finale=min(${base.toFixed(2)}, ${imax})=${finale.toFixed(2)}`);

                return {
                    result: finale,
                    formula: `Itot = p × min(C, ${cmax}) × Sed${ueSelected ? ' (premio UE incluso nella percentuale)' : ''}; Imas=${imax.toLocaleString('it-IT')}€`,
                    variables: { p, C: costo_specifico||0, Ceff, Sed: superficie||0, Imas: imax, pDesc, UE: ueSelected },
                    steps
                };
            }
        },
        'infrastrutture-ricarica': {
            name: '1.G - Infrastrutture di ricarica per veicoli elettrici',
            description: 'Art. 5, comma 1, lett. g) - Realizzazione di infrastrutture per la ricarica di veicoli elettrici presso edifici pubblici o ad uso terziario per promuovere la mobilità sostenibile.',
            category: 'Efficienza Energetica',
                allowedOperators: ['pa', 'private_tertiary_person', 'private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large'],
                restrictionNote: 'SOLO per PA/ETS non economici e Soggetti Privati su edifici TERZIARIO. NO ambito residenziale.',
            inputs: [
                { id: 'tipo_infrastruttura', name: 'Tipo infrastruttura', type: 'select', options: ['Standard monofase (7.4-22kW)', 'Standard trifase (7.4-22kW)', 'Media (22-50kW)', 'Alta (50-100kW)', 'Oltre 100kW'] },
                { 
                    id: 'numero_punti', 
                    name: 'Numero punti di ricarica (solo per standard 7.4–22kW)', 
                    type: 'number', 
                    min: 1, 
                    step: 1, 
                    help: 'Inserisci il numero di punti per le infrastrutture standard (monofase o trifase).', 
                    visible_if: { 
                        field: 'tipo_infrastruttura', 
                        values: ['Standard monofase (7.4-22kW)', 'Standard trifase (7.4-22kW)'] 
                    }
                },
                { 
                    id: 'potenza', 
                    name: 'Potenza dell\'infrastruttura (kW) – solo per 22–50 kW', 
                    type: 'number', 
                    min: 0, 
                    step: 0.1, 
                    visible_if: { 
                        field: 'tipo_infrastruttura', 
                        values: ['Media (22-50kW)', 'Alta (50-100kW)', 'Oltre 100kW'] 
                    }
                },
                { id: 'costo_totale', name: 'Costo totale sostenuto (€)', type: 'number', min: 0 }
            ],
            calculate: (params, operatorType, contextData) => {
                const { tipo_infrastruttura, numero_punti, potenza, costo_totale } = params;
                // Treat numeric 0 as a valid entered value. Only bail out when the value
                // is actually missing (undefined/null). This allows users to enter 0
                // or edit the field freely without being blocked by an early return.
                if (costo_totale === undefined || costo_totale === null) return 0;

                // Limiti massimi di costo secondo Art. 5.1.g
                let costoMassimoAmmissibile;
                switch(tipo_infrastruttura) {
                    case 'Standard monofase (7.4-22kW)': {
                        const n = parseInt(numero_punti, 10) || 0;
                        costoMassimoAmmissibile = 2400 * n; break;
                    }
                    case 'Standard trifase (7.4-22kW)': {
                        const n = parseInt(numero_punti, 10) || 0;
                        costoMassimoAmmissibile = 8400 * n; break;
                    }
                    case 'Media (22-50kW)':
                        costoMassimoAmmissibile = potenza * 1200; break;
                    case 'Alta (50-100kW)':
                        costoMassimoAmmissibile = 60000; break;
                    case 'Oltre 100kW':
                        costoMassimoAmmissibile = 110000; break;
                    default:
                        costoMassimoAmmissibile = 0;
                }

                const spesaAmmissibile = Math.min(costo_totale, costoMassimoAmmissibile);

                // Determina la percentuale centralizzata (include eventuale premio Prodotti UE e regole multi-intervento)
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData || {}, 'infrastrutture-ricarica');
                const percentuale = det.p;

                // Incentivo = p × spesa ammissibile
                let incentivo = percentuale * spesaAmmissibile;

                // Note: "incentivo comunque non superiore a quello per pompe di calore elettriche"
                // Per ora lasciamo solo la formula base

                return incentivo;
            },
            explain: (params, operatorType, contextData) => {
                const { tipo_infrastruttura, numero_punti, potenza, costo_totale } = params;
                let costoMassimoAmmissibile = 0;
                const steps = [];

                // Determina percentuale centralmente (include eventuale premio Prodotti UE)
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData || {}, 'infrastrutture-ricarica');
                const percentuale = det.p;
                const percentualeDesc = det.pDesc;

                // Verifica se l'utente ha selezionato il premio Prodotti UE (solo per spiegazione)
                const ueSelected = !!(params?.premiums?.['prodotti-ue'] || (contextData?.selectedPremiums && contextData.selectedPremiums.includes && contextData.selectedPremiums.includes('prodotti-ue')));

                steps.push(`Percentuale incentivazione: ${percentualeDesc}`);
               // steps.push(ueSelected ? `  Premio Prodotti UE: incluso nella percentuale di incentivazione (p=${percentuale.toFixed(2)})` : `  Premio Prodotti UE: non applicato`);
                steps.push(`---`);

                switch(tipo_infrastruttura) {
                    case 'Standard monofase (7.4-22kW)': {
                        const n = parseInt(numero_punti, 10) || 0;
                        costoMassimoAmmissibile = 2400 * n;
                        steps.push(`Cmax = 2400 € × N_punti (${n}) = ${costoMassimoAmmissibile.toLocaleString('it-IT')} €`);
                        break;
                    }
                    case 'Standard trifase (7.4-22kW)': {
                        const n = parseInt(numero_punti, 10) || 0;
                        costoMassimoAmmissibile = 8400 * n;
                        steps.push(`Cmax = 8400 € × N_punti (${n}) = ${costoMassimoAmmissibile.toLocaleString('it-IT')} €`);
                        break;
                    }
                    case 'Media (22-50kW)': {
                        const p = parseFloat(potenza || 0);
                        costoMassimoAmmissibile = p * 1200;
                        steps.push(`Cmax = P × 1200 €/kW = ${p.toFixed(1)} × 1200 = ${costoMassimoAmmissibile.toLocaleString('it-IT')} €`);
                        break;
                    }
                    case 'Alta (50-100kW)': costoMassimoAmmissibile = 60000; steps.push(`Cmax = 60.000 € per infrastruttura`); break;
                    case 'Oltre 100kW': costoMassimoAmmissibile = 110000; steps.push(`Cmax = 110.000 € per infrastruttura`); break;
                    default: costoMassimoAmmissibile = 0; steps.push(`Tipo non selezionato`);
                }
                const spesa = parseFloat(costo_totale || 0) || 0;
                const spesaAmmissibile = Math.min(spesa, costoMassimoAmmissibile);
                const incentivo = percentuale * spesaAmmissibile;
                steps.push(`Spesa ammissibile = min(Spesa, Cmax) = min(${spesa.toLocaleString('it-IT')}, ${costoMassimoAmmissibile.toLocaleString('it-IT')}) = ${spesaAmmissibile.toLocaleString('it-IT')}`);
                steps.push(`Itot = p × Spesa ammissibile = ${percentuale.toFixed(4)} × ${spesaAmmissibile.toLocaleString('it-IT')} = ${incentivo.toLocaleString('it-IT', {minimumFractionDigits: 2})} €`);
                return { result: incentivo, formula:`Itot = p × min(Spesa, Cmax)${ueSelected ? ' (Prodotti UE inclusi nella percentuale)' : ''}`, variables:{Spesa:spesa, Cmax:costoMassimoAmmissibile, SpesaAmm:spesaAmmissibile, p:percentuale, pDesc:percentualeDesc, UE:ueSelected}, steps };
            }
        },
        'fotovoltaico-accumulo': {
            name: '1.H - Impianto fotovoltaico con sistema di accumulo',
            description: 'Art. 5, comma 1, lett. h) - Installazione di impianti fotovoltaici integrati con sistemi di accumulo elettrico per l\'autoconsumo dell\'energia prodotta e la riduzione dei prelievi dalla rete.',
            category: 'Efficienza Energetica',
                allowedOperators: ['pa', 'private_tertiary_person', 'private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large'],
                restrictionNote: 'SOLO per PA/ETS non economici e Soggetti Privati su edifici TERZIARIO. NO ambito residenziale.',
            inputs: [
                { id: 'potenza_fv', name: 'Potenza impianto FV (kWp)', type: 'number', min: 0, max: 1000, step: 0.1 },
                { id: 'capacita_accumulo', name: 'Capacità accumulo (kWh)', type: 'number', min: 0, step: 0.1 },
                { id: 'registro_ue', name: 'Moduli FV iscritti al registro UE', type: 'select', options: ['No', 'Sì - Requisiti lett. a) (+5%)', 'Sì - Requisiti lett. b) (+10%)', 'Sì - Requisiti lett. c) (+15%)'] },
                { id: 'costo_totale', name: 'Costo totale intervento (€)', type: 'number', min: 0, optional: true, help: 'Se fornito, verrà usato per confrontare con i massimali e determinare la spesa ammissibile.' }
            ],
            calculate: (params, operatorType, contextData) => {
                const { potenza_fv, capacita_accumulo, registro_ue, costo_totale } = params;
                const p = Number(potenza_fv || 0);
                const k = Number(capacita_accumulo || 0);

                if (p <= 0 && k <= 0) return 0;

                // Cmax per fasce indicate dal decreto (€/kW)
                let cmaxFVPerkW;
                // Enforce regulatory cap: no incentives for potenze > 1000 kWp
                if (p > 1000) return 0;
                if (p <= 20) cmaxFVPerkW = 1500;
                else if (p <= 200) cmaxFVPerkW = 1200;
                else if (p <= 600) cmaxFVPerkW = 1100;
                else /* p <= 1000 */ cmaxFVPerkW = 1050;

                const massimaleFV = p * cmaxFVPerkW;
                const massimaleAccumulo = k * 1000; // 1000 €/kWh per accumulo
                const totaleMassimali = massimaleFV + massimaleAccumulo;

                // Registro UE: incrementa la percentuale (non i massimali) secondo la lettera a/b/c
                let registroAdd = 0;
                if (registro_ue && typeof registro_ue === 'string') {
                    if (registro_ue.includes('lett. a)')) registroAdd = 0.05;
                    else if (registro_ue.includes('lett. b)')) registroAdd = 0.10;
                    else if (registro_ue.includes('lett. c)')) registroAdd = 0.15;
                }

                // Percentuale base per questo intervento: 20% (salvo Art.48-ter / piccolo comune => 100%)
                const isArt48ter = contextData?.buildingSubcategory && ['tertiary_school', 'tertiary_hospital'].includes(contextData.buildingSubcategory);
                // Nota: per il fotovoltaico-accumulo NON applichiamo il 100% per i piccoli comuni; resta valido solo Art.48-ter
                const basePercentuale = isArt48ter ? 1.0 : 0.20;
                const percentualeApplicata = isArt48ter ? 1.0 : (basePercentuale + registroAdd);

                // Spesa totale: preferiamo il costo reale se fornito, altrimenti stimiamo dalla somma delle componenti massimali
                const spesaTotale = (typeof costo_totale === 'number' && !isNaN(costo_totale) && costo_totale > 0) ? costo_totale : totaleMassimali;

                // Applicazione della regola: incentivo = percentualeApplicata × min(SpesaTotale, TotaleMassimali)
                const spesaUsata = Math.min(spesaTotale, totaleMassimali);
                const incentivo = percentualeApplicata * spesaUsata;

                return incentivo;
            },
            explain: (params, operatorType, contextData) => {
                const { potenza_fv, capacita_accumulo, registro_ue, costo_totale } = params;
                const p = Number(potenza_fv || 0);
                const k = Number(capacita_accumulo || 0);

                const steps = [];

                // Cmax per fascia
                let cmaxFVPerkW;
                if (p <= 20) cmaxFVPerkW = 1500;
                else if (p <= 200) cmaxFVPerkW = 1200;
                else if (p <= 600) cmaxFVPerkW = 1100;
                else cmaxFVPerkW = 1050;

                // Registro UE incrementa la percentuale (non i massimali)
                let registroAdd = 0;
                let registroNote = 'No registro UE selezionato';
                if (registro_ue && typeof registro_ue === 'string') {
                    if (registro_ue.includes('lett. a)')) { registroAdd = 0.05; registroNote = 'Registro UE lett. a) (+5%)'; }
                    else if (registro_ue.includes('lett. b)')) { registroAdd = 0.10; registroNote = 'Registro UE lett. b) (+10%)'; }
                    else if (registro_ue.includes('lett. c)')) { registroAdd = 0.15; registroNote = 'Registro UE lett. c) (+15%)'; }
                }

                const massimaleFV = p * cmaxFVPerkW;
                const massimaleAccumulo = k * 1000;
                const totaleMassimali = massimaleFV + massimaleAccumulo;

                const isArt48ter = contextData?.buildingSubcategory && ['tertiary_school', 'tertiary_hospital'].includes(contextData.buildingSubcategory);
                // Piccolo comune non modifica la percentuale per 1.H nello explain; solo Art.48-ter imposta 100%
                const basePercentuale = isArt48ter ? 1.0 : 0.20;
                const percentualeApplicata = isArt48ter ? 1.0 : (basePercentuale + registroAdd);
                const pDesc = (percentualeApplicata === 1.0) ? '100% (Art.48-ter)' : `${((basePercentuale+registroAdd)*100).toFixed(0)}% (base 20% + registro)`;

                // Costruzione dei passi esplicativi
                steps.push(`Potenza FV (kWp): ${p}`);
                steps.push(`Capacità accumulo (kWh): ${k}`);
                steps.push(`Massimale FV (€/kW): ${cmaxFVPerkW}`);
                steps.push(`Massimale accumulo (€/kWh): 1000`);
                if (registroAdd > 0) steps.push(`Registro UE: ${registro_ue} (incrementa la percentuale di ${(registroAdd*100).toFixed(0)} punti percentuali)`);

                // Spesa ammissibile considerata
                const costoFatturato = (typeof costo_totale === 'number' && !isNaN(costo_totale) && costo_totale > 0) ? costo_totale : totaleMassimali;
                const spesaUsataFinale = Math.min(costoFatturato, totaleMassimali);

                // Dettagli per i passi esplicativi
                //steps.push(`Cmax base FV = ${cmaxFVPerkW} €/kWp`);
                steps.push(`Massimale FV = ${p} × ${cmaxFVPerkW} = ${massimaleFV.toLocaleString('it-IT')} €`);
                steps.push(`Massimale accumulo = ${k} kWh × 1000 €/kWh = ${massimaleAccumulo.toLocaleString('it-IT')} €`);
                steps.push(`Totale massimali = ${totaleMassimali.toLocaleString('it-IT')} €`);
                steps.push(typeof costo_totale === 'number' && costo_totale > 0 ? `Costo fatturato fornito = ${costo_totale.toLocaleString('it-IT')} €` : `Nessun costo fatturato fornito; si assume spesa ammissibile = massimali`);
                steps.push(`Costo usata per calcolo = min(Costo fatturato, Totale massimali) = ${spesaUsataFinale.toLocaleString('it-IT')} €`);
                steps.push(`Percentuale applicata: ${pDesc}`);
                steps.push(`Itot = p × Spesa usata = ${percentualeApplicata.toFixed(2)} × ${spesaUsataFinale.toLocaleString('it-IT')} = ${(percentualeApplicata*spesaUsataFinale).toLocaleString('it-IT', {minimumFractionDigits: 2})} €`);

                // Requisiti tecnici e modalità di erogazione (informativi)
                steps.push('Requisiti tecnici: moduli FV con rendimento ≥90% dopo 10 anni; inverter rendimento UE ≥97%.');
                steps.push('Erogazione: pagamento in unica rata per importi ≤15.000 €; per importi >15.000 € possibili rate tra 2 e 5 anni.');

                const incentivo = percentualeApplicata * spesaUsataFinale;

                return {
                    result: incentivo,
                    formula: `Itot = p × min(costoFatturato, TotaleMassimali)`,
                    variables: {
                        potenza_fv: p,
                        capacita_accumulo_kWh: k,
                        costo_massimo_ammissibile_fv: cmaxFVPerkW,
                        costo_massimo_ammissibile_accumulo: 1000,
                       // massimaleFV: massimaleFV,
                       // massimaleAccumulo: massimaleAccumulo,
                       // totaleMassimali: totaleMassimali,
                        costo_Fatturato: (typeof costo_totale === 'number' ? costo_totale : null),
                       // spesaUsata: spesaUsataFinale,
                        p: percentualeApplicata,
                        pDesc: pDesc,
                        registro_ue: registro_ue || null
                    },
                    steps
                };
            }
        },

        // --- INTERVENTI DI PRODUZIONE DI ENERGIA TERMICA DA FONTI RINNOVABILI (Art. 8) ---
        'pompa-calore': {
            name: '2.A - Sostituzione con pompe di calore',
            description: 'Art. 8, comma 1, lett. a) - Sostituzione di impianti di climatizzazione invernale esistenti con pompe di calore elettriche ad alta efficienza per la produzione di energia termica da fonti rinnovabili.',
            category: 'Fonti Rinnovabili',
            allowedOperators: ['pa', 'private_tertiary_person', 'private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large', 'private_residential'],
            restrictionNote: 'Per imprese e ETS economici: NON ammesse pompe di calore a GAS (art. 25, comma 2). Solo pompe di calore elettriche.',
            inputs: [
                { id: 'costo_totale', name: 'Costo totale intervento (€)', type: 'number', min: 0, help: 'Opzionale: se fornisci i costi per singola pompa, questo campo può restare vuoto.' },
                {
                    id: 'righe_pompe',
                    name: 'Tabella pompe di calore',
                    type: 'table',
                    columns: [
                        { id: 'tipo_pompa', name: 'Tipo di pompa di calore', type: 'select', options: ['aria/aria split/multisplit', 'aria/aria fixed double duct', 'aria/aria VRF/VRV', 'aria/aria rooftop', 'aria/acqua', 'acqua/aria', 'acqua/acqua', 'salamoia/aria', 'salamoia/acqua'] },
                        { id: 'potenza_nominale', name: 'Potenza termica nominale Prated (kW)', type: 'number', min: 0, step: 0.1 },
                        { id: 'scop', name: 'SCOP stagionale', type: 'number', min: 2.5, step: 0.01 },
                        { id: 'zona_climatica', name: 'Zona climatica', type: 'select', options: ['A', 'B', 'C', 'D', 'E', 'F'] },
                        { id: 'costo_totale', name: 'Costo totale pompa (€)', type: 'number', min: 0, optional: true }
                    ],
                    help: 'Aggiungi una riga per ogni pompa presente nell\'impianto. I parametri di ciascuna riga verranno valutati separatamente e sommati.'
                }
            ],
            calculate: (params, operatorType) => {
                const rows = Array.isArray(params?.righe_pompe) ? params.righe_pompe : [];
                if (rows.length === 0) return 0;

                const qufTable = { A: 600, B: 850, C: 1100, D: 1400, E: 1700, F: 1800 };

                function assignCi(tipoRaw, potenza) {
                    if (potenza === undefined || potenza === null) return null;
                    const p = Number(potenza);
                    const tipo = (tipoRaw || '').toLowerCase();

                    if (tipo.includes('split') || tipo.includes('multisplit')) { if (p <= 12) return 0.070; return null; }
                    if (tipo.includes('fixed') && tipo.includes('double')) { if (p <= 12) return 0.200; return null; }
                    if (tipo.includes('vrf') || tipo.includes('vrv')) { if (p >= 13 && p <= 35) return 0.150; if (p > 35) return 0.055; return null; }
                    if (tipo.includes('rooftop')) { if (p <= 35) return 0.150; if (p > 35) return 0.055; return null; }
                    if (tipo.includes('aria/acqua') || tipo.includes('aria-acqua') || tipo.includes('aria acqua')) { if (p >= 13 && p <= 35) return 0.150; if (p > 35) return 0.060; return null; }
                    if (tipo.includes('acqua/aria') || tipo.includes('acqua-aria') || (tipo.includes('acqua') && tipo.includes('aria'))) { if (p >= 13 && p <= 35) return 0.160; if (p > 35) return 0.060; return null; }
                    if (tipo.includes('acqua/acqua') || tipo.includes('acqua-acqua')) { if (p >= 13 && p <= 35) return 0.160; if (p > 35) return 0.060; return null; }
                    if (tipo.includes('salamoia')) { if (p >= 13 && p <= 35) return 0.160; if (p > 35) return 0.060; return null; }
                    return null;
                }

                // scop_minimo is derived from the normative table via getScopMinFromTipo()

                let totalIncentive = 0;
                rows.forEach(row => {
                    const tipo_pompa = row?.tipo_pompa || '';
                    const potenza_nominale = Number(row?.potenza_nominale) || 0;
                    const scop = Number(row?.scop) || 0;
                    // derive normative SCOP minimo from the pump type (tabellato); do not require user input
                    const scop_minimo = getScopMinFromTipo(tipo_pompa) || 1;
                    const zona_climatica = row?.zona_climatica;
                    if (!potenza_nominale || !scop || !zona_climatica) return;

                    const quf = qufTable[zona_climatica] || 0;
                    const qu = potenza_nominale * quf;
                    const kp = scop / scop_minimo;
                    const ei = qu * (1 - 1/scop) * kp;
                    const ci = assignCi(tipo_pompa, potenza_nominale);
                    const incentivo_annuo = ci !== null ? ci * ei : 0;
                    const durata = operatorType === 'pa' ? 5 : 2;
                    totalIncentive += incentivo_annuo * durata;
                });

                return totalIncentive;
            },
            explain: (params, operatorType) => {
                const rows = Array.isArray(params?.righe_pompe) ? params.righe_pompe : [];
                const qufTable = { A: 600, B: 850, C: 1100, D: 1400, E: 1700, F: 1800 };
                const steps = [];
                let total = 0;

                rows.forEach((row, idx) => {
                    const tipo_pompa = row?.tipo_pompa || '';
                    const Pr = Number(row?.potenza_nominale) || 0;
                    const scop = Number(row?.scop) || 0;
                    // compute scop_minimo from tipo_pompa (tabellato) and report it in the explain
                    const scop_minimo = getScopMinFromTipo(tipo_pompa) || 1;
                    const zona = row?.zona_climatica;
                    if (!Pr || !scop || !zona) {
                        steps.push(`Riga ${idx+1}: parametri incompleti, ignorata.`);
                        return;
                    }
                    const Quf = qufTable[zona] || 0;
                    const Qu = Pr * Quf;
                    const kp = scop / scop_minimo;
                    const EI = Qu * (1 - 1/scop) * kp;

                    const assignCiLocal = (tipoRaw, potenza) => {
                        if (potenza === undefined || potenza === null) return null;
                        const p = Number(potenza);
                        const tipo = (tipoRaw || '').toLowerCase();
                        if (tipo.includes('split') || tipo.includes('multisplit')) { if (p <= 12) return 0.070; return null; }
                        if (tipo.includes('fixed') && tipo.includes('double')) { if (p <= 12) return 0.200; return null; }
                        if (tipo.includes('vrf') || tipo.includes('vrv')) { if (p >= 13 && p <= 35) return 0.150; if (p > 35) return 0.055; return null; }
                        if (tipo.includes('rooftop')) { if (p <= 35) return 0.150; if (p > 35) return 0.055; return null; }
                        if (tipo.includes('aria/acqua') || tipo.includes('aria-acqua') || tipo.includes('aria acqua')) { if (p >= 13 && p <= 35) return 0.150; if (p > 35) return 0.060; return null; }
                        if (tipo.includes('acqua/aria') || tipo.includes('acqua-aria') || (tipo.includes('acqua') && tipo.includes('aria'))) { if (p >= 13 && p <= 35) return 0.160; if (p > 35) return 0.060; return null; }
                        if (tipo.includes('acqua/acqua') || tipo.includes('acqua-acqua')) { if (p >= 13 && p <= 35) return 0.160; if (p > 35) return 0.060; return null; }
                        if (tipo.includes('salamoia')) { if (p >= 13 && p <= 35) return 0.160; if (p > 35) return 0.060; return null; }
                        return null;
                    };

                    const Ci = assignCiLocal(tipo_pompa, Pr);
                    const Ia_annuo = Ci !== null ? Ci * EI : 0;
                    const durata = operatorType === 'pa' ? 5 : 2;
                    const totale = Ia_annuo * durata;
                    total += totale;

                    steps.push(`Riga ${idx+1} (${tipo_pompa} - Pr=${Pr} kW, zona ${zona}):`);
                    steps.push(`• SCOP inserito = ${scop}; SCOP minimo ecodesign (tabellato) = ${scop_minimo}`);
                    steps.push(`• kp = SCOP / SCOP_minimo = ${scop.toFixed(3)} / ${scop_minimo.toFixed(3)} = ${kp.toFixed(3)}`);
                    // Detailed breakdown for Qu and EI to make the derivation explicit
                    const qufVal = Quf;
                    const quComputed = Qu;
                    const oneMinusInvScop = (1 - 1/(scop||1));
                    const eiComputed = EI;
                    steps.push(`• Quf (ore/anno per zona ${zona}) = ${qufVal}`);
                    steps.push(`• Qu = Pr × Quf = ${Pr} kW × ${qufVal} h = ${quComputed.toFixed(2)} kWh/anno`);
                    steps.push(`• Fattore = (1 - 1/SCOP) = 1 - 1/${scop} = ${oneMinusInvScop.toFixed(6)}`);
                    steps.push(`• kp = SCOP / SCOP_minimo = ${scop.toFixed(3)} / ${scop_minimo.toFixed(3)} = ${kp.toFixed(3)}`);
                    steps.push(`• EI = Qu × Fattore × kp = ${quComputed.toFixed(2)} × ${oneMinusInvScop.toFixed(6)} × ${kp.toFixed(3)} = ${eiComputed.toFixed(2)}`);
                    steps.push(`• Ci = ${Ci===null? 'N/D' : Ci} → Ia_annuo = Ci × EI = ${Ia_annuo.toFixed(2)}; durata = ${durata} anni → incentivo € ${totale.toFixed(2)}`);
                    // separator between rows for readability
                    steps.push('----------------------------------------');
                });

                // Final summary: total incentive across all pump rows
                steps.push('');
                steps.push('Riepilogo totale:');
                steps.push(`Totale incentivo per tutte le pompe: € ${total.toFixed(2)}`);

                return { result: total, steps, formula: 'Somma degli incentivi calcolati per ciascuna pompa (Ia_tot per pompa × durata)', variables: { rowsCount: rows.length, totale: total } };
            }
        },
        'sistemi-ibridi': {
            name: '2.B - Sistemi ibridi factory made o bivalenti',
            description: 'Art. 8, comma 1, lett. b) - Installazione di sistemi ibridi composti da pompa di calore integrata con caldaia a condensazione (factory made o bivalenti) per ottimizzare l\'efficienza e ridurre i consumi.',
            category: 'Fonti Rinnovabili',
                allowedOperators: ['pa', 'private_tertiary_person', 'private_residential'],
                restrictionNote: 'NON AMMESSI per imprese e ETS economici (art. 25, comma 2): sistemi ibridi con caldaia a gas sono combustibili fossili.',
            inputs: [
                { id: 'costo_totale', name: 'Costo totale intervento (€)', type: 'number', min: 0, help: 'Necessario per calcolo premialità 100%' },
                { id: 'tipo_sistema', name: 'Tipo sistema', type: 'select', options: ['Ibrido factory made (Pn ≤35kW)', 'Ibrido factory made (Pn >35kW)', 'Sistema bivalente (Pn ≤35kW)', 'Sistema bivalente (Pn >35kW)'] },
                { id: 'potenza_pdc', name: 'Potenza termica pompa di calore Prated (kW)', type: 'number', min: 0, step: 0.1 },
                { id: 'scop', name: 'SCOP pompa di calore', type: 'number', min: 2.5, step: 0.01 },
                { id: 'zona_climatica', name: 'Zona climatica', type: 'select', options: ['A', 'B', 'C', 'D', 'E', 'F'] }
            ],
            calculate: (params, operatorType) => {
                const { tipo_sistema, potenza_pdc, scop, zona_climatica } = params;
                if (!potenza_pdc || !scop || !zona_climatica) return 0;
                // For sistemi ibridi we assume a typical pump type aria/acqua for ecodesign minima
                const scop_minimo = 2.825; // aria/acqua normative minimum
                
                // Formula: Ia_tot = k × Ei × Ci
                // dove Ei = Qu × [1 - 1/SCOP] × kp
                
                // Tabella 8: Quf
                const qufTable = { A: 600, B: 850, C: 1100, D: 1400, E: 1700, F: 1800 };
                const quf = qufTable[zona_climatica];
                
                // Qu = Prated × Quf
                const qu = potenza_pdc * quf;
                
                // kp = SCOP/SCOP_minimo (scop_minimo assumed from ecodesign table)
                const kp = scop / scop_minimo;
                
                // EI
                const ei = qu * (1 - 1/scop) * kp;
                
                // Tabella 18: Coefficiente k
                let k;
                if (tipo_sistema.includes('factory made')) {
                    k = 1.25; // Ibrido factory made
                } else {
                    k = tipo_sistema.includes('>35kW') ? 1.1 : 1.0; // Bivalente
                }
                
                // Ci (assumiamo aria/acqua come tipo più comune per sistemi ibridi)
                const ci = potenza_pdc <= 35 ? 0.150 : 0.060;
                
                // Incentivo annuo
                const incentivo_annuo = k * ei * ci;
                
                // Incentivo totale
                const durata = operatorType === 'pa' ? 5 : 2;
                return incentivo_annuo * durata;
            },
            explain: (params, operatorType) => {
                const { tipo_sistema, potenza_pdc, scop, zona_climatica } = params;
                const qufTable = { A: 600, B: 850, C: 1100, D: 1400, E: 1700, F: 1800 };
                const Quf = qufTable[zona_climatica]||0; const Pr=potenza_pdc||0; const Qu=Pr*Quf;
                // assume aria/acqua normative minimum for sistemi ibridi
                const scop_minimo = 2.825;
                const kp=(scop||0)/(scop_minimo||1);
                const EI = Qu * (1 - 1/(scop||1)) * kp;
                let k; if (tipo_sistema?.includes('factory made')) k=1.25; else k = tipo_sistema?.includes('>35kW')?1.1:1.0;
                const Ci = Pr<=35?0.150:0.060; const Ia_annuo = k * EI * Ci; const durata= operatorType==='pa'?5:2; const tot=Ia_annuo*durata;
                return { result: tot, formula:`Ia_tot = k × EI × Ci × durata; EI = Qu × (1 - 1/SCOP) × kp; Qu = Prated × Quf`, variables:{k,Ei:EI,Qu,Prated:Pr,Quf,Ci,SCOP:scop||0,scop_minimo,kp,durata} };
            }
        },
        'biomassa': {
            name: '2.C - Sostituzione con generatori a biomassa',
            description: 'Art. 8, comma 1, lett. c) - Sostituzione di generatori di calore esistenti con caldaie, stufe o termocamini alimentati a biomassa (pellet, legna) ad alta efficienza e basse emissioni.',
            category: 'Fonti Rinnovabili',
                allowedOperators: ['pa', 'private_tertiary_person', 'private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large', 'private_residential'],
                restrictionNote: 'Ammesso per tutti i soggetti. Biomassa è fonte rinnovabile, non combustibile fossile.',
            inputs: [
                { id: 'costo_totale', name: 'Costo totale intervento (€)', type: 'number', min: 0, help: 'Necessario per calcolo premialità 100%' },
                { id: 'tipo_generatore', name: 'Tipo generatore', type: 'select', options: ['Caldaia a biomassa', 'Stufa a pellet', 'Stufa a legna', 'Termocamino'] },
                { id: 'potenza_nominale', name: 'Potenza termica nominale Pn (kW)', type: 'number', min: 0, step: 0.1 },
                { id: 'zona_climatica', name: 'Zona climatica', type: 'select', options: ['A', 'B', 'C', 'D', 'E', 'F'] },
                { id: 'riduzione_emissioni', name: 'Riduzione emissioni particolato vs DM 186/2017 classe 5 stelle', type: 'select', options: ['Fino al 20%', 'Dal 20% al 50%', 'Oltre il 50%'] },
                { id: 'centrale_teleriscaldamento', name: 'Installato presso centrale teleriscaldamento?', type: 'select', options: ['No', 'Sì'] }
            ],
            calculate: (params, operatorType) => {
                const { tipo_generatore, potenza_nominale, zona_climatica, riduzione_emissioni, centrale_teleriscaldamento } = params;
                if (!potenza_nominale || !zona_climatica || !riduzione_emissioni) return 0;
                
                // Tabella 11: Hr ore di funzionamento per zona climatica
                const hrTable = { A: 600, B: 850, C: 1100, D: 1400, E: 1700, F: 1800 };
                const hr = hrTable[zona_climatica];
                
                // Tabella 12/13: Coefficiente Ce per emissioni
                let ce;
                if (riduzione_emissioni === 'Fino al 20%') ce = 1.0;
                else if (riduzione_emissioni === 'Dal 20% al 50%') ce = 1.2;
                else ce = 1.5; // Oltre 50%
                
                // Tabella 10: Ci coefficiente di valorizzazione
                let ci;
                if (tipo_generatore === 'Caldaia a biomassa') {
                    if (potenza_nominale <= 35) ci = 0.060;
                    else if (potenza_nominale <= 500) ci = 0.025;
                    else ci = 0.020;
                } else if (tipo_generatore.includes('pellet')) {
                    ci = 0.055; // Solo per Pn ≤ 35 kW
                } else { // Stufa a legna o Termocamino
                    ci = 0.045; // Solo per Pn ≤ 35 kW
                }
                
                // Formula varia per tipo generatore
                let incentivo_annuo;
                if (tipo_generatore === 'Caldaia a biomassa') {
                    // Formula: Ia_tot = Pn × Hr × Ci × Ce
                    incentivo_annuo = potenza_nominale * hr * ci * ce;
                } else {
                    // Formula per stufe/termocamini: Ia_tot = 3.35 × ln(Pn) × Hr × Ci × Ce
                    incentivo_annuo = 3.35 * Math.log(potenza_nominale) * hr * ci * ce;
                }
                
                // Riduzione 20% se presso centrale teleriscaldamento
                if (centrale_teleriscaldamento === 'Sì') {
                    incentivo_annuo *= 0.80;
                }
                
                // Incentivo totale
                const durata = operatorType === 'pa' ? 5 : 2;
                return incentivo_annuo * durata;
            },
            explain: (params, operatorType) => {
                const { tipo_generatore, potenza_nominale, zona_climatica, riduzione_emissioni, centrale_teleriscaldamento } = params;
                const hrTable = { A: 600, B: 850, C: 1100, D: 1400, E: 1700, F: 1800 };
                const Hr = hrTable[zona_climatica]||0; const Pn=potenza_nominale||0;
                let Ce; if (riduzione_emissioni==='Fino al 20%') Ce=1.0; else if (riduzione_emissioni==='Dal 20% al 50%') Ce=1.2; else Ce=1.5;
                let Ci; if (tipo_generatore==='Caldaia a biomassa'){ if (Pn<=35) Ci=0.060; else if (Pn<=500) Ci=0.025; else Ci=0.020; }
                else if (tipo_generatore?.includes('pellet')) Ci=0.055; else Ci=0.045;
                let Ia_annuo; if (tipo_generatore==='Caldaia a biomassa'){ Ia_annuo = Pn * Hr * Ci * Ce; } else { Ia_annuo = 3.35 * Math.log(Math.max(Pn,1)) * Hr * Ci * Ce; }
                if (centrale_teleriscaldamento==='Sì') Ia_annuo*=0.80;
                const durata = operatorType==='pa'?5:2; const tot=Ia_annuo*durata;
                return { result: tot, formula:`Ia_tot = f(tipo) × Hr × Ci × Ce × durata${centrale_teleriscaldamento==='Sì'?' × 0.80 (teleriscaldamento)':''}`, variables:{tipo:tipo_generatore,Pn,Hr,Ci,Ce,durata} };
            }
        },
        'solare-termico': {
            name: '2.D - Installazione di collettori solari termici',
            description: 'Art. 8, comma 1, lett. d) - Installazione di impianti solari termici per la produzione di acqua calda sanitaria (ACS), riscaldamento o solar cooling utilizzando l\'energia solare.',
            category: 'Fonti Rinnovabili',
                allowedOperators: ['pa', 'private_tertiary_person', 'private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large', 'private_residential'],
                restrictionNote: 'Ammesso per tutti i soggetti. Solare termico è fonte rinnovabile.',
            inputs: [
                { id: 'costo_totale', name: 'Costo totale intervento (€)', type: 'number', min: 0, help: 'Necessario per calcolo premialità 100%' },
                { id: 'superficie_lorda', name: 'Superficie solare lorda Sl (m²)', type: 'number', min: 0, step: 0.01 },
                { id: 'tipo_impianto', name: 'Tipo di impianto', type: 'select', options: ['Produzione ACS', 'Produzione ACS + riscaldamento', 'Collettori a concentrazione', 'Solar cooling'] },
                { id: 'tipo_collettore', name: 'Tipo collettore (se applicabile)', type: 'select', options: ['Piani vetrati', 'Sottovuoto', 'Concentrazione', 'N/A'] },
                { id: 'qcol', name: 'Energia annua Qcol da certificazione (kWh) - opzionale', type: 'number', min: 0, step: 0.1 }
            ],
            calculate: (params, operatorType) => {
                const { superficie_lorda, tipo_impianto, tipo_collettore, qcol } = params;
                if (!superficie_lorda || !tipo_impianto) return 0;
                
                // Formula: Ia_tot = Ci × Qu × Sl
                // dove Qu = Qcol/AG (energia per m²)
                
                // Tabella 16: Ci in base a Sl e tipo impianto
                let ci;
                if (superficie_lorda < 12) {
                    if (tipo_impianto === 'Produzione ACS') ci = 0.35;
                    else if (tipo_impianto === 'Produzione ACS + riscaldamento') ci = 0.36;
                    else if (tipo_impianto === 'Collettori a concentrazione') ci = 0.38;
                    else ci = 0.43; // Solar cooling
                } else if (superficie_lorda < 50) {
                    if (tipo_impianto === 'Produzione ACS') ci = 0.32;
                    else if (tipo_impianto === 'Produzione ACS + riscaldamento') ci = 0.33;
                    else if (tipo_impianto === 'Collettori a concentrazione') ci = 0.35;
                    else ci = 0.40;
                } else if (superficie_lorda < 200) {
                    ci = tipo_impianto === 'Solar cooling' ? 0.17 : 0.13;
                } else if (superficie_lorda < 500) {
                    ci = tipo_impianto === 'Solar cooling' ? 0.15 : 0.12;
                } else {
                    ci = tipo_impianto === 'Solar cooling' ? 0.14 : 0.11;
                }
                
                // Qu: energia termica prodotta per m²
                // Se fornito Qcol dalla certificazione, usalo
                // Altrimenti stima generica (da Tabella 17: Tm 50°C per ACS, 75°C per processo/cooling)
                let qu;
                if (qcol && qcol > 0) {
                    qu = qcol; // già in kWh, assumiamo per m² o totale
                } else {
                    // Stime conservative basate su tipo collettore e applicazione
                    if (tipo_collettore === 'Piani vetrati') qu = 400;
                    else if (tipo_collettore === 'Sottovuoto') qu = 600;
                    else if (tipo_collettore === 'Concentrazione') qu = 800;
                    else qu = 500; // default
                }
                
                // Incentivo annuo
                const incentivo_annuo = ci * qu * superficie_lorda;
                
                // Incentivo totale
                const durata = operatorType === 'pa' ? 5 : 2;
                return incentivo_annuo * durata;
            },
            explain: (params, operatorType) => {
                const { superficie_lorda, tipo_impianto, tipo_collettore, qcol } = params;
                const Sl=superficie_lorda||0; let Ci;
                if (Sl<12){ if (tipo_impianto==='Produzione ACS') Ci=0.35; else if (tipo_impianto==='Produzione ACS + riscaldamento') Ci=0.36; else if (tipo_impianto==='Collettori a concentrazione') Ci=0.38; else Ci=0.43; }
                else if (Sl<50){ if (tipo_impianto==='Produzione ACS') Ci=0.32; else if (tipo_impianto==='Produzione ACS + riscaldamento') Ci=0.33; else if (tipo_impianto==='Collettori a concentrazione') Ci=0.35; else Ci=0.40; }
                else if (Sl<200){ Ci = tipo_impianto==='Solar cooling'?0.17:0.13; }
                else if (Sl<500){ Ci = tipo_impianto==='Solar cooling'?0.15:0.12; } else { Ci = tipo_impianto==='Solar cooling'?0.14:0.11; }
                let Qu; if (qcol&&qcol>0) Qu=qcol; else { if (tipo_collettore==='Piani vetrati') Qu=400; else if (tipo_collettore==='Sottovuoto') Qu=600; else if (tipo_collettore==='Concentrazione') Qu=800; else Qu=500; }
                const Ia_annuo = Ci * Qu * Sl; const durata = operatorType==='pa'?5:2; const tot=Ia_annuo*durata;
                return { result: tot, formula:`Ia_tot = Ci × Qu × Sl × durata`, variables:{Ci,Qu,Sl,durata} };
            }
        },
        'scaldacqua-pdc': {
            name: '2.E - Sostituzione con scaldacqua a pompa di calore',
            description: 'Art. 8, comma 1, lett. e) - Sostituzione di scaldacqua elettrici tradizionali o a gas con scaldacqua a pompa di calore ad alta efficienza per la produzione di acqua calda sanitaria.',
            category: 'Fonti Rinnovabili',
                allowedOperators: ['pa', 'private_tertiary_person', 'private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large', 'private_residential'],
                restrictionNote: 'Ammesso per tutti i soggetti. Scaldacqua a pompa di calore elettrica.',
            inputs: [
                { id: 'capacita', name: 'Capacità del serbatoio (litri)', type: 'number', min: 80 },
                { id: 'classe_energetica', name: 'Classe energetica (Reg. EU 812/2013)', type: 'select', options: ['Classe A', 'Classe A+'] },
                { id: 'costo_totale', name: 'Costo totale intervento (€)', type: 'number', min: 0 }
            ],
            calculate: (params, operatorType) => {
                const { capacita, classe_energetica, costo_totale } = params;
                if (!capacita || !classe_energetica || !costo_totale) return 0;
                
                // Formula: Incentivo = 40% della spesa sostenuta
                // con tetti massimi per classe e capacità
                
                let incentivo = 0.40 * costo_totale;
                
                // Tetti massimi secondo sezione 2.5
                let imax;
                if (classe_energetica === 'Classe A') {
                    imax = capacita <= 150 ? 500 : 1100;
                } else { // Classe A+
                    imax = capacita <= 150 ? 700 : 1500;
                }
                
                return Math.min(incentivo, imax);
            },
            explain: (params) => {
                const { capacita, classe_energetica, costo_totale } = params; const cap=capacita||0;
                let imax; if (classe_energetica==='Classe A') imax = cap<=150?500:1100; else imax = cap<=150?700:1500;
                const base = 0.40*(costo_totale||0); const finale=Math.min(base, imax);
                return { result: finale, formula:`Itot = 40% × Spesa; Imas=${imax.toLocaleString('it-IT')}€`, variables:{Spesa:costo_totale||0,Imas:imax}, steps:[`Base=0.40×${(costo_totale||0).toFixed(2)}=${base.toFixed(2)}`,`Finale=min(${base.toFixed(2)}, ${imax})=${finale.toFixed(2)}`] };
            }
        },
        'teleriscaldamento': {
            name: '2.F - Teleriscaldamento alimentato da biomassa/solare termico/geotermia',
            description: 'Art. 8, comma 1, lett. f) - Allacciamento a reti di teleriscaldamento efficienti alimentate da fonti rinnovabili (biomassa, solare termico, geotermia) per ridurre l\'impatto ambientale del riscaldamento.',
            category: 'Fonti Rinnovabili',
                allowedOperators: ['pa', 'private_tertiary_person', 'private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large', 'private_residential'],
                restrictionNote: 'Ammesso per tutti i soggetti. Teleriscaldamento da fonti rinnovabili.',
            inputs: [
                { id: 'potenza_contrattuale', name: 'Potenza termica contrattuale (kW)', type: 'number', min: 0 },
                { id: 'costo_totale', name: 'Costo totale dell\'allacciamento (€)', type: 'number', min: 0 }
            ],
            calculate: (params, operatorType, contextData) => {
                const { potenza_contrattuale, costo_totale } = params;
                if (!potenza_contrattuale || !costo_totale) return 0;
                
                // Formula: Itot = percentuale × C × Pnsc
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData || {}, 'teleriscaldamento');
                const percentuale = det.p;

                let cmax;
                if (potenza_contrattuale <= 35) {
                    cmax = 200;
                } else if (potenza_contrattuale <= 100) {
                    cmax = 160;
                } else {
                    cmax = 130;
                }

                const costoAmmissibile = potenza_contrattuale * cmax;
                const costoEffettivo = Math.min(costo_totale, costoAmmissibile);

                let incentivo = percentuale * costoEffettivo;

                // Tetti massimi per fasce
                let imax;
                if (potenza_contrattuale <= 35) {
                    imax = 6500;
                } else if (potenza_contrattuale <= 100) {
                    imax = 15000;
                } else {
                    imax = 30000;
                }

                return Math.min(incentivo, imax);
            },
            explain: (params, operatorType, contextData) => {
                const { potenza_contrattuale, costo_totale } = params; const P = potenza_contrattuale || 0; let cmax, imax;
                if (P<=35){ cmax=200; imax=6500; } else if (P<=100){ cmax=160; imax=15000; } else { cmax=130; imax=30000; }
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData || {}, 'teleriscaldamento');
                const percentuale = det.p;
                const costoAmmissibile = P * cmax; const costoEffettivo = Math.min(costo_totale || 0, costoAmmissibile); const base = percentuale * costoEffettivo; const finale = Math.min(base, imax);
                return { result: finale, formula:`Itot = ${Math.round(percentuale*100)}% × min(Spesa, Pn × Cmax); Imas=${imax.toLocaleString('it-IT')}€`, variables:{Spesa:costo_totale||0,Pn:P,cmax,Imas:imax, Percentuale: percentuale}, steps:[`C_amm=P×Cmax=${P}×${cmax}=${costoAmmissibile.toFixed(2)}`,`Spesa_eff=min(${(costo_totale||0).toFixed(2)}, ${costoAmmissibile.toFixed(2)})=${costoEffettivo.toFixed(2)}`,`Base=${(percentuale).toFixed(2)}×${costoEffettivo.toFixed(2)}=${base.toFixed(2)}`,`Finale=min(${base.toFixed(2)}, ${imax})=${finale.toFixed(2)}`] };
            }
        },
        'microcogenerazione': {
            name: '2.G - Microcogenerazione alimentata da fonti rinnovabili',
            description: 'Art. 8, comma 1, lett. g) - Installazione di sistemi di microcogenerazione (potenza ≤50 kWe) alimentati da fonti rinnovabili per la produzione combinata di energia elettrica e termica.',
            category: 'Fonti Rinnovabili',
                allowedOperators: ['pa', 'private_tertiary_person', 'private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large', 'private_residential'],
                restrictionNote: 'Ammesso per tutti i soggetti. Microcogenerazione da fonti rinnovabili.',
            inputs: [
                { id: 'potenza_elettrica', name: 'Potenza elettrica nominale (kWe)', type: 'number', min: 0, max: 50 },
                { id: 'costo_totale', name: 'Costo totale intervento (€)', type: 'number', min: 0 }
            ],
            calculate: (params, operatorType, contextData) => {
                const { potenza_elettrica, costo_totale } = params;
                if (!potenza_elettrica || !costo_totale) return 0;

                // Formula: Itot = percentuale × C × Pnint
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData || {}, 'microcogenerazione');
                const percentuale = det.p;
                const cmax = 5000; // €/kWe
                const imax = 100000; // €

                const costoAmmissibile = potenza_elettrica * cmax;
                const costoEffettivo = Math.min(costo_totale, costoAmmissibile);

                const incentivo = percentuale * costoEffettivo;

                return Math.min(incentivo, imax);
            },
            explain: (params, operatorType, contextData) => {
                const { potenza_elettrica, costo_totale } = params; const P = potenza_elettrica || 0; const cmax = 5000; const imax = 100000;
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData || {}, 'microcogenerazione');
                const percentuale = det.p;
                const costoAmm = P * cmax; const costoEff = Math.min(costo_totale || 0, costoAmm); const base = percentuale * costoEff; const finale = Math.min(base, imax);
                return { result: finale, formula:`Itot = ${Math.round(percentuale*100)}% × min(Spesa, P_el × 5000€/kWe); Imas=${imax.toLocaleString('it-IT')}€`, variables:{Spesa:costo_totale||0,P_el:P,Imas:imax, Percentuale: percentuale}, steps:[`C_amm=P_el×5000=${P}×5000=${costoAmm.toFixed(2)}`,`Spesa_eff=min(${(costo_totale||0).toFixed(2)}, ${costoAmm.toFixed(2)})=${costoEff.toFixed(2)}`,`Base=${(percentuale).toFixed(2)}×${costoEff.toFixed(2)}=${base.toFixed(2)}`,`Finale=min(${base.toFixed(2)}, ${imax})=${finale.toFixed(2)}`] };
            }
        },
        'diagnosi-energetica': {
            name: 'DE - Diagnosi Energetica',
            description: 'Art. 15 - Incentivo per diagnosi energetiche preliminari e attestati di prestazione energetica. Formula: I = Superficie edificio × Costo specifico',
            category: 'Diagnosi Energetica',
            allowedOperators: ['pa', 'ets_non_economic', 'private_tertiary_person', 'private_tertiary_small', 'private_tertiary_medium', 'private_tertiary_large'],
            restrictionNote: 'Disponibile per PA, ETS non economici e soggetti privati con obbligo di diagnosi',
            inputs: [
                { 
                    id: 'superficie_edificio', 
                    name: 'Superficie utile dell\'immobile (m²)', 
                    type: 'number', 
                    min: 0,
                    help: 'Superficie utile totale dell\'edificio oggetto di diagnosi'
                },
                { 
                    id: 'tipo_edificio', 
                    name: 'Destinazione d\'uso edificio', 
                    type: 'select', 
                    options: [
                        { value: 'e1_fino_1600', label: 'Edifici residenziali classe E1 - fino a 1600 m²' },
                        { value: 'e1_oltre_1600', label: 'Edifici residenziali classe E1 - oltre 1600 m²' },
                        { value: 'e3_ospedale', label: 'Edifici classe E3 (Ospedali e case di cura)' },
                        { value: 'altri_fino_2500', label: 'Altri edifici - fino a 2500 m²' },
                        { value: 'altri_oltre_2500', label: 'Altri edifici - oltre 2500 m²' }
                    ],
                    help: 'Seleziona la categoria dell\'edificio secondo il decreto'
                },
                { 
                    id: 'costo_sostenuto', 
                    name: 'Costo sostenuto per la diagnosi (€)', 
                    type: 'number', 
                    min: 0,
                    help: 'Costo effettivamente sostenuto per la diagnosi energetica'
                }
            ],
            calculate: (params, operatorType, contextData) => {
                const { superficie_edificio, tipo_edificio, costo_sostenuto } = params;
                if (!superficie_edificio || !tipo_edificio || !costo_sostenuto) return 0;
                
                // Determinazione costo specifico e massimali secondo tabella decreto
                let costoSpecifico, valoreMassimoErogabile;
                
                switch(tipo_edificio) {
                    case 'e1_fino_1600':
                        costoSpecifico = 1.50;
                        valoreMassimoErogabile = 10000;
                        break;
                    case 'e1_oltre_1600':
                        costoSpecifico = 1.00;
                        valoreMassimoErogabile = 10000;
                        break;
                    case 'e3_ospedale':
                        costoSpecifico = 3.50;
                        valoreMassimoErogabile = 18000;
                        break;
                    case 'altri_fino_2500':
                        costoSpecifico = 2.50;
                        valoreMassimoErogabile = 13000;
                        break;
                    case 'altri_oltre_2500':
                        costoSpecifico = 2.00;
                        valoreMassimoErogabile = 13000;
                        break;
                    default:
                        costoSpecifico = 2.50;
                        valoreMassimoErogabile = 13000;
                }
                
                // Determina la percentuale di incentivo centralmente
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData || {}, 'diagnosi-energetica');
                const percentuale = det.p;
                
                // Formula: I = Superficie edificio × Costo specifico × Percentuale
                const incentivoCalcolato = superficie_edificio * costoSpecifico * percentuale;
                
                // Limita il costo massimo riconosciuto
                const costoMassimoRiconosciuto = superficie_edificio * costoSpecifico;
                const costoEffettivo = Math.min(costo_sostenuto, costoMassimoRiconosciuto);
                
                // Calcola l'incentivo basato sul costo effettivo
                const incentivoFinale = costoEffettivo * percentuale;
                
                // Applica il limite massimo erogabile
                return Math.min(incentivoFinale, valoreMassimoErogabile);
            },
            explain: (params, operatorType, contextData) => {
                const { superficie_edificio, tipo_edificio, costo_sostenuto } = params;
                
                if (!superficie_edificio || !tipo_edificio || !costo_sostenuto) {
                    return {
                        result: 0,
                        formula: 'Parametri mancanti',
                        variables: {},
                        steps: ['Inserire superficie edificio, tipo edificio e costo sostenuto']
                    };
                }
                
                // Determinazione parametri
                let costoSpecifico, valoreMassimoErogabile, tipoDescrizione;
                
                switch(tipo_edificio) {
                    case 'e1_fino_1600':
                        costoSpecifico = 1.50;
                        valoreMassimoErogabile = 10000;
                        tipoDescrizione = 'Edifici E1 ≤ 1600 m²';
                        break;
                    case 'e1_oltre_1600':
                        costoSpecifico = 1.00;
                        valoreMassimoErogabile = 10000;
                        tipoDescrizione = 'Edifici E1 > 1600 m²';
                        break;
                    case 'e3_ospedale':
                        costoSpecifico = 3.50;
                        valoreMassimoErogabile = 18000;
                        tipoDescrizione = 'Edifici E3 (Ospedali)';
                        break;
                    case 'altri_fino_2500':
                        costoSpecifico = 2.50;
                        valoreMassimoErogabile = 13000;
                        tipoDescrizione = 'Altri edifici ≤ 2500 m²';
                        break;
                    case 'altri_oltre_2500':
                        costoSpecifico = 2.00;
                        valoreMassimoErogabile = 13000;
                        tipoDescrizione = 'Altri edifici > 2500 m²';
                        break;
                    default:
                        costoSpecifico = 2.50;
                        valoreMassimoErogabile = 13000;
                        tipoDescrizione = 'Altri edifici';
                }
                
                // Percentuale (centralizzata)
                const det = calculatorData.determinePercentuale(contextData?.selectedInterventions || [], params, operatorType, contextData || {}, 'diagnosi-energetica');
                const percentuale = det.p;
                const percentualeDesc = det.pDesc;
                
                // Calcoli
                const costoMassimoRiconosciuto = superficie_edificio * costoSpecifico;
                const costoEffettivo = Math.min(costo_sostenuto, costoMassimoRiconosciuto);
                const incentivoCalcolato = costoEffettivo * percentuale;
                const incentivoFinale = Math.min(incentivoCalcolato, valoreMassimoErogabile);
                
                const superaCostoMax = costo_sostenuto > costoMassimoRiconosciuto;
                const superaVMax = incentivoCalcolato > valoreMassimoErogabile;
                
                return {
                    result: incentivoFinale,
                    formula: `I = min(min(Costo sostenuto, Superficie × C_specifico) × Percentuale, V_max)`,
                    variables: { 
                        Superficie: superficie_edificio,
                        CostoSpecifico: costoSpecifico,
                        Percentuale: percentuale,
                        PercentualeDesc: percentualeDesc,
                        CostoSostenuto: costo_sostenuto,
                        ValoreMassimoErogabile: valoreMassimoErogabile,
                        TipoEdificio: tipoDescrizione
                    },
                    steps: [
                        `Tipo edificio: ${tipoDescrizione}`,
                        `Superficie: ${superficie_edificio.toLocaleString('it-IT')} m²`,
                        `Costo specifico: ${costoSpecifico.toFixed(2)} €/m²`,
                        `Percentuale incentivazione: ${percentualeDesc}`,
                        `Costo massimo riconosciuto: ${superficie_edificio.toLocaleString('it-IT')} × ${costoSpecifico.toFixed(2)} = ${costoMassimoRiconosciuto.toLocaleString('it-IT', {minimumFractionDigits: 2})} €`,
                        superaCostoMax 
                            ? `⚠️ Costo sostenuto (${costo_sostenuto.toLocaleString('it-IT', {minimumFractionDigits: 2})} €) supera il massimo! Uso ${costoMassimoRiconosciuto.toLocaleString('it-IT', {minimumFractionDigits: 2})} €`
                            : `✓ Costo sostenuto (${costo_sostenuto.toLocaleString('it-IT', {minimumFractionDigits: 2})} €) entro il limite`,
                        `Costo effettivo: ${costoEffettivo.toLocaleString('it-IT', {minimumFractionDigits: 2})} €`,
                        `Incentivo calcolato: ${costoEffettivo.toLocaleString('it-IT', {minimumFractionDigits: 2})} × ${(percentuale*100).toFixed(0)}% = ${incentivoCalcolato.toLocaleString('it-IT', {minimumFractionDigits: 2})} €`,
                        superaVMax 
                            ? `⚠️ Supera valore massimo erogabile! Limite: ${valoreMassimoErogabile.toLocaleString('it-IT')} €`
                            : `✓ Entro valore massimo erogabile (${valoreMassimoErogabile.toLocaleString('it-IT')} €)`,
                        `Incentivo finale: ${incentivoFinale.toLocaleString('it-IT', {minimumFractionDigits: 2})} €`
                    ]
                };
            }
        }
    },

    // Definizione delle premialità e maggiorazioni
    premiums: {
        // NOTE: multi-intervento non è più applicato come maggiorazione percentuale sull'incentivo
        // (es. non aumentiamo il valore calcolato dal 25% al 30% con un moltiplicatore). La regola
        // di multi-intervento è gestita centralmente nella funzione `determinePercentuale` che
        // imposta la percentuale p = 55% per gli interventi 1.A/1.B quando applicabile. Manteniamo
        // una definizione descrittiva qui solo per scopo informativo/di UI.
        'multi-intervento': {
            name: 'Premialità Multi-intervento',
            description: 'Regola multi-intervento: imposta p = 55% per 1.A e (condizionalmente) per 1.B quando combinati con interventi Titolo III. NON è applicata come maggiorazione percentuale addizionale sul valore già calcolato.',
            scope: 'per-intervention',
            type: 'flag',
            value: 0,
            applicableToInterventions: ['isolamento-opache', 'sostituzione-infissi'],
            isApplicable: (selectedInterventions) => {
                const hasTitoloII = selectedInterventions.some(id => id === 'isolamento-opache' || id === 'sostituzione-infissi');
                const hasTitoloIII = selectedInterventions.some(id => {
                    return ['pompa-calore', 'sistemi-ibridi', 'biomassa', 'scaldacqua-pdc'].includes(id);
                });
                return hasTitoloII && hasTitoloIII;
            }
        },
        'prodotti-ue': {
            name: 'Premio prodotti UE (+10%)',
            description: 'Maggiorazione del 10% per componenti tecnologici prodotti nell\'Unione Europea (Art. 5). Richiede documentazione attestante la produzione europea.',
            scope: 'per-intervention',
            type: 'percentage',
            value: 10, // +10% sull'incentivo base
            applicableToInterventions: [
                'isolamento-opache',
                'sostituzione-infissi',
                'schermature-solari',
                'nzeb',
                'illuminazione-led',
                'building-automation'
            ],
            requiresDocumentation: 'Attestazione ufficiale che certifica la produzione europea dei componenti',
            isApplicable: (selectedInterventions) => {
                // Verifica che almeno un intervento selezionato sia tra quelli ammissibili
                const eligibleInterventions = [
                    'isolamento-opache',
                    'sostituzione-infissi',
                    'schermature-solari',
                    'nzeb',
                    'illuminazione-led',
                    'building-automation',
                    'fotovoltaico-accumulo'
                ];
                return selectedInterventions.some(int => eligibleInterventions.includes(int));
            }
        },

        'emissioni-biomassa': {
            name: 'Maggiorazione biomassa 5 stelle (+20%)',
            description: 'Premio del 20% per generatori a biomassa con classe emissioni 5 stelle',
            scope: 'per-intervention',
            type: 'percentage',
            value: 20, // +20% sull'incentivo calcolato
            applicableToInterventions: ['biomassa'],
            isApplicable: (selectedInterventions, inputs) => {
                return selectedInterventions.includes('biomassa') && 
                       inputs.biomassa?.emissioni === '5';
            }
        }
    },

    /**
     * Calcola l'incentivo totale per più interventi combinati
     * @param {Array} selectedInterventions - Array di ID interventi selezionati
     * @param {Object} inputsByIntervention - Oggetto con parametri per ogni intervento { interventionId: params }
     * @param {String} operatorType - Tipo di operatore (pa, private_tertiary, private_residential)
     * @param {Array} globalPremiums - Array di ID premialità globali selezionate
     * @param {Object} contextData - Dati di contesto aggiuntivi: { buildingSubcategory, popolazione_comune, subjectType }
     * @returns {Object} - { total, details: [{id, name, baseIncentive, appliedPremiums, finalIncentive}], appliedGlobalPremiums }
     */
    calculateCombinedIncentives: function(selectedInterventions, inputsByIntervention, operatorType, globalPremiums = [], contextData = {}) {
        const details = [];
        let sumBaseIncentives = 0;

        // VERIFICA CONDIZIONI PER INCENTIVO AL 100%
        // 1. Art. 48-ter: scuole, ospedali, carceri (PA/ETS)
        const isArt48ter = contextData.buildingSubcategory && 
                          ['tertiary_school', 'tertiary_hospital'].includes(contextData.buildingSubcategory);
        
        // 2. Comuni < 15.000 abitanti - SOLO per Comuni con intervento diretto su edificio di proprietà e utilizzo comunale
        // Requisiti cumulativi:
        // - Deve essere un Comune (non altra PA)
        // - Edificio di proprietà E utilizzato dal Comune
        // - Popolazione < 15.000 abitanti
        // - Modalità: intervento diretto
        const isPiccoloComune = contextData.is_comune === true && 
                               contextData.is_edificio_comunale === true &&
                               contextData.is_piccolo_comune === true &&
                               contextData.subjectType === 'pa' &&
                               contextData.implementationMode === 'direct';
        
        const hasIncentivo100 = isArt48ter || isPiccoloComune;

        if (hasIncentivo100) {
            // Modalità speciale (parziale): applichiamo incentivo 100% solo alle tipologie ammissibili.
            const piccoloComuneExclusions = ['infrastrutture-ricarica', 'fotovoltaico-accumulo'];
            let totalCost = 0;
            let totalImas = 0;
            let applied100Total = 0;
            let applied100Count = 0;

            selectedInterventions.forEach(intId => {
                const intervention = this.interventions[intId];
                if (!intervention || !intervention.calculate) {
                    details.push({
                        id: intId,
                        name: intervention?.name || intId,
                        baseIncentive: 0,
                        appliedPremiums: [],
                        finalIncentive: 0,
                        error: 'Calcolo non disponibile'
                    });
                    return;
                }

                const params = inputsByIntervention[intId] || {};
                let costInput = params.costo_totale || params.spesa_totale || params.costo_intervento || 0;
                if (!costInput) {
                    // Check common table-like fields that contain per-row costo_totale (e.g. righe_opache, righe_schermature, righe_pompe)
                    const rowArrays = Object.keys(params).filter(k => Array.isArray(params[k]));
                    for (const k of rowArrays) {
                        const arr = params[k];
                        // Sum any costo_totale fields present in the rows
                        const s = arr.reduce((sum, r) => sum + (parseFloat(r?.costo_totale) || 0), 0);
                        if (s > 0) { costInput = s; break; }
                    }

                    // Fallbacks: superficie*costo_specifico or single-field costo_totale
                    if (!costInput) {
                        if (params.superficie && params.costo_specifico) {
                            costInput = params.superficie * params.costo_specifico;
                        } else if (params.potenza_contrattuale && params.costo_totale) {
                            costInput = params.costo_totale;
                        }
                    }
                }

                let imas = 0;
                try {
                    imas = intervention.calculate(params, operatorType, contextData);
                } catch (error) {
                    details.push({
                        id: intId,
                        name: intervention.name,
                        baseIncentive: 0,
                        appliedPremiums: [],
                        finalIncentive: 0,
                        error: error.message
                    });
                    return;
                }

                totalCost += costInput;
                totalImas += imas;

                const apply100 = isArt48ter || (isPiccoloComune && !piccoloComuneExclusions.includes(intId));
                if (apply100) {
                    const incentivo100 = Math.min(costInput, imas);
                    let incentivo100Reason = isArt48ter ? `Art. 48-ter (${contextData.buildingSubcategory})` : `Comune < 15.000 abitanti`;
                    details.push({
                        id: intId,
                        name: intervention.name,
                        baseIncentive: incentivo100,
                        appliedPremiums: [{ id: 'incentivo-100-auto', name: `Incentivo al 100% - ${incentivo100Reason}`, value: incentivo100 }],
                        finalIncentive: incentivo100,
                        note: `100% spesa (€${costInput.toLocaleString('it-IT')}), max Imas €${imas.toLocaleString('it-IT')}`
                    });
                    sumBaseIncentives += incentivo100;
                    applied100Total += incentivo100;
                    applied100Count += 1;
                } else {
                    details.push({
                        id: intId,
                        name: intervention.name,
                        baseIncentive: imas,
                        appliedPremiums: [],
                        finalIncentive: imas,
                        note: `Imas calcolato: €${imas.toLocaleString('it-IT')}`
                    });
                    sumBaseIncentives += imas;
                }
            });

            if (applied100Count > 0) {
                let premiumNote = isArt48ter
                    ? `Art. 48-ter applicato automaticamente per ${contextData.buildingSubcategory}. Incentivo al 100% della spesa ammissibile (totale spesa: €${totalCost.toLocaleString('it-IT')}, tetto massimo: €${totalImas.toLocaleString('it-IT')})`
                    : `Maggiorazione per Comune sotto 15.000 abitanti applicata per alcuni interventi. Incentivo al 100% della spesa ammissibile per gli interventi ammissibili (totale spesa: €${totalCost.toLocaleString('it-IT')}, tetto massimo: €${totalImas.toLocaleString('it-IT')}).`;

                return {
                    total: sumBaseIncentives,
                    subtotal: sumBaseIncentives,
                    details,
                    appliedGlobalPremiums: [{
                        id: 'incentivo-100-auto',
                        name: isArt48ter ? 'Incentivo 100% - Art. 48-ter' : 'Incentivo 100% - Piccolo Comune (parziale)',
                        value: applied100Total,
                        note: premiumNote
                    }],
                    wasCapped: false,
                    originalTotal: sumBaseIncentives,
                    isIncentivo100: true
                };
            }
            // Altrimenti proseguiamo con la modalità standard
        }

        // MODALITÀ STANDARD (senza incentivo al 100%)
        // 1. Calcola incentivo base per ogni intervento
        selectedInterventions.forEach(intId => {
            const intervention = this.interventions[intId];
            if (!intervention || !intervention.calculate) {
                details.push({
                    id: intId,
                    name: intervention?.name || intId,
                    baseIncentive: 0,
                    appliedPremiums: [],
                    finalIncentive: 0,
                    error: 'Calcolo non disponibile'
                });
                return;
            }

            const params = inputsByIntervention[intId] || {};
            const perInterventionPremiums = (params && params.premiums) ? { ...params.premiums } : {};
            
            // Calcola incentivo base (senza premialità globali)
            let baseIncentive = 0;
            try {
                // Passiamo contextData per permettere alle formule di valutare premialità basate
                // sul contesto (es. Art.48-ter, prodotti-ue selezionati, multi-intervento)
                baseIncentive = intervention.calculate(params, operatorType, contextData);
            } catch (error) {
                details.push({
                    id: intId,
                    name: intervention.name,
                    baseIncentive: 0,
                    appliedPremiums: [],
                    finalIncentive: 0,
                    error: error.message
                });
                return;
            }

            // Applica premialità specifiche dell'intervento (già incluse nel calculate)
            const appliedPremiums = [];
            let finalIncentive = baseIncentive;

            // Applica eventuali premi per-intervento dichiarati in calculatorData.premiums
            // Evita doppio conteggio per 'prodotti-ue' che è integrato nelle singole formule Art. 5
            for (const [premId, premData] of Object.entries(this.premiums)) {
                if (premData.scope !== 'per-intervention') continue;
                if (premId === 'prodotti-ue') continue; // Prodotti UE già integrato nelle formule
                
                // Per multi-intervento: comportamento speciale
                // Non applichiamo più una maggiorazione percentuale monetaria (es. non moltiplichiamo il valore calcolato).
                // La regola multi-intervento è già gestita nella funzione `determinePercentuale` (p = 55%).
                if (premId === 'multi-intervento') {
                    const isApplicableToCombination = premData.isApplicable(selectedInterventions);
                    if (!isApplicableToCombination) continue;
                    const isApplicableToThisInt = premData.applicableToInterventions?.includes(intId);
                    if (!isApplicableToThisInt) continue;
                    // Registra a scopo informativo (value = 0) ma NON modifica l'incentivo calcolato
                    appliedPremiums.push({ id: premId, name: premData.name, value: 0, note: '' });
                    continue; // Passa al prossimo premio
                }
                
                // Altri premi per-intervention: richiedono selezione utente
                const selected = !!perInterventionPremiums[premId];
                const applicable = premData.applicableToInterventions?.includes('all') || premData.applicableToInterventions?.includes(intId);
                if (!selected || !applicable) continue;
                // Verifica regole specifiche
                const ok = typeof premData.isApplicable === 'function'
                    ? premData.isApplicable([intId], inputsByIntervention, operatorType)
                    : true;
                if (!ok) continue;
                
                let delta = 0;
                if (premData.type === 'percentage') {
                    delta = finalIncentive * (premData.value / 100);
                    finalIncentive += delta;
                } else if (premData.type === 'fixed') {
                    delta = premData.value;
                    finalIncentive += delta;
                }
                appliedPremiums.push({ id: premId, name: premData.name, value: delta });
            }

            details.push({
                id: intId,
                name: intervention.name,
                baseIncentive,
                appliedPremiums,
                finalIncentive
            });

            sumBaseIncentives += finalIncentive;
        });

        // 2. Applica premialità globali sulla somma
        let totalIncentive = sumBaseIncentives;
        const appliedGlobalPremiums = [];

        // Verifica se il premio multi-intervento è stato applicato (per mostrarlo nei global premiums)
        // Ora multi-intervento è puramente informativo (la regola impone p=55% tramite determinePercentuale),
        // quindi mostriamo una voce informativa se presente tra i dettagli.
        const anyMultiApplied = details.some(detail => detail.appliedPremiums?.some(p => p.id === 'multi-intervento'));
        if (anyMultiApplied) {
            appliedGlobalPremiums.push({
                id: 'multi-intervento',
                name: 'Premialità Multi-intervento',
                value: 0,
                note: 'Applicata regola multi-intervento'
            });
        }

            // Mostriamo il premio Prodotti UE come voce informativa se è stato selezionato
            // (attenzione: il valore monetario è già incluso nelle singole formule tramite la
            // percentuale calcolata centralmente, quindi qui lo registriamo solo a scopo informativo)
            const hasUE = (Array.isArray(globalPremiums) && globalPremiums.includes('prodotti-ue'))
                || (contextData && Array.isArray(contextData.selectedPremiums) && contextData.selectedPremiums.includes('prodotti-ue'))
                || false;
            if (hasUE) {
                appliedGlobalPremiums.push({
                    id: 'prodotti-ue',
                    name: 'Premio Prodotti UE',
                    value: 0,
                    note: 'Prodotti UE applicato e incluso nella percentuale di incentivo'
                });
            }

        // Maggiorazioni PMI automatiche (Titolo V - Regole Applicative CT 3.0)
        // Piccole imprese: +20% automatico
        if (operatorType === 'private_tertiary_small') {
            const smallCompanyBonus = sumBaseIncentives * 0.20;
            totalIncentive += smallCompanyBonus;
            appliedGlobalPremiums.push({
                id: 'pmi-auto-small',
                name: 'Maggiorazione piccole imprese (+20%) - applicata automaticamente',
                value: smallCompanyBonus
            });
        }

        // Medie imprese: +10% automatico
        if (operatorType === 'private_tertiary_medium') {
            const mediumCompanyBonus = sumBaseIncentives * 0.10;
            totalIncentive += mediumCompanyBonus;
            appliedGlobalPremiums.push({
                id: 'pmi-auto-medium',
                name: 'Maggiorazione medie imprese (+10%) - applicata automaticamente',
                value: mediumCompanyBonus
            });
        }

        // Diagnosi energetica: +1000€ fissi
        if (globalPremiums.includes('diagnosi-energetica')) {
            totalIncentive += 1000;
            appliedGlobalPremiums.push({
                id: 'diagnosi-energetica',
                name: 'Diagnosi energetica',
                value: 1000
            });
        }

        // 3. Verifica tetti massimi
        // Tetto generale per soggetto e per intervento (varia in base al tipo)
        const maxIncentiveByOperator = {
            'pa': 5000000, // 5M€ per PA
            'private_tertiary_person': 2000000, // 2M€ per privati terziario (non imprese)
            'private_tertiary_small': 2000000, // 2M€ per piccole imprese ed ETS economici
            'private_tertiary_medium': 2000000, // 2M€ per medie imprese
            'private_tertiary_large': 2000000, // 2M€ per grandi imprese
            'private_residential': 1000000 // 1M€ per privati residenziale
        };

        const cappedTotal = Math.min(totalIncentive, maxIncentiveByOperator[operatorType] || 2000000);

        return {
            total: cappedTotal,
            subtotal: sumBaseIncentives,
            details,
            appliedGlobalPremiums,
            wasCapped: cappedTotal < totalIncentive,
            originalTotal: totalIncentive
        };
    }
};

