export const LOCATION_MODULE_DEFINITIONS = [
  {
    key: "reservations",
    field: "reservationEnabled",
    title: "Prenotazioni online",
    description: "Pagina prenota, booking diretto e flusso amministrativo.",
    cluster: "Booking"
  },
  {
    key: "slotOptimization",
    field: "slotOptimizationEnabled",
    title: "Ottimizzazione slot",
    description: "Suggerimenti orari e pressione operativa per saturare meglio i tavoli.",
    cluster: "Booking"
  },
  {
    key: "yieldEngine",
    field: "yieldEngineEnabled",
    title: "Motore resa sala",
    description: "Regole tavoli, resa per posto/ora, carico cucina e overbooking controllato.",
    cluster: "Booking"
  },
  {
    key: "smartWaitlist",
    field: "smartWaitlistEnabled",
    title: "Waitlist intelligente",
    description: "Ordina la coda per priorita e riempie piu velocemente i buchi.",
    cluster: "Booking"
  },
  {
    key: "customerScoring",
    field: "customerScoringEnabled",
    title: "CRM scoring",
    description: "Segmentazione parlante cliente, priorita e affidabilita.",
    cluster: "CRM"
  },
  {
    key: "adaptiveDeposit",
    field: "adaptiveDepositEnabled",
    title: "Deposito adattivo",
    description: "Richiede o consiglia garanzie sui profili piu rischiosi.",
    cluster: "CRM"
  },
  {
    key: "qr",
    field: "qrEnabled",
    title: "QR tavolo",
    description: "Menu, carrello e conto dal tavolo via smartphone.",
    cluster: "Sala"
  },
  {
    key: "customerTableSelection",
    field: "customerTableSelectionEnabled",
    title: "Scelta tavolo cliente",
    description: "Consente al cliente di scegliere il tavolo dalla planimetria.",
    cluster: "Sala"
  },
  {
    key: "payments",
    field: "paymentsEnabled",
    title: "Pagamenti tavolo",
    description: "Richiesta conto, checkout esterno e pagamento diretto.",
    cluster: "Sala"
  },
  {
    key: "delivery",
    field: "deliveryEnabled",
    title: "Delivery",
    description: "Canali delivery, API partner e ordini centralizzati.",
    cluster: "Canali"
  },
  {
    key: "googleBusiness",
    field: "googleBusinessEnabled",
    title: "Google Business",
    description: "Dati tecnici e sincronizzazione con la scheda pubblica.",
    cluster: "Canali"
  },
  {
    key: "sms",
    field: "smsEnabled",
    title: "SMS automatici",
    description: "Invio messaggi 1s2u per stati prenotazione, link e waitlist.",
    cluster: "Canali"
  }
];

export function isLocationModuleEnabled(moduleKey, technicalSettings = {}, location = {}) {
  if (moduleKey === "reservations") {
    return technicalSettings.reservationsEnabled ?? location.reservationEnabled;
  }

  if (moduleKey === "slotOptimization") {
    return technicalSettings.slotOptimizationEnabled !== false;
  }

  if (moduleKey === "smartWaitlist") {
    return technicalSettings.smartWaitlistEnabled !== false;
  }

  if (moduleKey === "customerScoring") {
    return technicalSettings.customerScoringEnabled !== false;
  }

  const definition = LOCATION_MODULE_DEFINITIONS.find((item) => item.key === moduleKey);

  if (!definition) {
    return false;
  }

  return Boolean(technicalSettings[definition.field]);
}

export function getEnabledLocationModules(location) {
  const technicalSettings = location?.technicalSettings || {};

  return LOCATION_MODULE_DEFINITIONS.filter((definition) =>
    isLocationModuleEnabled(definition.key, technicalSettings, location)
  );
}

export function summarizeLocationModules(locations) {
  const activeByKey = LOCATION_MODULE_DEFINITIONS.reduce(
    (summary, definition) => ({
      ...summary,
      [definition.key]: locations.some((location) =>
        isLocationModuleEnabled(definition.key, location.technicalSettings || {}, location)
      )
    }),
    {}
  );

  return {
    activeByKey,
    locations,
    has(moduleKey) {
      return Boolean(activeByKey[moduleKey]);
    },
    any(moduleKeys = []) {
      return moduleKeys.some((moduleKey) => Boolean(activeByKey[moduleKey]));
    }
  };
}
