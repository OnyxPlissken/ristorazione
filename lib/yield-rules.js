export const YIELD_RULE_APPLY_OPTIONS = [
  {
    value: "ALWAYS",
    label: "Sempre",
    description: "Usala in ogni assegnazione automatica."
  },
  {
    value: "PEAK_SERVICE",
    label: "Ore di punta",
    description: "Usala quando un errore costa di piu: cena, weekend e serate piene."
  },
  {
    value: "HIGH_DEMAND",
    label: "Alta domanda",
    description: "Usala quando piu prenotazioni vogliono lo stesso tavolo o lo stesso orario."
  },
  {
    value: "LOW_AVAILABILITY",
    label: "Pochi tavoli liberi",
    description: "Usala quando restano pochi tavoli e serve scegliere bene."
  },
  {
    value: "NO_SINGLE_TABLE",
    label: "Nessun tavolo singolo",
    description: "Usala quando devi unire tavoli o recuperare capienza."
  },
  {
    value: "TIE_ONLY",
    label: "Solo spareggio",
    description: "Usala solo per decidere tra due opzioni quasi uguali."
  },
  {
    value: "MANUAL_ONLY",
    label: "Solo manuale",
    description: "Tienila pronta, ma non farla pesare nelle automazioni."
  }
];

export const YIELD_FEATURE_DEFINITIONS = [
  {
    slug: "motore-tavoli",
    title: "Motore tavoli",
    eyebrow: "Assegnazione",
    description: "Sceglie tavolo e prenotazione quando si libera spazio in sala.",
    promise: "Fa lavorare meglio i tavoli: meno posti buttati, piu coperti buoni, meno incastri fatti a mano.",
    rules: [
      {
        key: "exactTableFit",
        title: "Aderenza tavolo",
        description: "Dai il tavolo piu vicino ai coperti richiesti.",
        plainCopy: "Esempio: 2 persone vanno prima su un tavolo da 2, non su un 4 libero.",
        defaultEnabled: true,
        defaultApplyWhen: "ALWAYS",
        defaultPriority: 85,
        controls: [
          {
            key: "minOccupancyPercent",
            label: "Occupazione minima desiderata",
            type: "number",
            min: 0,
            max: 100,
            unit: "%",
            defaultValue: 60,
            help: "Sotto questa soglia il tavolo viene considerato sprecato."
          }
        ]
      },
      {
        key: "maximizeCovers",
        title: "Coperti prima",
        description: "Se un tavolo puo rendere di piu, dai precedenza al gruppo piu grande.",
        plainCopy: "Esempio: su un tavolo da 4 passa prima la prenotazione da 4, non quella da 2.",
        defaultEnabled: true,
        defaultApplyWhen: "PEAK_SERVICE",
        defaultPriority: 75,
        controls: [
          {
            key: "minPartySizeAdvantage",
            label: "Vantaggio minimo coperti",
            type: "number",
            min: 1,
            max: 8,
            unit: "coperti",
            defaultValue: 1,
            help: "Differenza minima per far vincere il gruppo piu grande."
          }
        ]
      },
      {
        key: "bestCustomerPriority",
        title: "Cliente migliore",
        description: "Quando due richieste si assomigliano, premia il cliente con valore migliore.",
        plainCopy: "Esempio: tra due tavoli da 4 scegli chi spende meglio o torna piu spesso.",
        defaultEnabled: true,
        defaultApplyWhen: "HIGH_DEMAND",
        defaultPriority: 70,
        controls: [
          {
            key: "minPriorityScore",
            label: "Priorita minima cliente",
            type: "number",
            min: 0,
            max: 100,
            unit: "punti",
            defaultValue: 70,
            help: "Da questo punteggio in su il cliente pesa davvero nella scelta."
          },
          {
            key: "averageSpendWeight",
            label: "Peso carrello medio",
            type: "number",
            min: 0,
            max: 100,
            unit: "punti",
            defaultValue: 55,
            help: "Quanto conta lo scontrino medio rispetto agli altri criteri."
          }
        ]
      },
      {
        key: "firstRequestTieBreak",
        title: "Prima richiesta",
        description: "Se due prenotazioni sono quasi uguali, vince chi ha prenotato prima.",
        plainCopy: "E' la regola di buon senso: la usi solo quando non c'e una scelta migliore.",
        defaultEnabled: true,
        defaultApplyWhen: "TIE_ONLY",
        defaultPriority: 40,
        controls: []
      },
      {
        key: "flexibleSlotRecovery",
        title: "Slot flessibile",
        description: "Cerca posto anche pochi minuti prima o dopo l'orario richiesto.",
        plainCopy: "Esempio: se le 20:30 sono piene, prova 20:15 o 20:45 prima di dire no.",
        defaultEnabled: true,
        defaultApplyWhen: "LOW_AVAILABILITY",
        defaultPriority: 55,
        controls: [
          {
            key: "flexMinutes",
            label: "Flessibilita massima",
            type: "number",
            min: 0,
            max: 180,
            unit: "min",
            defaultValue: 30,
            help: "Quanto puoi spostarti dall'orario richiesto."
          }
        ]
      },
      {
        key: "combineTablesForLargeParties",
        title: "Combinazione tavoli",
        description: "Unisce piu tavoli solo quando serve davvero.",
        plainCopy: "Esempio: per 7 persone puoi unire un 4 e un 3, ma non blocchi mezza sala per 2 persone.",
        defaultEnabled: true,
        defaultApplyWhen: "NO_SINGLE_TABLE",
        defaultPriority: 50,
        controls: [
          {
            key: "maxTables",
            label: "Tavoli massimi combinabili",
            type: "number",
            min: 1,
            max: 8,
            unit: "tavoli",
            defaultValue: 4,
            help: "Limite massimo di tavoli da unire per una sola prenotazione."
          }
        ]
      },
      {
        key: "turnoverBuffer",
        title: "Buffer riassetto",
        description: "Lascia tempo allo staff per liberare e rifare il tavolo.",
        plainCopy: "Esempio: se un tavolo finisce alle 21:00, non lo rivendi alle 21:00 spaccate.",
        defaultEnabled: true,
        defaultApplyWhen: "ALWAYS",
        defaultPriority: 50,
        controls: [
          {
            key: "bufferMinutes",
            label: "Minuti di riassetto",
            type: "number",
            min: 0,
            max: 90,
            unit: "min",
            defaultValue: 15,
            help: "Minuti minimi tra uscita di un cliente e arrivo del successivo."
          }
        ]
      },
      {
        key: "underfillProtection",
        title: "Protezione sotto-riempimento",
        description: "Nelle ore forti evita di dare tavoli grandi a gruppi piccoli.",
        plainCopy: "Esempio: il 6 posti non va a 2 persone alle 20:30 se puoi aspettare una richiesta migliore.",
        defaultEnabled: true,
        defaultApplyWhen: "PEAK_SERVICE",
        defaultPriority: 65,
        controls: [
          {
            key: "minOccupancyPercent",
            label: "Soglia sotto-riempimento",
            type: "number",
            min: 0,
            max: 100,
            unit: "%",
            defaultValue: 50,
            help: "Sotto questa occupazione la scelta viene penalizzata."
          }
        ]
      },
      {
        key: "primeTableHold",
        title: "Tieni libero il tavolo forte",
        description: "Prima di cedere un tavolo grande, aspetta un gruppo piu adatto.",
        plainCopy: "Esempio: se hai un 6 posti libero a cena, non lo bruci subito per una coppia.",
        defaultEnabled: false,
        defaultApplyWhen: "PEAK_SERVICE",
        defaultPriority: 58,
        controls: [
          {
            key: "minSeats",
            label: "Proteggi tavoli da",
            type: "number",
            min: 2,
            max: 20,
            unit: "posti",
            defaultValue: 6,
            help: "Da quanti posti in su il tavolo diventa prezioso."
          },
          {
            key: "holdMinutes",
            label: "Aspetta al massimo",
            type: "number",
            min: 0,
            max: 120,
            unit: "min",
            defaultValue: 25,
            help: "Dopo questi minuti il tavolo puo essere usato anche per gruppi piu piccoli."
          }
        ]
      },
      {
        key: "gapFillerReservations",
        title: "Riempitivo buchi",
        description: "Usa prenotazioni piccole e flessibili per tappare buchi in sala.",
        plainCopy: "Esempio: una coppia puo coprire un buco di 20 minuti senza rovinare il turno dopo.",
        defaultEnabled: true,
        defaultApplyWhen: "LOW_AVAILABILITY",
        defaultPriority: 46,
        controls: [
          {
            key: "maxShiftMinutes",
            label: "Spostamento massimo",
            type: "number",
            min: 0,
            max: 90,
            unit: "min",
            defaultValue: 20,
            help: "Quanto puoi muovere una prenotazione per chiudere un buco."
          },
          {
            key: "maxPartySize",
            label: "Gruppi piccoli fino a",
            type: "number",
            min: 1,
            max: 8,
            unit: "coperti",
            defaultValue: 2,
            help: "Oltre questa dimensione il gruppo non viene usato come riempitivo."
          }
        ]
      },
      {
        key: "largePartyGuarantee",
        title: "Gruppi grandi protetti",
        description: "Non spezzare o spostare troppo i gruppi grandi.",
        plainCopy: "Esempio: un tavolo da 8 va trattato con piu attenzione di una coppia flessibile.",
        defaultEnabled: true,
        defaultApplyWhen: "HIGH_DEMAND",
        defaultPriority: 62,
        controls: [
          {
            key: "minPartySize",
            label: "Gruppo grande da",
            type: "number",
            min: 3,
            max: 30,
            unit: "coperti",
            defaultValue: 6,
            help: "Da quanti coperti la prenotazione viene protetta."
          },
          {
            key: "maxShiftMinutes",
            label: "Spostamento massimo",
            type: "number",
            min: 0,
            max: 90,
            unit: "min",
            defaultValue: 10,
            help: "Quanto puoi cambiare orario a un gruppo grande."
          }
        ]
      }
    ]
  },
  {
    slug: "anti-no-show",
    title: "Anti No-Show",
    eyebrow: "Protezione",
    description: "Riduce tavoli vuoti e conferme dimenticate.",
    promise: "Fa chiamare o sollecitare solo le prenotazioni che meritano attenzione, senza stressare tutti.",
    rules: [
      {
        key: "riskReminder",
        title: "Reminder rischio",
        description: "Ricorda la prenotazione ai clienti piu a rischio assenza.",
        plainCopy: "Esempio: chi ha gia saltato una cena riceve un promemoria prima degli altri.",
        defaultEnabled: true,
        defaultApplyWhen: "ALWAYS",
        defaultPriority: 70,
        controls: [
          {
            key: "leadHours",
            label: "Ore prima della prenotazione",
            type: "number",
            min: 1,
            max: 96,
            unit: "ore",
            defaultValue: 24,
            help: "Quanto tempo prima inviare o evidenziare il promemoria."
          }
        ]
      },
      {
        key: "adaptiveDeposit",
        title: "Deposito adattivo",
        description: "Chiede deposito solo dove ha senso proteggersi.",
        plainCopy: "Esempio: sabato sera, gruppo grande o cliente poco affidabile: chiedi una caparra.",
        defaultEnabled: false,
        defaultApplyWhen: "HIGH_DEMAND",
        defaultPriority: 60,
        controls: [
          {
            key: "amount",
            label: "Deposito consigliato",
            type: "number",
            min: 0,
            max: 500,
            step: "0.01",
            unit: "EUR",
            defaultValue: 20,
            help: "Importo suggerito quando la regola scatta."
          }
        ]
      },
      {
        key: "manualConfirmRisk",
        title: "Conferma manuale rischio",
        description: "Segnala allo staff chi conviene richiamare.",
        plainCopy: "Esempio: se la sala e' piena, una chiamata evita un tavolo vuoto.",
        defaultEnabled: true,
        defaultApplyWhen: "PEAK_SERVICE",
        defaultPriority: 45,
        controls: [
          {
            key: "minRiskScore",
            label: "Soglia rischio",
            type: "number",
            min: 0,
            max: 100,
            unit: "punti",
            defaultValue: 60,
            help: "Da questo rischio in su la prenotazione viene messa in evidenza."
          }
        ]
      }
    ]
  },
  {
    slug: "sala-predittiva",
    title: "Sala predittiva",
    eyebrow: "Previsione",
    description: "Prevede durata tavoli, picchi cucina e margine di sicurezza.",
    promise: "Non guarda solo se un tavolo e' libero: prova a capire se la sala regge davvero quel turno.",
    rules: [
      {
        key: "predictiveDuration",
        title: "Durata predittiva",
        description: "Stima quanto durera davvero un tavolo.",
        plainCopy: "Esempio: un 6 persone di sabato sera resta piu di una coppia a pranzo.",
        defaultEnabled: true,
        defaultApplyWhen: "ALWAYS",
        defaultPriority: 65,
        controls: []
      },
      {
        key: "kitchenLoadCap",
        title: "Limite carico cucina",
        description: "Evita di far arrivare troppi coperti tutti insieme.",
        plainCopy: "Esempio: meglio distribuire 60 coperti in piu finestre che farli entrare tutti alle 20:30.",
        defaultEnabled: true,
        defaultApplyWhen: "ALWAYS",
        defaultPriority: 80,
        controls: [
          {
            key: "windowMinutes",
            label: "Finestra cucina",
            type: "number",
            min: 5,
            max: 120,
            unit: "min",
            defaultValue: 30,
            help: "Finestra in cui contare i coperti che arrivano."
          },
          {
            key: "maxCovers",
            label: "Coperti massimi",
            type: "number",
            min: 1,
            max: 300,
            unit: "coperti",
            defaultValue: 40,
            help: "Soglia oltre cui lo slot diventa troppo pesante per la cucina."
          }
        ]
      },
      {
        key: "controlledOverbooking",
        title: "Overbooking controllato",
        description: "Accetta extra coperti solo se il rischio e' controllato.",
        plainCopy: "Esempio: puoi tenere 2 coperti extra se il cliente e' affidabile e la cucina regge.",
        defaultEnabled: false,
        defaultApplyWhen: "HIGH_DEMAND",
        defaultPriority: 40,
        controls: [
          {
            key: "maxExtraCovers",
            label: "Extra coperti massimi",
            type: "number",
            min: 0,
            max: 50,
            unit: "coperti",
            defaultValue: 0,
            help: "Quanti coperti extra puoi accettare oltre la disponibilita normale."
          },
          {
            key: "minReliabilityScore",
            label: "Affidabilita minima",
            type: "number",
            min: 0,
            max: 100,
            unit: "punti",
            defaultValue: 70,
            help: "Affidabilita minima del cliente per concedere overbooking."
          }
        ]
      }
    ]
  },
  {
    slug: "owner-daily-brief",
    title: "Owner Daily Brief",
    eyebrow: "Direzione",
    description: "Riepilogo del giorno per proprietario e responsabile sala.",
    promise: "Ti dice cosa controllare prima del servizio: coperti, rischi, VIP, coda e colli di bottiglia.",
    rules: [
      {
        key: "ownerDailyBrief",
        title: "Brief mattutino",
        description: "Prepara il riepilogo operativo all'orario scelto.",
        plainCopy: "Esempio: alle 10 sai gia quanti coperti hai, dove rischi buchi e chi va seguito.",
        defaultEnabled: true,
        defaultApplyWhen: "ALWAYS",
        defaultPriority: 50,
        controls: [
          {
            key: "morningHour",
            label: "Ora brief",
            type: "number",
            min: 0,
            max: 23,
            unit: "h",
            defaultValue: 10,
            help: "Ora del giorno in cui preparare il riepilogo."
          }
        ]
      },
      {
        key: "waitlistTimer",
        title: "Timer proposta waitlist",
        description: "Quando offri un tavolo dalla coda, dai pochi minuti per rispondere.",
        plainCopy: "Esempio: il cliente ha 8 minuti; se non risponde, passi al prossimo.",
        defaultEnabled: true,
        defaultApplyWhen: "ALWAYS",
        defaultPriority: 55,
        controls: [
          {
            key: "ttlMinutes",
            label: "Durata proposta",
            type: "number",
            min: 1,
            max: 60,
            unit: "min",
            defaultValue: 8,
            help: "Tempo massimo prima di proporre il tavolo a qualcun altro."
          }
        ]
      },
      {
        key: "managerAlert",
        title: "Alert manager",
        description: "Evidenzia cosa il manager deve guardare prima del servizio.",
        plainCopy: "Esempio: cucina al limite, VIP in arrivo o prenotazioni da confermare.",
        defaultEnabled: true,
        defaultApplyWhen: "PEAK_SERVICE",
        defaultPriority: 45,
        controls: [
          {
            key: "minKitchenLoadPercent",
            label: "Soglia carico cucina",
            type: "number",
            min: 0,
            max: 200,
            unit: "%",
            defaultValue: 85,
            help: "Da questa soglia il carico cucina finisce negli alert."
          }
        ]
      }
    ]
  },
  {
    slug: "ricavi-margine",
    title: "Ricavi e margine",
    eyebrow: "Incasso",
    description: "Dai piu peso alle prenotazioni che rendono meglio nei turni pieni.",
    promise: "Aiuta a scegliere il tavolo non solo per numero di coperti, ma per valore reale del servizio.",
    rules: [
      {
        key: "seatHourFloor",
        title: "Minimo posto/ora",
        description: "Penalizza scelte che occupano molti posti per poco incasso atteso.",
        plainCopy: "Esempio: un tavolo da 6 con solo 2 persone e basso scontrino medio perde priorita.",
        defaultEnabled: false,
        defaultApplyWhen: "PEAK_SERVICE",
        defaultPriority: 52,
        controls: [
          {
            key: "minRevenuePerSeatHour",
            label: "Minimo per posto/ora",
            type: "number",
            min: 0,
            max: 300,
            step: "0.01",
            unit: "EUR",
            defaultValue: 18,
            help: "Sotto questo valore la prenotazione viene considerata poco redditizia."
          },
          {
            key: "penaltyWeight",
            label: "Penalita",
            type: "number",
            min: 0,
            max: 100,
            unit: "punti",
            defaultValue: 35,
            help: "Quanto deve pesare la penalita quando il valore e' basso."
          }
        ]
      },
      {
        key: "averageSpendBoost",
        title: "Bonus scontrino medio",
        description: "Premia clienti o prenotazioni con scontrino medio alto.",
        plainCopy: "Esempio: se due tavoli da 4 competono, chi spende meglio puo passare avanti.",
        defaultEnabled: true,
        defaultApplyWhen: "HIGH_DEMAND",
        defaultPriority: 55,
        controls: [
          {
            key: "minAverageSpend",
            label: "Scontrino medio da",
            type: "number",
            min: 0,
            max: 500,
            step: "0.01",
            unit: "EUR",
            defaultValue: 45,
            help: "Da questo scontrino medio il cliente riceve un bonus."
          },
          {
            key: "boostWeight",
            label: "Bonus valore",
            type: "number",
            min: 0,
            max: 100,
            unit: "punti",
            defaultValue: 30,
            help: "Quanto spinge lo scontrino medio nella decisione."
          }
        ]
      },
      {
        key: "lowMarginManualReview",
        title: "Controllo manuale basso margine",
        description: "Mette in revisione le prenotazioni grandi ma poco convenienti nei momenti pieni.",
        plainCopy: "Esempio: gruppo grande, menu economico, sabato sera: meglio farlo vedere al manager.",
        defaultEnabled: false,
        defaultApplyWhen: "PEAK_SERVICE",
        defaultPriority: 38,
        controls: [
          {
            key: "minPartySize",
            label: "Controlla gruppi da",
            type: "number",
            min: 2,
            max: 30,
            unit: "coperti",
            defaultValue: 6,
            help: "Da quanti coperti il controllo diventa utile."
          },
          {
            key: "maxSpendPerCover",
            label: "Sotto spesa per coperto",
            type: "number",
            min: 0,
            max: 300,
            step: "0.01",
            unit: "EUR",
            defaultValue: 28,
            help: "Sotto questa spesa stimata il gruppo viene segnalato."
          }
        ]
      },
      {
        key: "primeTimeDeposit",
        title: "Caparra prime time",
        description: "Suggerisce deposito per gruppi o orari che valgono tanto.",
        plainCopy: "Esempio: venerdi alle 21 per 8 persone: meglio bloccare con caparra.",
        defaultEnabled: false,
        defaultApplyWhen: "PEAK_SERVICE",
        defaultPriority: 50,
        controls: [
          {
            key: "amount",
            label: "Caparra suggerita",
            type: "number",
            min: 0,
            max: 1000,
            step: "0.01",
            unit: "EUR",
            defaultValue: 40,
            help: "Importo proposto quando la regola scatta."
          },
          {
            key: "minPartySize",
            label: "Da quanti coperti",
            type: "number",
            min: 1,
            max: 30,
            unit: "coperti",
            defaultValue: 5,
            help: "Sotto questa dimensione non viene proposta caparra."
          }
        ]
      }
    ]
  },
  {
    slug: "waitlist-smart",
    title: "Waitlist smart",
    eyebrow: "Coda",
    description: "Gestisce chi chiamare quando si libera un tavolo.",
    promise: "Trasforma la lista d'attesa in una coda utile: proposta rapida, clienti migliori, tempi chiari.",
    rules: [
      {
        key: "waitlistAutoOffer",
        title: "Proposta automatica",
        description: "Quando si libera un tavolo, propone il posto ai migliori candidati in coda.",
        plainCopy: "Esempio: si libera un 4 posti alle 20:30, il sistema avvisa subito i primi adatti.",
        defaultEnabled: true,
        defaultApplyWhen: "LOW_AVAILABILITY",
        defaultPriority: 60,
        controls: [
          {
            key: "candidateCount",
            label: "Candidati da avvisare",
            type: "number",
            min: 1,
            max: 10,
            unit: "clienti",
            defaultValue: 3,
            help: "Quante persone in coda valutare per ogni tavolo libero."
          },
          {
            key: "ttlMinutes",
            label: "Tempo risposta",
            type: "number",
            min: 1,
            max: 60,
            unit: "min",
            defaultValue: 8,
            help: "Scaduto il tempo, si passa al prossimo candidato."
          }
        ]
      },
      {
        key: "waitlistCustomerValue",
        title: "Valore cliente in coda",
        description: "In coda premia chi e' affidabile, ricorrente o con scontrino medio alto.",
        plainCopy: "Esempio: tra due richieste uguali, dai il posto a chi torna spesso e non buca.",
        defaultEnabled: true,
        defaultApplyWhen: "HIGH_DEMAND",
        defaultPriority: 54,
        controls: [
          {
            key: "minPriorityScore",
            label: "Priorita cliente da",
            type: "number",
            min: 0,
            max: 100,
            unit: "punti",
            defaultValue: 65,
            help: "Da questo punteggio il cliente in coda riceve priorita."
          },
          {
            key: "averageSpendWeight",
            label: "Peso scontrino medio",
            type: "number",
            min: 0,
            max: 100,
            unit: "punti",
            defaultValue: 35,
            help: "Quanto conta il valore cliente nella coda."
          }
        ]
      },
      {
        key: "waitlistFallbackWindow",
        title: "Finestra alternativa",
        description: "Se l'orario richiesto non c'e, propone un orario vicino.",
        plainCopy: "Esempio: niente 20:30, ma c'e 20:15: lo proponi prima di perdere il cliente.",
        defaultEnabled: true,
        defaultApplyWhen: "LOW_AVAILABILITY",
        defaultPriority: 42,
        controls: [
          {
            key: "flexMinutes",
            label: "Orario alternativo entro",
            type: "number",
            min: 0,
            max: 180,
            unit: "min",
            defaultValue: 30,
            help: "Quanto puo essere vicino l'orario alternativo."
          },
          {
            key: "fallbackAfterMinutes",
            label: "Proponi dopo",
            type: "number",
            min: 0,
            max: 240,
            unit: "min",
            defaultValue: 10,
            help: "Dopo quanti minuti senza posto preciso proporre un'alternativa."
          }
        ]
      },
      {
        key: "waitlistNoResponsePenalty",
        title: "Penalita mancata risposta",
        description: "Chi ignora piu proposte scende in priorita per qualche ora.",
        plainCopy: "Esempio: se non risponde due volte, non resta sempre primo in coda.",
        defaultEnabled: false,
        defaultApplyWhen: "ALWAYS",
        defaultPriority: 30,
        controls: [
          {
            key: "missedOffers",
            label: "Dopo proposte ignorate",
            type: "number",
            min: 1,
            max: 10,
            unit: "volte",
            defaultValue: 2,
            help: "Quante proposte senza risposta prima della penalita."
          },
          {
            key: "penaltyHours",
            label: "Durata penalita",
            type: "number",
            min: 1,
            max: 72,
            unit: "ore",
            defaultValue: 6,
            help: "Per quanto tempo il cliente scende in coda."
          }
        ]
      }
    ]
  },
  {
    slug: "turni-sala",
    title: "Turni sala",
    eyebrow: "Servizio",
    description: "Regole per non comprimere troppo ingresso, uscita e riassetto.",
    promise: "Tiene il ritmo del servizio piu realistico: meno arrivi tutti insieme e meno tavoli promessi troppo presto.",
    rules: [
      {
        key: "fastTurnProtection",
        title: "Turno troppo stretto",
        description: "Evita di rivendere un tavolo con troppo poco margine.",
        plainCopy: "Esempio: se il primo turno e' in ritardo, non prometti il tavolo dopo cinque minuti.",
        defaultEnabled: true,
        defaultApplyWhen: "ALWAYS",
        defaultPriority: 56,
        controls: [
          {
            key: "minGapMinutes",
            label: "Margine minimo",
            type: "number",
            min: 0,
            max: 120,
            unit: "min",
            defaultValue: 15,
            help: "Tempo minimo tra un cliente e il successivo."
          },
          {
            key: "maxReusesPerService",
            label: "Riusi massimi tavolo",
            type: "number",
            min: 1,
            max: 6,
            unit: "turni",
            defaultValue: 2,
            help: "Quante volte puoi usare lo stesso tavolo nello stesso servizio."
          }
        ]
      },
      {
        key: "lateArrivalGrace",
        title: "Ritardo cliente",
        description: "Decide quanto aspettare prima di liberare il tavolo.",
        plainCopy: "Esempio: dopo 15 minuti di ritardo il tavolo puo tornare disponibile.",
        defaultEnabled: true,
        defaultApplyWhen: "PEAK_SERVICE",
        defaultPriority: 48,
        controls: [
          {
            key: "graceMinutes",
            label: "Tolleranza ritardo",
            type: "number",
            min: 0,
            max: 60,
            unit: "min",
            defaultValue: 15,
            help: "Quanto aspettare il cliente in ritardo."
          },
          {
            key: "releaseAfterMinutes",
            label: "Libera dopo",
            type: "number",
            min: 0,
            max: 90,
            unit: "min",
            defaultValue: 20,
            help: "Quando il tavolo puo tornare assegnabile."
          }
        ]
      },
      {
        key: "staggeredArrival",
        title: "Arrivi scaglionati",
        description: "Distribuisce gli arrivi per non intasare ingresso, sala e cucina.",
        plainCopy: "Esempio: non fai entrare 40 coperti tutti nello stesso quarto d'ora.",
        defaultEnabled: true,
        defaultApplyWhen: "PEAK_SERVICE",
        defaultPriority: 64,
        controls: [
          {
            key: "windowMinutes",
            label: "Finestra arrivi",
            type: "number",
            min: 5,
            max: 120,
            unit: "min",
            defaultValue: 15,
            help: "Intervallo in cui contare i coperti in ingresso."
          },
          {
            key: "maxCoversPerWindow",
            label: "Coperti per finestra",
            type: "number",
            min: 1,
            max: 300,
            unit: "coperti",
            defaultValue: 24,
            help: "Oltre questa soglia gli arrivi vengono rallentati."
          }
        ]
      },
      {
        key: "largePartySetupTime",
        title: "Setup gruppi grandi",
        description: "Aggiunge tempo di preparazione quando il gruppo e' grande.",
        plainCopy: "Esempio: per 10 persone serve tempo per unire tavoli, acqua, segnaposto o menu.",
        defaultEnabled: true,
        defaultApplyWhen: "HIGH_DEMAND",
        defaultPriority: 44,
        controls: [
          {
            key: "minPartySize",
            label: "Gruppo da",
            type: "number",
            min: 3,
            max: 40,
            unit: "coperti",
            defaultValue: 8,
            help: "Da quanti coperti aggiungere setup extra."
          },
          {
            key: "setupMinutes",
            label: "Setup extra",
            type: "number",
            min: 0,
            max: 90,
            unit: "min",
            defaultValue: 10,
            help: "Minuti extra da lasciare prima del gruppo."
          }
        ]
      }
    ]
  }
];

const RULE_DEFINITIONS = YIELD_FEATURE_DEFINITIONS.flatMap((feature) =>
  feature.rules.map((rule) => ({
    ...rule,
    featureSlug: feature.slug
  }))
);

const RULE_DEFINITION_BY_KEY = new Map(RULE_DEFINITIONS.map((rule) => [rule.key, rule]));

export function getYieldFeatureDefinition(slug) {
  return YIELD_FEATURE_DEFINITIONS.find((feature) => feature.slug === slug) || null;
}

export function getYieldRuleDefinition(ruleKey) {
  return RULE_DEFINITION_BY_KEY.get(ruleKey) || null;
}

export function getYieldRuleControlValue(rule, controlKey) {
  const definition = getYieldRuleDefinition(rule?.key);
  const control = definition?.controls.find((item) => item.key === controlKey);
  return rule?.params?.[controlKey] ?? control?.defaultValue ?? "";
}

function cleanApplyWhen(value, fallback) {
  const normalized = String(value || fallback || "ALWAYS").trim().toUpperCase();
  return YIELD_RULE_APPLY_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : fallback || "ALWAYS";
}

function cleanNumber(value, fallback, min = 0, max = 1000) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function normalizeRule(definition, storedRule = {}) {
  const params = {};

  for (const control of definition.controls) {
    params[control.key] = cleanNumber(
      storedRule?.params?.[control.key],
      control.defaultValue,
      control.min ?? 0,
      control.max ?? 1000
    );
  }

  return {
    key: definition.key,
    enabled:
      typeof storedRule?.enabled === "boolean"
        ? storedRule.enabled
        : definition.defaultEnabled,
    applyWhen: cleanApplyWhen(storedRule?.applyWhen, definition.defaultApplyWhen),
    priority: cleanNumber(storedRule?.priority, definition.defaultPriority, 0, 100),
    params
  };
}

export function normalizeYieldRuleSettings(settings = {}) {
  const storedRules = settings?.rules || {};
  const rules = {};

  for (const definition of RULE_DEFINITIONS) {
    rules[definition.key] = normalizeRule(definition, storedRules[definition.key]);
  }

  return {
    version: 1,
    rules
  };
}

export function getYieldRule(settings, ruleKey) {
  return normalizeYieldRuleSettings(settings).rules[ruleKey] || null;
}

export function isYieldRuleEnabled(settings, ruleKey) {
  const rule = getYieldRule(settings, ruleKey);
  return Boolean(rule?.enabled);
}

export function shouldApplyYieldRule(settings, ruleKey, context = {}) {
  const rule = getYieldRule(settings, ruleKey);

  if (!rule?.enabled) {
    return false;
  }

  if (rule.applyWhen === "MANUAL_ONLY") {
    return Boolean(context.manual);
  }

  const date = new Date(context.dateTime || Date.now());
  const hour = date.getHours();
  const weekday = date.getDay();
  const peakService = (hour >= 19 && hour <= 22) || weekday === 5 || weekday === 6;

  if (rule.applyWhen === "PEAK_SERVICE") {
    return peakService;
  }

  if (rule.applyWhen === "HIGH_DEMAND") {
    return Number(context.reservationCount || context.candidateCount || 0) > 1 || peakService;
  }

  if (rule.applyWhen === "LOW_AVAILABILITY") {
    const availableTables = Number(context.availableTableCount ?? 0);
    const reservations = Number(context.reservationCount ?? 0);
    return availableTables <= reservations || peakService;
  }

  if (rule.applyWhen === "NO_SINGLE_TABLE") {
    return context.singleTableAvailable === false || Boolean(context.needsCombination);
  }

  return true;
}

function enabledPriority(settings, ruleKey, fallback = 0) {
  const rule = getYieldRule(settings, ruleKey);
  return rule?.enabled && rule.applyWhen !== "MANUAL_ONLY" ? Number(rule.priority || fallback) : 0;
}

function ruleParam(settings, ruleKey, paramKey) {
  const rule = getYieldRule(settings, ruleKey);
  return getYieldRuleControlValue(rule, paramKey);
}

export function deriveTechnicalSettingsFromYieldRules(settings = {}, technical = {}) {
  const normalized = normalizeYieldRuleSettings(settings);
  const exactFitPriority = enabledPriority(normalized, "exactTableFit");
  const underfillPriority = enabledPriority(normalized, "underfillProtection");
  const maximizeCoversPriority = enabledPriority(normalized, "maximizeCovers");
  const bestCustomerPriority = enabledPriority(normalized, "bestCustomerPriority");
  const firstRequestPriority = enabledPriority(normalized, "firstRequestTieBreak");
  const flexibleSlotEnabled = isYieldRuleEnabled(normalized, "flexibleSlotRecovery");
  const gapFillerEnabled = isYieldRuleEnabled(normalized, "gapFillerReservations");
  const combineTablesEnabled = isYieldRuleEnabled(normalized, "combineTablesForLargeParties");
  const turnoverBufferEnabled = isYieldRuleEnabled(normalized, "turnoverBuffer");
  const primeTableHoldPriority = enabledPriority(normalized, "primeTableHold");
  const largePartyGuaranteePriority = enabledPriority(normalized, "largePartyGuarantee");
  const predictiveDurationEnabled = isYieldRuleEnabled(normalized, "predictiveDuration");
  const kitchenLoadGuardEnabled = isYieldRuleEnabled(normalized, "kitchenLoadCap");
  const controlledOverbookingEnabled = isYieldRuleEnabled(normalized, "controlledOverbooking");
  const ownerBriefEnabled = isYieldRuleEnabled(normalized, "ownerDailyBrief");
  const waitlistTimerEnabled = isYieldRuleEnabled(normalized, "waitlistTimer");
  const waitlistAutoOfferEnabled = isYieldRuleEnabled(normalized, "waitlistAutoOffer");
  const waitlistFallbackEnabled = isYieldRuleEnabled(normalized, "waitlistFallbackWindow");
  const riskReminderEnabled = isYieldRuleEnabled(normalized, "riskReminder");
  const adaptiveDepositEnabled = isYieldRuleEnabled(normalized, "adaptiveDeposit");
  const seatHourFloorPriority = enabledPriority(normalized, "seatHourFloor");
  const averageSpendBoostPriority = enabledPriority(normalized, "averageSpendBoost");
  const primeTimeDepositEnabled = isYieldRuleEnabled(normalized, "primeTimeDeposit");
  const fastTurnProtectionEnabled = isYieldRuleEnabled(normalized, "fastTurnProtection");
  const staggeredArrivalEnabled = isYieldRuleEnabled(normalized, "staggeredArrival");
  const largePartySetupEnabled = isYieldRuleEnabled(normalized, "largePartySetupTime");
  const averageSpendWeight = bestCustomerPriority
    ? ruleParam(normalized, "bestCustomerPriority", "averageSpendWeight")
    : 0;
  const boostedAverageSpendWeight =
    Number(averageSpendWeight) +
    (averageSpendBoostPriority
      ? Number(ruleParam(normalized, "averageSpendBoost", "boostWeight"))
      : 0) +
    seatHourFloorPriority / 2;
  const flexibleSlotMinutes = flexibleSlotEnabled
    ? Number(ruleParam(normalized, "flexibleSlotRecovery", "flexMinutes"))
    : 0;
  const gapFillerMinutes = gapFillerEnabled
    ? Number(ruleParam(normalized, "gapFillerReservations", "maxShiftMinutes"))
    : 0;
  const waitlistFallbackMinutes = waitlistFallbackEnabled
    ? Number(ruleParam(normalized, "waitlistFallbackWindow", "flexMinutes"))
    : 0;
  const flexMinutes = Math.max(flexibleSlotMinutes, gapFillerMinutes, waitlistFallbackMinutes);
  const turnoverBufferMinutes = Math.max(
    turnoverBufferEnabled ? Number(ruleParam(normalized, "turnoverBuffer", "bufferMinutes")) : 0,
    fastTurnProtectionEnabled ? Number(ruleParam(normalized, "fastTurnProtection", "minGapMinutes")) : 0,
    largePartySetupEnabled ? Number(ruleParam(normalized, "largePartySetupTime", "setupMinutes")) : 0
  );
  const kitchenWindowMinutes = staggeredArrivalEnabled
    ? Number(ruleParam(normalized, "staggeredArrival", "windowMinutes"))
    : Number(ruleParam(normalized, "kitchenLoadCap", "windowMinutes"));
  const kitchenMaxCovers = staggeredArrivalEnabled
    ? Number(ruleParam(normalized, "staggeredArrival", "maxCoversPerWindow"))
    : Number(ruleParam(normalized, "kitchenLoadCap", "maxCovers"));
  const adaptiveDepositAmount = Math.max(
    adaptiveDepositEnabled ? Number(ruleParam(normalized, "adaptiveDeposit", "amount")) : 0,
    primeTimeDepositEnabled ? Number(ruleParam(normalized, "primeTimeDeposit", "amount")) : 0
  );
  const waitlistOfferTtlMinutes = waitlistAutoOfferEnabled
    ? Math.round(ruleParam(normalized, "waitlistAutoOffer", "ttlMinutes"))
    : waitlistTimerEnabled
      ? Math.round(ruleParam(normalized, "waitlistTimer", "ttlMinutes"))
      : technical.waitlistOfferTtlMinutes || 8;
  const revenuePriority =
    maximizeCoversPriority + seatHourFloorPriority + averageSpendBoostPriority;

  return {
    tableAssignmentSlotMode: flexMinutes > 0 ? "FLEXIBLE" : "PRECISE",
    tableAssignmentFlexMinutes: Math.round(flexMinutes),
    tableAssignmentTurnoverBufferMinutes: Math.round(turnoverBufferMinutes),
    tableAssignmentCombineTablesEnabled: combineTablesEnabled,
    tableAssignmentMaxTables: Math.round(
      ruleParam(normalized, "combineTablesForLargeParties", "maxTables")
    ),
    tableAssignmentMinOccupancyPercent: Math.round(
      Math.max(
        ruleParam(normalized, "exactTableFit", "minOccupancyPercent"),
        ruleParam(normalized, "underfillProtection", "minOccupancyPercent")
      )
    ),
    tableAssignmentWeightTableFit: Math.round(exactFitPriority + underfillPriority / 2),
    tableAssignmentWeightPartySize: Math.round(
      maximizeCoversPriority + primeTableHoldPriority / 3 + largePartyGuaranteePriority / 3
    ),
    tableAssignmentWeightCustomerPriority: Math.round(bestCustomerPriority),
    tableAssignmentWeightAverageSpend: Math.round(boostedAverageSpendWeight),
    tableAssignmentWeightCreatedAt: Math.round(firstRequestPriority),
    tableAssignmentStrategy:
      bestCustomerPriority >= revenuePriority && bestCustomerPriority >= exactFitPriority
        ? "VIP"
        : revenuePriority >= exactFitPriority
          ? "REVENUE"
          : "FIT",
    predictiveDurationEnabled,
    kitchenLoadGuardEnabled: kitchenLoadGuardEnabled || staggeredArrivalEnabled,
    kitchenLoadWindowMinutes: Math.round(kitchenWindowMinutes),
    kitchenLoadMaxCovers: Math.round(kitchenMaxCovers),
    controlledOverbookingEnabled,
    controlledOverbookingMaxCovers: Math.round(
      ruleParam(normalized, "controlledOverbooking", "maxExtraCovers")
    ),
    controlledOverbookingMinReliabilityScore: Math.round(
      ruleParam(normalized, "controlledOverbooking", "minReliabilityScore")
    ),
    waitlistOfferTtlMinutes,
    ownerBriefEnabled,
    ownerBriefMorningHour: Math.round(ruleParam(normalized, "ownerDailyBrief", "morningHour")),
    crmNoShowReminderEnabled: riskReminderEnabled,
    crmReminderLeadHours: riskReminderEnabled
      ? Math.round(ruleParam(normalized, "riskReminder", "leadHours"))
      : technical.crmReminderLeadHours || 24,
    adaptiveDepositEnabled: adaptiveDepositEnabled || primeTimeDepositEnabled,
    adaptiveDepositAmount: adaptiveDepositAmount > 0
      ? adaptiveDepositAmount
      : technical.adaptiveDepositAmount || null
  };
}

export function getYieldRuleStatusLabel(rule) {
  if (!rule?.enabled) {
    return "Disattiva";
  }

  return YIELD_RULE_APPLY_OPTIONS.find((option) => option.value === rule.applyWhen)?.label || "Attiva";
}
