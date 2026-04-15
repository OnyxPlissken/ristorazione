# Coperto

Coperto e' un gestionale per ristorazione costruito con Next.js e Postgres, pensato per un uso reale in italiano.

## Cosa include

- login amministrativo con sessioni server-side
- ruoli `Admin`, `Proprietario`, `Store Manager`, `Staff`
- gestione sedi e multisede
- gestione tavoli e generazione rapida numerazione
- QR tavolo con sessione condivisa e carrello persistente
- gestione menu, sezioni e piatti
- orari di apertura e impostazioni prenotazione
- pagina pubblica `/prenota`
- pannello amministrativo `/admin`
- `Console Admin` riservata agli utenti `Admin` per feature flag, delivery, Google Business e pagamenti

## Stack

- Next.js 16
- React 19
- Prisma
- Neon Postgres su Vercel

## Script

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

## Variabili ambiente

Consulta [.env.example](.env.example).

Le variabili principali sono:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `SESSION_SECRET`

## Note locali

In questo workspace Windows sincronizzato con OneDrive la build locale puo' fallire con errori `EPERM` su cartelle di output o cache.
Le build e i deploy Vercel risultano invece funzionanti.
