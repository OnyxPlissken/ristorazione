# Roadmap MVP

## MVP 1

Obiettivo: validare il flusso sala + QR + pagamento.

Scope:

- multisede base
- menu centralizzato con override per sede
- tavoli e QR per tavolo
- ordine al tavolo da smartphone
- carrello live di tavolo
- coda cucina
- pagamento al tavolo
- conto unico o split semplice
- dashboard operativa per sala

## MVP 2

Obiettivo: rendere forte la parte prenotazioni.

Scope:

- prenotazioni online
- dining areas
- auto-assegnazione tavoli
- turni e durate permanenza
- waiting list
- reminder e conferme

## MVP 3

Obiettivo: unificare delivery e takeaway.

Scope:

- ordini delivery/takeaway nello stesso backoffice
- adattatori per provider esterni
- menu sincronizzato
- stato ordine normalizzato
- reporting per canale

## MVP 4

Obiettivo: far crescere retention e margine.

Scope:

- customer profile unificato
- newsletter email
- campagne WhatsApp
- automazioni su eventi
- analytics clienti, tavoli, sedi e menu

## Ordine Di Costruzione Consigliato

1. dominio `locations/tables/menu/orders`
2. QR app e carrello real-time
3. kitchen workflow
4. pagamenti e split bill
5. prenotazioni e tavoli automatici
6. delivery adapters
7. CRM e analytics
