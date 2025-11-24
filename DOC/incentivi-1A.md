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
  - Ora calcolato come: MassimaleSoggetto = PercentualeMassimaleSoggetto × CostoAmmissibile (per singolo intervento).
  - Percentuali base utilizzate (per `operatorType`):
    - `pa`: 100% (1.00)
    - `private_tertiary_person`: 100% (1.00)
    - `private_tertiary_small`: 45% (0.45)
    - `private_tertiary_medium`: 35% (0.35)
    - `private_tertiary_large`: 25% (0.25)
    - `private_residential`: 100% (1.00)
  - Premialità selezionabili (incrementano la percentuale prima della moltiplicazione):
    - `a107_3_a`: interventi realizzati in zone assistite ai sensi dell'art.107(3)(a) → +15 punti percentuali (+0.15)
    - `a107_3_c`: interventi realizzati in zone assistite ai sensi dell'art.107(3)(c) → +5 punti percentuali (+0.05)
    - `miglioramento_40`: intervento che determina un miglioramento ≥40% della prestazione energetica → +15 punti percentuali (+0.15)
  - Nota: gli incrementi si sommano alla percentuale base e il risultato è limitato al 100% (1.0). Il `CostoAmmissibile` è calcolato per singolo intervento usando i campi `costo_totale`, somma delle righe dell'intervento o campi equivalenti presenti in `params`.

### Dettaglio esplicativo: come funzionano le premialità per il Massimale Soggetto

- Termini delle premialità che determinano il Massimale Soggetto
  - `a107_3_a` (LOCALIZZAZIONE art.107(3)(a)): +0.15 (15 punti percentuali)
  - `a107_3_c` (LOCALIZZAZIONE art.107(3)(c)): +0.05 (5 punti percentuali)
  - `miglioramento_40`: intervento che migliora la prestazione energetica ≥40%: +0.15 (15 punti percentuali)

- Come si combinano
  - Si sommano alla `basePct` definita per `operatorType` (es. `private_tertiary_medium = 0.35`).
  - A questo totale si aggiunge la maggiorazione multi-intervento di tipo B quando applicabile (+0.05): si applica se nel perimetro sono presenti più interventi di Categoria 1 o se è selezionato `nzeb` da solo.
  - Il valore finale viene limitato a 1.0 (100%).

- Formula pratica
  - `finalPct = min(1.0, basePct + sum(premialita) + multiInterventoB)`
  - `MassimaleSoggetto = finalPct × CostoAmmissibile`

- Dove leggere i flag di input (forme supportate)
  - `contextData.selectedPremiums`: array di stringhe (es. `['a107_3_a','miglioramento_40']`) — usato dal front-end nel `contextData` passato al calcolatore.
  - `contextData.premiums` o `params.premiums`: oggetto con flag booleani (es. `{ a107_3_a: true, miglioramento_40: true }`) o array equivalente.
  - flag diretti in `params` o in `contextData`: `params.a107_3_a = true` o `contextData.INCREMENTO_INT3 = true`.
  - UI alias: il front-end attiva i flag di "LOCALIZZAZIONE" come `INCREMENTO_INT3`, `INCREMENTO_INT4`, `INCREMENTO_INT5`; questi sono mappati internamente a `a107_3_a`, `a107_3_c`, `miglioramento_40` rispettivamente.

- Esempi
  - Esempio 1 — passaggio tramite `contextData.selectedPremiums`:

```js
const contextData = {
  selectedInterventions: ['isolamento-opache'],
  selectedPremiums: ['a107_3_a', 'miglioramento_40']
};
```

  - Esempio 2 — passaggio tramite `params` (object flags):

```js
const params = {
  righe_opache: [...],
  zona_climatica: 'A',
  premiums: { a107_3_a: true }
};
```

  - Esempio 3 — UI alias (come il front-end invia i flag):

```js
const contextData = {
  selectedInterventions: ['isolamento-opache'],
  selectedPremiums: ['INCREMENTO_INT3'] // internamente trattato come 'a107_3_a'
};
```

- Note operative
  - La funzione `getMassimaleSoggetto(...)` nel file `data.js` raccoglie i flag da `contextData` e da `params`, supportando le forme sopra indicate; inoltre verifica gli alias UI (`INCREMENTO_INT3/4/5`) e applica le incrementazioni in modo additive.


  - Regole speciali per `nzeb` (1.D):
    - Se l'intervento `nzeb` è selezionato, la selezione è esclusiva: altri interventi non sono considerati insieme a `nzeb` (la logica di calcolo ignora altre selezioni quando `nzeb` è presente).

  - Multi-intervento: definizioni e applicazione
    - Esistono due tipi distinti di multi-intervento rilevanti per il calcolo:
      1. Multi-intervento tipo A (percentuale di incentivazione p): è una maggiorazione della percentuale p applicabile SOLO agli interventi `1.A` e `1.B` quando sono realizzati congiuntamente ad almeno uno degli interventi di Titolo III (es. 2.A, 2.B, 2.C, 2.E). Questa logica è implementata in `determinePercentuale(...)` e modifica il valore di `p` usato per il calcolo degli incentivi (Itot) — non riguarda il Massimale Soggetto.
      2. Multi-intervento tipo B (maggiorazione percentuale sul Massimale Soggetto): è una maggiorazione della percentuale applicata al Massimale Soggetto (±5 punti percentuali). Si applica quando nel perimetro di realizzo sono presenti più interventi di Categoria 1 (es. 1.A + 1.B) oppure quando è realizzato `nzeb` da solo. A differenza del tipo A, questa maggiorazione viene applicata a TUTTI gli interventi ai fini del calcolo del Massimale Soggetto.
    - Sintesi pratica:
      - Tipo A: impatta solo `p` per 1.A/1.B e richiede la presenza di Titolo III.
      - Tipo B: impatta `MassimaleSoggetto` (finalPct) quando sono più interventi di Categoria 1 o `nzeb` selezionato; viene applicato a tutti gli interventi per il calcolo dei massimali.

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
2. Multi-intervento (tipo A): verifica dei comportamenti
  - Caso A (1.A): `isolamento-opache` + almeno uno tra `2.A`/`2.B`/`2.C`/`2.E` → `determinePercentuale` deve restituire `p = 55%` per `1.A`.
  - Caso B (1.B): `sostituzione-infissi` ottiene `p = 55%` SOLO se è presente anche `1.A` e almeno uno tra `2.A`/`2.B`/`2.C`/`2.E`; in questo caso la maggiorazione viene applicata sia a `1.A` che a `1.B`.
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
