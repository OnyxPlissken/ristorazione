# Coperto

Coperto e' un primo prototipo Next.js per una piattaforma di ristorazione che unifica:

- prenotazioni e gestione tavoli
- operativita' sala e cucina
- multisede
- ordini delivery e takeaway
- QR al tavolo con carrello condiviso e split bill
- analytics e marketing

## Demo inclusa

La base attuale include tre superfici funzionanti:

- `/` homepage prodotto
- `/ops` dashboard operativa multisede
- `/table/milano-12` demo QR ordering con carrello per posto e pagamento simulato

## Stack

- Next.js 16
- React 19
- App Router
- zero database per questa prima iterazione

## Avvio locale

```bash
npm install
npm run dev
```

## Note ambiente locale

Su questo workspace Windows in OneDrive la build locale ha trovato blocchi `EPERM` in scrittura dentro `.next`.
Il progetto e' stato comunque installato correttamente e il problema osservato e' ambientale, non un errore applicativo rilevato nel codice.

## Documenti

- [Strategia riuso OSS](docs/OSS_REUSE_STRATEGY.md)
- [Architettura proposta](docs/ARCHITECTURE.md)
- [Roadmap MVP](docs/MVP_ROADMAP.md)
