# Architettura della flotta Dimora Suite

Come un unico core condiviso convive con tante personalizzazioni per-sito.

## Le tre zone di ogni sito

| Zona | Dove | Propagata dal template? |
|---|---|---|
| **Core** | `src/` (tutto tranne le due righe sotto) | **Sì** — è il prodotto comune, aggiornabile |
| **Config** | `src/data/*.json` (`content`, `policies`, `availability`, `theme`, `stripe`) + env Vercel | **No** — la cambia il proprietario dal pannello admin |
| **Override** | `src/custom/**` | **No** — codice su misura del singolo sito |

`src/data/*.json` e `src/custom/**` sono marcati `merge=local` in `.gitattributes`:
durante un update dal template si mantiene **sempre** la versione locale del sito.
Nota: `src/data/availability.ts` è **codice** (non `.json`) → fa parte del core e si propaga.

## Come nasce un sito

`bb-wizard` crea il repo del cliente dal template (`gh repo create --template`),
poi lo **collega** al template:

```
git config merge.local.driver true          # abilita il driver "keep-local"
git remote add upstream <bb-template>        # collega al template
git merge -s ours --allow-unrelated-histories upstream/main   # base di storia condivisa
```

Il merge `-s ours` **non cambia i file**: stabilisce solo una base comune, così i
futuri update sono merge a 3 vie puliti (applicano solo le novità del template).
Il cliente viene registrato in `bb-wizard/clients.json`.

Un sito già esistente si collega una volta con: `npm run link -- <cartella>` (in `bb-wizard`).

## Come si propaga una fix comune

1. Sviluppi la fix **nel template** (`bb-template`).
2. `bb-wizard update` la porta su ogni sito del manifest:
   `git fetch upstream && git merge upstream/main` → il **core** si aggiorna,
   `config` e `override` restano intatti (driver `local`) → push → redeploy.
3. I siti nuovi la ricevono già alla creazione.

Dove hai personalizzato le stesse righe del core, il merge segnala un **conflitto**
da risolvere invece di sovrascrivere: le modifiche locali non si perdono mai.

## Regola d'oro

Una modifica **fatta dentro un sito** non risale al template. Solo ciò che scrivi
**nel template** è propagabile. Prima di forkare il codice in `src/custom/`,
chiediti se la variazione può diventare **configurazione** (`src/data/*.json`):
se sì, aggiungila al core come opzione — così la capacità arriva a tutta la flotta.
