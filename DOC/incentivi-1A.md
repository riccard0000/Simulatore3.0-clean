# Specifica calcolo intervento 1.A — `isolamento-opache`

Scopo: definire in modo chiaro e ripetibile i tre termini necessari per il calcolo dell'incentivo finale secondo lo schema richiesto:

> INCENTIVO FINALE = MIN( CALCOLO INCENTIVI (Itot), Massimale Intervento (Imas), Massimale Soggetto )

Questo documento descrive: le formule, come sono mappate nel codice esistente (`data.js`), esempi numerici e casi di test raccomandati.

---

## 1. Riferimenti nel codice
- File principale: `data.js`
  - Intervento: `interventions['isolamento-opache']`
  - Nuove API aggiunte:
    - `computeItot(params, operatorType, contextData)` → calcola il valore teorico totale (Itot)
    - `getImas(params, operatorType, contextData)` → restituisce il massimale per l'intervento (Imas)
    - `calculate(params, operatorType, contextData)` → compatibilità: ritorna `min(Itot, Imas)`
  - Helper globali aggiunti vicino a `calculateCombinedIncentives`:
    - `getMassimaleSoggetto(operatorType)` → massimale per soggetto (es. 2M€ privati terziario)
    - `computeFinalForIntervention(interventionId, params, operatorType, contextData)` → ritorna `{ Itot, Imas, MassimaleSoggetto, finale }`

---

## 2. Definizioni e formule
- Itot (CALCOLO INCENTIVI)
  - Formula (riga per riga): incentivo_riga = p × min(C, Cmax_i) × S_i
  - Itot = Σ incentivo_riga per tutte le righe
  - `p` = percentuale determinata centralmente da `determinePercentuale(...)` (include condizioni multi-intervento, premio UE, Art.48-ter, ecc.)
  - Nota: Itot è il calcolo teorico prima di applicare i massimali a livello intervento o soggetto

- Imas (MASSIMALE INTERVENTO)
  - Per `1.A` (stato attuale): Imas = 1.000.000 € (costante)
  - In futuro può essere funzione di parametri; per questo è esposta come `getImas(...)`

- MassimaleSoggetto
  - Mappato centralmente in `getMassimaleSoggetto(operatorType)` con la tabella:
    - `pa`: 5.000.000 €
    - `private_tertiary_person`: 2.000.000 €
    - `private_tertiary_small`: 2.000.000 €
    - `private_tertiary_medium`: 2.000.000 €
    - `private_tertiary_large`: 2.000.000 €
    - `private_residential`: 1.000.000 €
  - Nota: può essere personalizzato in base a esigenze normative

- Incentivo finale
  - finale = min(Itot, Imas, MassimaleSoggetto)
  - Implementazione helper: `computeFinalForIntervention` restituisce i tre termini e il finale per semplice auditing

---

## 3. Mappatura parametri di input (per 1.A)
- `params` attesi (schema):
  - `righe_opache`: array di righe, ognuna con:
    - `tipologia_struttura`: string (es. `parete_esterno`)
    - `superficie`: number (m²)
    - `costo_totale`: number (€)
  - `zona_climatica`: 'A'|'B'|'C'|'D'|'E'|'F'
  - `premiums` (opzionale): oggetto con flag (es. `{ 'prodotti-ue': true }`)
- `operatorType`: string (es. `pa`, `private_tertiary_small`, ...)
- `contextData`: oggetto con `selectedInterventions`, `buildingSubcategory`, `is_comune`, etc. (usato da `determinePercentuale`)

---

## 4. Esempi numerici
Esempio 1 (zona E, singola riga):
- riga: tipologia `parete_esterno`, superficie 100 m², costo_totale 25.000 € → C = 250 €/m²
- Cmax per `parete_esterno` = 200 €/m² → Ceff = min(250,200) = 200 €/m²
- percentuale p (zona E apply only to 1.A) = 50% (0.50)
- incentivo_riga = 0.50 × 200 × 100 = 10.000 €
- Itot = 10.000 €
- Imas = 1.000.000 €
- MassimaleSoggetto (es. private_tertiary_person) = 2.000.000 €
- Finale = min(10.000, 1.000.000, 2.000.000) = 10.000 €

Esempio 2 (più righe, supera Cmax):
- Riga A: `copertura_esterno`, 50 m², costo_totale 20.000 € → C=400 €/m², Cmax=300 → Ceff=300 → I_A = p × 300 × 50
- Riga B: `parete_interno`, 80 m², costo_totale 4.000 € → C=50 €/m², Cmax=100 → Ceff=50 → I_B = p × 50 × 80
- Itot = I_A + I_B
- Finale = min(Itot, Imas=1.000.000, MassimaleSoggetto)

---

## 5. Casi di test consigliati (da automatizzare in `tests/`)
1. Zona E, singola riga (vedi Esempio 1) → verifica Itot, Imas, MassimaleSoggetto e Finale
2. Multi-intervento: `isolamento-opache` + `pompa-calore` → verifica che `determinePercentuale` ritorni 55% per 1.A quando applicabile
3. Premio Prodotti UE: caso con `premiums['prodotti-ue']=true` → verifica che `p` aumenti di 10pp (cap 100%) e che Itot accordingly aumenti
4. Art.48-ter: `buildingSubcategory: 'tertiary_school'` → verifica `p=1.0` e che `computeFinalForIntervention` applichi `min(Itot, Imas, MassimaleSoggetto)` con Itot calcolato come p×…
5. Superamento Imas: costruire Itot > 1.000.000 e verificare che finale = Imas
6. Superamento MassimaleSoggetto: costruire somma di interventi che porta finale = MassimaleSoggetto

Per ogni test suggerito usare `computeFinalForIntervention('isolamento-opache', params, opType, contextData)` e assert sulle proprietà restituite.

---

## 6. Raccomandazioni implementative e controllo regressioni
- Mantieni `calculate(...)` compatibile (ritorna ancora lo stesso valore per le chiamate esistenti). Già fatto: `calculate` ora usa `computeItot` e `getImas` internamente.
- Aggiungi test che confrontano il `calculate(...)` originale con il comportamento tramite `computeItot` + `getImas` per alcuni campioni: questo serve come baseline per evitare regressioni.
- Procedere intervento per intervento: per ogni `1.*` replicare pattern `computeItot`/`getImas`/`calculate` e adattare `explain` per mostrare Itot e Imas.

---

## 7. Prossimi passi consigliati
1. Creare test automatici per i casi elencati (file consigliato: `tests/assert-1a.js` o aggiungere a suite esistente)
2. Dopo verifica test, applicare lo stesso pattern a `1.B` (`sostituzione-infissi`) e poi alle restanti tipologie di Categoria 1
3. Aggiornare `calculateCombinedIncentives` per aggregare i risultati richiamando `computeFinalForIntervention` per ogni intervento e sommando i `finale`, tracciando anche eventuali capping per soggetto

---

Se vuoi, creo ora i test suggeriti (opzione raccomandata) oppure procedo a replicare il pattern per `1.B`.
