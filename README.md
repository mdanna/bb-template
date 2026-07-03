# B&B Booking Site — Template

Sistema completo di prenotazione diretta per B&B e case vacanza. Costruito con Next.js 16, React 19, TypeScript, Tailwind CSS v4, PostgreSQL, Stripe e Resend.

---

## Funzionalità

- **Sito pubblico multilingua** (9 lingue: it, en, fr, de, es, pt, zh, ja, ko)
- **Calendario disponibilità** con sincronizzazione Airbnb via iCal
- **Flusso prenotazione**: richiesta → approvazione host → pagamento anticipo → saldo
- **Pagamenti** con Stripe Checkout (anticipo configurabile, saldo al check-in)
- **Email transazionali** con Resend (conferma ospite, notifica host, promemoria saldo, ricevuta)
- **Ricevuta PDF** scaricabile con dati fiscali locatore e CIN
- **Pannello admin** per gestire prenotazioni, calendario, prezzi, contenuti, immagini
- **Tassa di soggiorno** calcolata automaticamente e mostrata in ricevuta
- **Cancellazioni** con policy di rimborso configurabile
- **Cron job** per promemoria saldo automatico (via Vercel Cron)
- **Autenticazione admin** via GitHub OAuth

---

## Stack tecnico

| Layer | Tecnologia |
|---|---|
| Framework | Next.js 16 App Router |
| UI | React 19 + Tailwind CSS v4 |
| Database | PostgreSQL (Neon) |
| Pagamenti | Stripe Checkout |
| Email | Resend |
| Auth | Auth.js (NextAuth) v5 con GitHub OAuth |
| Deploy | Vercel |
| PDF | pdf-lib |
| Test | Vitest |

---

## Struttura del progetto

```
src/
├── app/
│   ├── (site)/          # Pagine pubbliche (home, prenota, conferma, gestione)
│   ├── admin/           # Pannello admin (dashboard, prenotazioni, contenuti, policy)
│   └── api/             # API routes (prenotazioni, pagamenti, webhook, cron)
├── components/          # Componenti React
│   └── admin/           # Componenti pannello admin
├── data/                # File JSON configurazione (versionati su GitHub)
│   ├── content.json     # Testi, foto, dati struttura
│   ├── policies.json    # Policy operative (prezzi, depositi, cancellazioni)
│   └── availability.json # Prezzi per data e date bloccate
├── i18n/                # Traduzioni (9 lingue)
├── lib/                 # Librerie condivise
└── tests/               # Test Vitest
```

---

## File di configurazione chiave

### `src/data/content.json`
Contiene tutti i dati della struttura: nome, indirizzo, contatti, foto, testi, recensioni, mappa. Editabile dal pannello admin → Contenuti. Le modifiche vengono committate su GitHub e deployate automaticamente da Vercel in 1-2 minuti.

Campi principali:
- `siteTitle` — nome struttura in 9 lingue
- `hostName` — nome del locatore (appare nella ricevuta PDF)
- `vatNumber` — P.IVA o codice fiscale del locatore (appare nella ricevuta PDF)
- `cin` — Codice Identificativo Nazionale (appare nel footer del sito)
- `address`, `phone`, `email`, `bookingEmail` — contatti
- `airbnbUrl` — URL profilo Airbnb (per il badge rating)

### `src/data/policies.json`
Contiene tutte le policy operative. Editabile dal pannello admin → Policy.

Campi principali:
- `airbnbIcalUrl` — URL iCal per sincronizzazione prenotazioni Airbnb
- `cityTaxPerPersonPerNight` — tassa di soggiorno euro/persona/notte
- `cityTaxMaxNights` — numero massimo di notti su cui applicare la tassa
- `minDepositRate` — percentuale minima anticipo (es. 0.2 = 20%)
- `cancelFullRefundDays` — giorni prima del check-in per rimborso totale
- `cancelHalfRefundDays` — giorni prima del check-in per rimborso parziale
- `cancelPartialRefundPct` — percentuale rimborso parziale
- `cancelFeePercent` — commissione trattenuta su rimborsi
- `minAdvanceBookingDays` — anticipo minimo per prenotare
- `minNights` / `maxNights` — soggiorno minimo e massimo
- `checkinTime` / `checkoutTime` — orari (es. "14:00", "10:00")

### `src/data/availability.json`
Contiene il prezzo base giornaliero e gli override per data (prezzi speciali, date bloccate, prenotazioni). Editabile dal pannello admin → Calendario.

---

## Flusso di una prenotazione

```
1. Ospite seleziona date sul calendario
2. Compila il form → email "Richiesta ricevuta" all'ospite + notifica all'host
3. Host va su /admin → approva con prezzo (opzionale prezzo personalizzato)
4. Ospite riceve email con link pagamento anticipo
5. Ospite paga anticipo via Stripe Checkout
6. Webhook Stripe → prenotazione marcata "completed"
7. Ospite riceve email di conferma con link ricevuta PDF e gestione prenotazione
8. Cron job invia promemoria saldo N giorni prima del check-in
9. Ospite paga saldo online o al check-in
```

---

## Servizi esterni necessari

### 1. PostgreSQL — Neon (gratuito)
1. Crea account su [neon.tech](https://neon.tech)
2. Crea un nuovo progetto
3. Copia la "Connection string" → `DATABASE_URL`

Lo schema viene creato automaticamente al primo avvio. Tabella principale: `bookings` con campi `code`, `first_name`, `last_name`, `email`, `phone`, `guests`, `checkin`, `checkout`, `total_price`, `deposit_amount`, `deposit_rate`, `balance_due`, `city_tax`, `status`, `locale`, `payment_method`, `paid_at`, `stripe_session_id`, `message`, `custom_price`, `created_at`.

### 2. Stripe (pay-per-use)
1. Crea account su [stripe.com](https://stripe.com)
2. **API Keys** → copia `Secret key` → `STRIPE_SECRET_KEY`
3. **Webhook** → aggiungi endpoint `https://<tuo-dominio>/api/stripe/webhook`
   - Evento: `checkout.session.completed`
   - Copia `Signing secret` → `STRIPE_WEBHOOK_SECRET`

Carta di test: `4242 4242 4242 4242`, scadenza qualsiasi, CVC qualsiasi.

Il sistema gestisce due sessioni Stripe distinte:
- **Anticipo** — `/api/bookings/[code]/checkout` (al momento dell'approvazione)
- **Saldo** — `/api/pay-balance` (prima del check-in)

### 3. Resend (gratuito fino a 3.000 email/mese)
1. Crea account su [resend.com](https://resend.com)
2. Aggiungi e verifica il tuo dominio email
3. Crea una API key → `RESEND_API_KEY`
4. L'indirizzo mittente usa `bookingEmail` da `content.json`

Email inviate:
- Auto-reply ospite (richiesta ricevuta)
- Notifica host (nuova richiesta)
- Approvazione con link pagamento anticipo
- Conferma pagamento con link ricevuta PDF
- Promemoria saldo (N giorni prima del check-in, configurabile)
- Ricevuta saldo
- Cancellazione con importo rimborso

### 4. GitHub OAuth App — Login admin
1. [github.com/settings/developers](https://github.com/settings/developers) → OAuth Apps → New OAuth App
2. Authorization callback URL: `https://<tuo-dominio>/api/auth/callback/github`
3. `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`
4. Genera `AUTH_SECRET` con `openssl rand -base64 33`
5. Imposta `ADMIN_GITHUB_LOGINS` con il tuo username GitHub

### 5. GitHub Fine-grained Token — Salvataggio dati
Il pannello admin salva `content.json` e `policies.json` direttamente su GitHub via API, triggerando il deploy automatico su Vercel.

1. [github.com/settings/tokens](https://github.com/settings/tokens) → Fine-grained tokens → Generate new token
2. Repository access: solo questo repo
3. Permissions → Contents: Read and write
4. `GITHUB_BOT_TOKEN`

---

## Deploy su Vercel

1. Importa il repo su [vercel.com](https://vercel.com) → New Project
2. Framework: Next.js (rilevato automaticamente)
3. Aggiungi tutte le variabili d'ambiente da `.env.local.example`
4. Deploy

Il cron job in `vercel.json` esegue `/api/cron/balance-reminder` ogni giorno alle 08:00 UTC. Richiede `CRON_SECRET` configurato.

---

## Sviluppo locale

```bash
npm install
cp .env.local.example .env.local
# Compila .env.local con le tue credenziali
npm run dev
# Test
npm test
```

---

## Pannello admin (`/admin`)

Login via GitHub OAuth. Sezioni:
- **Dashboard** — statistiche prenotazioni e incassi
- **Prenotazioni** — approvazione, rifiuto, cancellazione, archivio
- **Calendario** — prezzi per data, blocchi, prenotazioni dirette, sync Airbnb
- **Contenuti** — testi, foto, dati struttura (scrive `content.json` su GitHub)
- **Policy** — tariffe, depositi, cancellazioni (scrive `policies.json` su GitHub)
- **Immagini** — upload foto galleria

---

## Sincronizzazione Airbnb

Configura `airbnbIcalUrl` in `policies.json`. La sync viene triggerata manualmente dal pannello admin o automaticamente al caricamento del calendario admin.

Colori calendario: **rosso** = Airbnb, **viola** = prenotazione diretta, **grigio** = blocco manuale.

---

## Ricevuta PDF

Generata da `/api/bookings/[code]/receipt` (richiede token firmato). Contiene dati locatore (`hostName`, `address`, `vatNumber`) e dati immobile (`siteTitle`, `address`, `cin`) da `content.json`. Disponibile in 6 lingue (per zh/ja/ko viene usato l'inglese per compatibilità font).

---

## Sicurezza

- Link email firmati con HMAC-SHA256, scadenza 30 giorni (`src/lib/accessToken.ts`)
- Webhook Stripe verificato con firma
- Rate limiting sulle API pubbliche (`src/lib/rateLimit.ts`)
- Admin protetto da sessione GitHub OAuth
- Cron job protetto da `CRON_SECRET`

---

## Localizzazione

File traduzioni: `src/i18n/locales/[locale].ts`. Lingua rilevata dal browser, salvata in `localStorage` con chiave `bb-locale`. I campi `L10n` in `content.json` hanno una versione per ogni lingua, traducibili automaticamente dal pannello admin via Claude AI (`ANTHROPIC_API_KEY` opzionale).
