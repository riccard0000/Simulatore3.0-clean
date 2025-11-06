/**
 * WASM Loader - Simulatore Conto Termico 3.0
 * 
 * Questo file carica il modulo WebAssembly contenente le formule di calcolo
 * protette e fornisce un'interfaccia JavaScript per utilizzarle.
 */

let wasmModule = null;
let wasmExports = null;

// Mappa dei tipi di operatore
const OPERATOR_TYPES = {
    'pa': 0,
    'private_tertiary': 1,
    'private_residential': 2
};

// Mappa delle zone climatiche
const CLIMATE_ZONES = {
    'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5
};

/**
 * Carica il modulo WASM
 */
async function loadWASM() {
    try {
        const response = await fetch('calculator.wasm');
        const buffer = await response.arrayBuffer();
        
        // AssemblyScript richiede imports per il runtime
        const imports = {
            env: {
                abort: (msg, file, line, column) => {
                    console.error(`Abort called at ${file}:${line}:${column}`);
                }
            }
        };
        
        const module = await WebAssembly.instantiate(buffer, imports);
        
        wasmModule = module.instance;
        wasmExports = module.instance.exports;
        
        console.log('✅ WASM caricato con successo');
        console.log('Funzioni disponibili:', Object.keys(wasmExports));
        
        // Verifica se ha le funzioni di calcolo necessarie
        const hasCalcFunctions = wasmExports.calc_isolamento_opache || 
                                 wasmExports.calcolaIsolamento;
        
        if (!hasCalcFunctions) {
            console.warn('⚠️  WASM non contiene funzioni di calcolo, usando JavaScript');
            // NON creare window.WASMCalculator
            window.WASMCalculator = null;
            return false;
        }
        
        // Solo se WASM ha le funzioni, crea l'oggetto
        window.WASMCalculator = {
            calculate: function(interventionId, params, operatorType) {
                if (!wasmExports) {
                    console.error('WASM non ancora caricato');
                    return 0;
                }
                
                const opType = OPERATOR_TYPES[operatorType] || 0;
                const zona = CLIMATE_ZONES[params.zona_climatica] || 0;
                
                try {
                    switch(interventionId) {
                        case 'isolamento-opache':
                            // Usa il nome corretto della funzione WASM
                            if (wasmExports.calcolaIsolamento) {
                                return wasmExports.calcolaIsolamento(
                                    parseFloat(params.superficie) || 0,
                                    parseFloat(params.costo_specifico) || 0,
                                    zona,
                                    opType,
                                    params.premiums?.['prodotti-ue'] || false
                                );
                            }
                            break;
                            
                        case 'sostituzione-infissi':
                            if (wasmExports.calcolaInfissi) {
                                return wasmExports.calcolaInfissi(
                                    parseFloat(params.superficie) || 0,
                                    parseFloat(params.costo_specifico) || 0,
                                    zona,
                                    opType,
                                    params.premiums?.['prodotti-ue'] || false
                                );
                            }
                            break;
                        
                        default:
                            console.warn(`Funzione WASM non implementata per: ${interventionId}`);
                            return null; // Segnala che deve usare JavaScript
                    }
                } catch (error) {
                    console.error('Errore nel calcolo WASM:', error);
                    return null; // Ritorna null per usare fallback JavaScript
                }
            }
        };
        
        return true;
    } catch (error) {
        console.error('❌ Errore caricamento WASM:', error);
        window.WASMCalculator = null;
        return false;
    }
}

// Esponi solo la funzione loadWASM
window.loadWASM = loadWASM;
