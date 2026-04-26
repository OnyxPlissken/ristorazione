export const YIELD_RULE_APPLY_OPTIONS = [
  {
    value: "ALWAYS",
    label: "Sempre",
    description: "La regola entra in ogni decisione automatica."
  },
  {
    value: "PEAK_SERVICE",
    label: "Ore di punta",
    description: "Si applica nelle fasce piu' delicate, cena e weekend."
  },
  {
    value: "HIGH_DEMAND",
    label: "Alta domanda",
    description: "Si applica quando piu' richieste competono per gli stessi tavoli."
  },
  {
    value: "LOW_AVAILABILITY",
    label: "Pochi tavoli liberi",
    description: "Si applica quando la sala sta diventando stretta."
  },
  {
    value: "NO_SINGLE_TABLE",
    label: "Nessun tavolo singolo",
    description: "Si applica solo se serve combinare tavoli o recuperare capienza."
  },
  {
    value: "TIE_ONLY",
    label: "Solo spareggio",
    description: "Si applica quando due opzioni hanno punteggi simili."
  },
  {
    value: "MANUAL_ONLY",
    label: "Solo manuale",
    description: "Resta configurata, ma non pesa nelle automazioni."
  }
];

export const YIELD_FEATURE_DEFINITIONS = [
  {
    slug: "motore-tavoli",
    title: "Motore tavoli",
    eyebrow: "Assegnazione",
    description: "Decide quale prenotazione servire e quale tavolo usare quando la sala cambia.",
    promise: "Massimizza coperti, valore cliente e aderenza tavolo senza togliere controllo al ristoratore.",
    rules: [
      {
        key: "exactTableFit",
        title: "Aderenza tavolo",
        description: "Preferisce il tavolo piu' vicino ai coperti richiesti, evitando spreco di posti.",
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
            defaultValue: 60
          }
        ]
      },
      {
        key: "maximizeCovers",
        title: "Coperti prima",
        description: "Se un tavolo da 4 puo' servire 2 o 4 persone, spinge la prenotazione da 4.",
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
            defaultValue: 1
          }
        ]
      },
      {
        key: "bestCustomerPriority",
        title: "Cliente migliore",
        description: "A parita' di tavolo, privilegia priorita cliente, VIP e carrello medio.",
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
            defaultValue: 70
          },
          {
            key: "averageSpendWeight",
            label: "Peso carrello medio",
            type: "number",
            min: 0,
            max: 100,
            unit: "punti",
            defaultValue: 55
          }
        ]
      },
      {
        key: "firstRequestTieBreak",
        title: "Prima richiesta",
        description: "Usa l'ordine di prenotazione come spareggio quando il valore operativo e' simile.",
        defaultEnabled: true,
        defaultApplyWhen: "TIE_ONLY",
        defaultPriority: 40,
        controls: []
      },
      {
        key: "flexibleSlotRecovery",
        title: "Slot flessibile",
        description: "Permette di guardare pochi minuti prima o dopo per recuperare tavoli utili.",
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
            defaultValue: 30
          }
        ]
      },
      {
        key: "combineTablesForLargeParties",
        title: "Combinazione tavoli",
        description: "Consente combinazioni solo quando aiutano gruppi grandi o non c'e' un tavolo singolo.",
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
            defaultValue: 4
          }
        ]
      },
      {
        key: "turnoverBuffer",
        title: "Buffer riassetto",
        description: "Blocca minuti extra tra due turni per evitare incastri irrealistici.",
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
            defaultValue: 15
          }
        ]
      },
      {
        key: "underfillProtection",
        title: "Protezione sotto-riempimento",
        description: "Nelle ore forti evita di assegnare tavoli grandi a gruppi troppo piccoli.",
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
            defaultValue: 50
          }
        ]
      }
    ]
  },
  {
    slug: "anti-no-show",
    title: "Anti No-Show",
    eyebrow: "Protezione",
    description: "Regole per ridurre buchi in sala e chiedere conferme piu' intelligenti.",
    promise: "Aiuta lo staff a presidiare clienti a rischio senza trattare tutti nello stesso modo.",
    rules: [
      {
        key: "riskReminder",
        title: "Reminder rischio",
        description: "Invia un reminder piu' deciso ai clienti con storico fragile o bassa affidabilita.",
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
            defaultValue: 24
          }
        ]
      },
      {
        key: "adaptiveDeposit",
        title: "Deposito adattivo",
        description: "Suggerisce deposito solo per prenotazioni o clienti che meritano protezione.",
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
            defaultValue: 20
          }
        ]
      },
      {
        key: "manualConfirmRisk",
        title: "Conferma manuale rischio",
        description: "Mette in evidenza le prenotazioni che lo staff dovrebbe confermare a voce.",
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
            defaultValue: 60
          }
        ]
      }
    ]
  },
  {
    slug: "sala-predittiva",
    title: "Sala predittiva",
    eyebrow: "Previsione",
    description: "Regole per durata tavolo, carico cucina e overbooking controllato.",
    promise: "Trasforma la disponibilita in una previsione piu' realistica, non in un semplice calendario.",
    rules: [
      {
        key: "predictiveDuration",
        title: "Durata predittiva",
        description: "Stima durata diversa per coperti, orario, weekend, VIP e carrello medio.",
        defaultEnabled: true,
        defaultApplyWhen: "ALWAYS",
        defaultPriority: 65,
        controls: []
      },
      {
        key: "kitchenLoadCap",
        title: "Limite carico cucina",
        description: "Chiude o penalizza slot quando troppi coperti arrivano nella stessa finestra.",
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
            defaultValue: 30
          },
          {
            key: "maxCovers",
            label: "Coperti massimi",
            type: "number",
            min: 1,
            max: 300,
            unit: "coperti",
            defaultValue: 40
          }
        ]
      },
      {
        key: "controlledOverbooking",
        title: "Overbooking controllato",
        description: "Permette richieste in attesa solo entro soglia cliente e carico cucina sostenibile.",
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
            defaultValue: 0
          },
          {
            key: "minReliabilityScore",
            label: "Affidabilita minima",
            type: "number",
            min: 0,
            max: 100,
            unit: "punti",
            defaultValue: 70
          }
        ]
      }
    ]
  },
  {
    slug: "owner-daily-brief",
    title: "Owner Daily Brief",
    eyebrow: "Direzione",
    description: "Regole per creare un riepilogo giornaliero utile al proprietario.",
    promise: "Porta in un colpo d'occhio coperti, rischi, VIP, coda e colli di bottiglia della giornata.",
    rules: [
      {
        key: "ownerDailyBrief",
        title: "Brief mattutino",
        description: "Prepara il riepilogo operativo della giornata all'orario scelto.",
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
            defaultValue: 10
          }
        ]
      },
      {
        key: "waitlistTimer",
        title: "Timer proposta waitlist",
        description: "Dopo un tavolo liberato, mantiene valida la proposta solo per pochi minuti.",
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
            defaultValue: 8
          }
        ]
      },
      {
        key: "managerAlert",
        title: "Alert manager",
        description: "Evidenzia nel brief picchi cucina, VIP e prenotazioni da presidiare.",
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
            defaultValue: 85
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
  const combineTablesEnabled = isYieldRuleEnabled(normalized, "combineTablesForLargeParties");
  const turnoverBufferEnabled = isYieldRuleEnabled(normalized, "turnoverBuffer");
  const predictiveDurationEnabled = isYieldRuleEnabled(normalized, "predictiveDuration");
  const kitchenLoadGuardEnabled = isYieldRuleEnabled(normalized, "kitchenLoadCap");
  const controlledOverbookingEnabled = isYieldRuleEnabled(normalized, "controlledOverbooking");
  const ownerBriefEnabled = isYieldRuleEnabled(normalized, "ownerDailyBrief");
  const waitlistTimerEnabled = isYieldRuleEnabled(normalized, "waitlistTimer");
  const riskReminderEnabled = isYieldRuleEnabled(normalized, "riskReminder");
  const adaptiveDepositEnabled = isYieldRuleEnabled(normalized, "adaptiveDeposit");
  const averageSpendWeight = bestCustomerPriority
    ? ruleParam(normalized, "bestCustomerPriority", "averageSpendWeight")
    : 0;

  return {
    tableAssignmentSlotMode: flexibleSlotEnabled ? "FLEXIBLE" : "PRECISE",
    tableAssignmentFlexMinutes: flexibleSlotEnabled
      ? Math.round(ruleParam(normalized, "flexibleSlotRecovery", "flexMinutes"))
      : 0,
    tableAssignmentTurnoverBufferMinutes: turnoverBufferEnabled
      ? Math.round(ruleParam(normalized, "turnoverBuffer", "bufferMinutes"))
      : 0,
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
    tableAssignmentWeightPartySize: Math.round(maximizeCoversPriority),
    tableAssignmentWeightCustomerPriority: Math.round(bestCustomerPriority),
    tableAssignmentWeightAverageSpend: Math.round(averageSpendWeight),
    tableAssignmentWeightCreatedAt: Math.round(firstRequestPriority),
    tableAssignmentStrategy:
      bestCustomerPriority >= maximizeCoversPriority && bestCustomerPriority >= exactFitPriority
        ? "VIP"
        : maximizeCoversPriority >= exactFitPriority
          ? "REVENUE"
          : "FIT",
    predictiveDurationEnabled,
    kitchenLoadGuardEnabled,
    kitchenLoadWindowMinutes: Math.round(ruleParam(normalized, "kitchenLoadCap", "windowMinutes")),
    kitchenLoadMaxCovers: Math.round(ruleParam(normalized, "kitchenLoadCap", "maxCovers")),
    controlledOverbookingEnabled,
    controlledOverbookingMaxCovers: Math.round(
      ruleParam(normalized, "controlledOverbooking", "maxExtraCovers")
    ),
    controlledOverbookingMinReliabilityScore: Math.round(
      ruleParam(normalized, "controlledOverbooking", "minReliabilityScore")
    ),
    waitlistOfferTtlMinutes: waitlistTimerEnabled
      ? Math.round(ruleParam(normalized, "waitlistTimer", "ttlMinutes"))
      : technical.waitlistOfferTtlMinutes || 8,
    ownerBriefEnabled,
    ownerBriefMorningHour: Math.round(ruleParam(normalized, "ownerDailyBrief", "morningHour")),
    crmNoShowReminderEnabled: riskReminderEnabled,
    crmReminderLeadHours: riskReminderEnabled
      ? Math.round(ruleParam(normalized, "riskReminder", "leadHours"))
      : technical.crmReminderLeadHours || 24,
    adaptiveDepositEnabled,
    adaptiveDepositAmount: adaptiveDepositEnabled
      ? ruleParam(normalized, "adaptiveDeposit", "amount")
      : technical.adaptiveDepositAmount || null
  };
}

export function getYieldRuleStatusLabel(rule) {
  if (!rule?.enabled) {
    return "Disattiva";
  }

  return YIELD_RULE_APPLY_OPTIONS.find((option) => option.value === rule.applyWhen)?.label || "Attiva";
}
