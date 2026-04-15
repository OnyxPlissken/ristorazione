# Strategia Di Riuso OSS

## Regola Operativa

La richiesta giusta non e': "copiamo tutto".

La richiesta giusta e':

1. copiare o adattare solo codice con licenza compatibile
2. usare come riferimento architetturale quello che ha licenze forti o ambigue
3. concentrare il codice proprietario sul dominio che crea vantaggio: orchestrazione ristorante, QR self-order, split bill, multi-location, staffing e integrazioni

## Guardrail Legali

- `MIT` / `Apache-2.0`: candidati buoni per fork, porting e adattamento
- `AGPL-3.0` / `GPL-3.0`: utili come benchmark e reference implementation, ma da evitare come base se vuoi tenere il prodotto chiuso o rivendibile in SaaS senza obblighi reciproci
- `Nessuna licenza`: non copiare. GitHub ricorda che senza licenza i diritti restano all'autore

Fonte licenze GitHub:

- [Licensing a repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)

## Repositories Da Sfruttare

| Area | Repo | Licenza | Come usarlo |
| --- | --- | --- | --- |
| Core ristorante, ordini, prenotazioni | [tastyigniter/TastyIgniter](https://github.com/tastyigniter/TastyIgniter) | MIT | Miglior base pubblica oggi per menu, ordering, reservation, multi-location e backoffice ristorante |
| Prenotazioni e tavoli | [tastyigniter/ti-ext-reservation](https://github.com/tastyigniter/ti-ext-reservation) | MIT | Ottimo riferimento per reservation workflow, dining areas, tavoli, lead time, stay time, auto-assegnazione |
| Multisede e zone delivery | [tastyigniter/ti-ext-local](https://github.com/tastyigniter/ti-ext-local) | MIT | Modello utile per sedi, aree, orari, nearest location, delivery charges |
| API | [tastyigniter/ti-ext-api](https://github.com/tastyigniter/ti-ext-api) | MIT | Da riusare come approccio per esporre menu, ordini, tavoli, prenotazioni a QR app e mobile |
| Realtime eventi | [tastyigniter/ti-ext-broadcast](https://github.com/tastyigniter/ti-ext-broadcast) | MIT | Pattern buono per stati ordine, notifiche cucina e aggiornamenti live del carrello |
| Delivery dispatch | [igniter-labs/ti-ext-shipday](https://github.com/igniter-labs/ti-ext-shipday) | MIT | Utile per integrare delivery proprietario o terzi da un unico punto operativo |
| POS, tavoli, pagamenti, stampa | [rezadrian01/Kasirku](https://github.com/rezadrian01/Kasirku) | MIT | Buon acceleratore UI/UX per POS, digital menu, tracking ordine, pagamento e ricevute |
| Split bill | [spliit-app/spliit](https://github.com/spliit-app/spliit) | MIT | Da studiare per logiche di divisione conto, saldi, rimborsi e UX di settlement |
| Ottimizzazione assegnazioni | [TimefoldAI/timefold-solver](https://github.com/TimefoldAI/timefold-solver) | Apache-2.0 | Ottimo motore per assegnazione tavoli, turni staff, routing delivery e capacity planning |
| CRM e newsletter omnicanale | [dittofeed/dittofeed](https://github.com/dittofeed/dittofeed) | MIT | Perfetto per campagne, segmentazione, email e WhatsApp pilotati dagli eventi del ristorante |
| Web analytics | [umami-software/umami](https://github.com/umami-software/umami) | MIT | Analytics self-hosted semplice e compatibile con una piattaforma multi-tenant |

## Repositories Da Usare Solo Come Riferimento

| Area | Repo | Licenza / problema | Uso consigliato |
| --- | --- | --- | --- |
| Suite operativa completa ristorante | [ury-erp/ury](https://github.com/ury-erp/ury) | AGPL-3.0 | Studiare moduli, ruoli, KDS, reporting e branch analytics, ma non usarlo come base se vuoi evitare AGPL |
| Contactless ordering | [itzzritik/OrderWorder](https://github.com/itzzritik/OrderWorder) | Nessuna licenza rilevata sulla pagina repo | Usarlo solo come riferimento funzionale e UX, non copiare codice |
| Product analytics avanzata | [Openpanel-dev/openpanel](https://github.com/Openpanel-dev/openpanel) | AGPL-3.0 | Ottimo benchmark per eventi, funnel e profili, ma non consigliato come base proprietaria |

## Cosa Copierei Davvero

### Da TastyIgniter

- concetti di `Location`, `DiningArea`, `Table`, `Reservation`, `Order`, `OrderStatus`
- flusso prenotazione con vincoli di capienza, permanenza e anticipo
- gestione multi-sede e aree di consegna
- estensioni separate per dominio, non monolite hardcoded

### Da Kasirku

- customer flow `menu -> carrello -> checkout -> tracking`
- dashboard ordini e tavoli
- pattern di stampa ricevute e aggiornamento stato ordine
- struttura UI backoffice orientata a ristorante

### Da Spliit

- modello per ripartizione voci conto
- saldi tra partecipanti
- casi edge su quote custom, rimborsi, pagatore unico e divisioni non uniformi

### Da Dittofeed

- modello eventi -> segmenti -> journey -> invio
- separazione pulita tra dati clienti e motore campagne
- uso di template versionabili e automazioni event-driven

### Da Timefold

- motore vincolato per:
  - assegnazione tavolo ottimale
  - shift staff sala/cucina
  - dispatch delivery locale

## Scelta Consigliata

Se vuoi massimizzare velocita' e riuso:

- usa `TastyIgniter` come riferimento primario del dominio ristorante
- prendi da `Kasirku` solo i pattern moderni di POS e customer UI
- costruisci tu il modulo `QR + split bill + pay-at-table` perche' e' il vero punto differenziante
- collega `Dittofeed` e `Umami` come sidecar specializzati, non come parte del core

Se vuoi massimizzare controllo prodotto:

- non forkare il monolite TastyIgniter
- replica il suo dominio in un core tuo
- importa solo pattern, schema e frammenti compatibili da repo MIT/Apache

Per questa idea, consiglierei la seconda strada per il core e la prima come benchmark tecnico.

## Sorgenti

- [TastyIgniter](https://github.com/tastyigniter/TastyIgniter)
- [TastyIgniter Reservation](https://github.com/tastyigniter/ti-ext-reservation)
- [TastyIgniter Local](https://github.com/tastyigniter/ti-ext-local)
- [TastyIgniter Repositories](https://github.com/orgs/tastyigniter/repositories)
- [Shipday Extension](https://github.com/igniter-labs/ti-ext-shipday)
- [Kasirku](https://github.com/rezadrian01/Kasirku)
- [Spliit](https://github.com/spliit-app/spliit)
- [Timefold Solver](https://github.com/TimefoldAI/timefold-solver)
- [Dittofeed](https://github.com/dittofeed/dittofeed)
- [Umami](https://github.com/umami-software/umami)
- [URY](https://github.com/ury-erp/ury)
- [OrderWorder](https://github.com/itzzritik/OrderWorder)
- [OpenPanel](https://github.com/Openpanel-dev/openpanel)
