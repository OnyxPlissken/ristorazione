import {
  deriveTechnicalSettingsFromYieldRules,
  shouldApplyYieldRule
} from "./yield-rules";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function numberValue(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAssignedTableIds(reservation) {
  return [...new Set([reservation.tableId, ...(reservation.tableIds || [])].filter(Boolean))];
}

export function predictReservationDurationMinutes(
  reservation,
  locationSettings = {},
  technicalSettings = {}
) {
  const baseDuration = Number(locationSettings?.durationMinutes || 120);
  const effectiveSettings = technicalSettings.yieldRuleSettings
    ? {
        ...technicalSettings,
        ...deriveTechnicalSettingsFromYieldRules(
          technicalSettings.yieldRuleSettings,
          technicalSettings
        )
      }
    : technicalSettings;

  if (
    !effectiveSettings?.yieldEngineEnabled ||
    effectiveSettings?.predictiveDurationEnabled === false ||
    (effectiveSettings.yieldRuleSettings &&
      !shouldApplyYieldRule(effectiveSettings.yieldRuleSettings, "predictiveDuration", {
        dateTime: reservation?.dateTime
      }))
  ) {
    return baseDuration;
  }

  const date = new Date(reservation?.dateTime || Date.now());
  const guests = Number(reservation?.guests || 0);
  const hour = date.getHours();
  const weekday = date.getDay();
  const profile = reservation?.customerProfile || {};
  const averageSpend = numberValue(profile.averageSpend ?? reservation?.spendAmount);
  const customerPriority = numberValue(profile.priorityScore ?? reservation?.customerPriorityScore);
  let predicted = baseDuration;

  predicted += Math.max(guests - 2, 0) * 8;

  if (weekday === 5 || weekday === 6) {
    predicted += 10;
  }

  if (hour >= 20 && hour <= 22) {
    predicted += 12;
  }

  if (averageSpend >= 120) {
    predicted += 15;
  } else if (averageSpend >= 80) {
    predicted += 8;
  }

  if (profile.vip || customerPriority >= 85) {
    predicted += 10;
  }

  return clamp(Math.round(predicted), 45, 240);
}

export function getReservationSeatCount(reservation, tableLookup = new Map()) {
  const tableSeatCount = getAssignedTableIds(reservation).reduce(
    (sum, tableId) => sum + Number(tableLookup.get(tableId)?.seats || 0),
    0
  );

  return Math.max(tableSeatCount, Number(reservation?.guests || 0), 1);
}

export function getRevenuePerSeatHour({
  reservation,
  tableLookup = new Map(),
  locationSettings = {},
  technicalSettings = {}
}) {
  const revenue = numberValue(reservation?.spendAmount);

  if (revenue <= 0) {
    return 0;
  }

  const seatCount = getReservationSeatCount(reservation, tableLookup);
  const durationHours =
    predictReservationDurationMinutes(reservation, locationSettings, technicalSettings) / 60;

  if (seatCount <= 0 || durationHours <= 0) {
    return 0;
  }

  return revenue / seatCount / durationHours;
}

export function getKitchenLoadBucket(dateTime, windowMinutes = 30) {
  const date = new Date(dateTime);
  const bucketSize = Math.max(Number(windowMinutes || 30), 5) * 60 * 1000;
  return new Date(Math.floor(date.getTime() / bucketSize) * bucketSize);
}

export function formatKitchenLoadBucketLabel(dateTime) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateTime));
}

export function buildKitchenLoadBuckets(reservations = [], technicalSettings = {}) {
  const effectiveSettings = technicalSettings.yieldRuleSettings
    ? {
        ...technicalSettings,
        ...deriveTechnicalSettingsFromYieldRules(
          technicalSettings.yieldRuleSettings,
          technicalSettings
        )
      }
    : technicalSettings;
  const windowMinutes = effectiveSettings.kitchenLoadWindowMinutes || 30;
  const maxCovers = Math.max(Number(effectiveSettings.kitchenLoadMaxCovers || 0), 0);
  const buckets = new Map();

  for (const reservation of reservations) {
    if (!["IN_ATTESA", "CONFERMATA", "IN_CORSO", "COMPLETATA"].includes(reservation.status)) {
      continue;
    }

    const bucket = getKitchenLoadBucket(reservation.dateTime, windowMinutes);
    const key = bucket.toISOString();
    const current = buckets.get(key) || {
      key,
      label: formatKitchenLoadBucketLabel(bucket),
      dateTime: bucket,
      covers: 0,
      reservations: 0,
      maxCovers,
      loadPercent: 0,
      overloaded: false
    };

    current.covers += Number(reservation.guests || 0);
    current.reservations += 1;
    current.loadPercent = maxCovers > 0 ? Math.round((current.covers / maxCovers) * 100) : 0;
    current.overloaded = maxCovers > 0 && current.covers > maxCovers;
    buckets.set(key, current);
  }

  return [...buckets.values()].sort((left, right) => new Date(left.dateTime) - new Date(right.dateTime));
}

export function canAddCoversToKitchenLoad({
  reservations = [],
  dateTime,
  guests,
  technicalSettings = {}
}) {
  const effectiveSettings = technicalSettings.yieldRuleSettings
    ? {
        ...technicalSettings,
        ...deriveTechnicalSettingsFromYieldRules(
          technicalSettings.yieldRuleSettings,
          technicalSettings
        )
      }
    : technicalSettings;

  if (
    !effectiveSettings.yieldEngineEnabled ||
    effectiveSettings.kitchenLoadGuardEnabled === false ||
    (effectiveSettings.yieldRuleSettings &&
      !shouldApplyYieldRule(effectiveSettings.yieldRuleSettings, "kitchenLoadCap", {
        dateTime,
        reservationCount: reservations.length
      }))
  ) {
    return {
      allowed: true,
      covers: 0,
      maxCovers: Number(effectiveSettings.kitchenLoadMaxCovers || 0),
      label: ""
    };
  }

  const maxCovers = Number(effectiveSettings.kitchenLoadMaxCovers || 0);

  if (maxCovers <= 0) {
    return {
      allowed: true,
      covers: 0,
      maxCovers,
      label: ""
    };
  }

  const bucket = getKitchenLoadBucket(
    dateTime,
    effectiveSettings.kitchenLoadWindowMinutes || 30
  );
  const bucketKey = bucket.toISOString();
  const buckets = buildKitchenLoadBuckets(reservations, effectiveSettings);
  const current = buckets.find((item) => item.key === bucketKey) || {
    covers: 0,
    label: formatKitchenLoadBucketLabel(bucket)
  };
  const nextCovers = current.covers + Number(guests || 0);

  return {
    allowed: nextCovers <= maxCovers,
    covers: current.covers,
    nextCovers,
    maxCovers,
    label: current.label
  };
}

export function getControlledOverbookingDecision({
  reservations = [],
  dateTime,
  guests,
  customerProfile = null,
  technicalSettings = {}
}) {
  const effectiveSettings = technicalSettings.yieldRuleSettings
    ? {
        ...technicalSettings,
        ...deriveTechnicalSettingsFromYieldRules(
          technicalSettings.yieldRuleSettings,
          technicalSettings
        )
      }
    : technicalSettings;

  if (
    !effectiveSettings.yieldEngineEnabled ||
    !effectiveSettings.controlledOverbookingEnabled ||
    (effectiveSettings.yieldRuleSettings &&
      !shouldApplyYieldRule(effectiveSettings.yieldRuleSettings, "controlledOverbooking", {
        dateTime,
        reservationCount: reservations.length
      }))
  ) {
    return {
      allowed: false,
      reason: "Overbooking controllato disattivo."
    };
  }

  const maxExtraCovers = Number(effectiveSettings.controlledOverbookingMaxCovers || 0);

  if (maxExtraCovers <= 0 || Number(guests || 0) > maxExtraCovers) {
    return {
      allowed: false,
      reason: "Extra coperti oltre il limite configurato."
    };
  }

  const minReliability = Number(effectiveSettings.controlledOverbookingMinReliabilityScore || 0);
  const reliability = Number(customerProfile?.reliabilityScore || 0);

  if (customerProfile && reliability < minReliability) {
    return {
      allowed: false,
      reason: "Affidabilita cliente sotto soglia overbooking."
    };
  }

  const kitchenLoad = canAddCoversToKitchenLoad({
    reservations,
    dateTime,
    guests,
    technicalSettings: effectiveSettings
  });

  if (!kitchenLoad.allowed) {
    return {
      allowed: false,
      reason: `Carico cucina saturo nello slot ${kitchenLoad.label}.`
    };
  }

  return {
    allowed: true,
    reason: "Overbooking controllato entro soglia e carico cucina sostenibile.",
    kitchenLoad
  };
}

export function buildOwnerBrief({
  reservations = [],
  waitlistEntries = [],
  kitchenLoad = [],
  stats = {}
}) {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const todayReservations = reservations.filter(
    (reservation) => new Date(reservation.dateTime).toISOString().slice(0, 10) === todayKey
  );
  const covers = todayReservations.reduce((sum, reservation) => sum + reservation.guests, 0);
  const vipArrivals = todayReservations.filter(
    (reservation) =>
      reservation.customerProfile?.vip ||
      reservation.customerBand === "A" ||
      reservation.customerPriorityScore >= 82
  );
  const riskArrivals = todayReservations.filter(
    (reservation) =>
      reservation.customerBand === "D" ||
      reservation.customerProfile?.noShowCount >= 2 ||
      reservation.customerProfile?.reliabilityScore < 40
  );
  const openWaitlist = waitlistEntries.filter((entry) => entry.status === "OPEN");
  const peakKitchen = [...kitchenLoad].sort((left, right) => right.covers - left.covers)[0] || null;
  const notes = [];

  if (todayReservations.length > 0) {
    notes.push(`${todayReservations.length} prenotazioni per ${covers} coperti oggi.`);
  }

  if (vipArrivals.length > 0) {
    notes.push(`${vipArrivals.length} clienti ad alto valore in arrivo.`);
  }

  if (riskArrivals.length > 0) {
    notes.push(`${riskArrivals.length} prenotazioni con rischio no-show da presidiare.`);
  }

  if (openWaitlist.length > 0) {
    notes.push(`${openWaitlist.length} richieste in coda ancora aperte.`);
  }

  if (peakKitchen?.overloaded) {
    notes.push(`Picco cucina critico alle ${peakKitchen.label}: ${peakKitchen.covers}/${peakKitchen.maxCovers} coperti.`);
  } else if (peakKitchen) {
    notes.push(`Picco cucina alle ${peakKitchen.label}: ${peakKitchen.covers}/${peakKitchen.maxCovers || "n.d."} coperti.`);
  }

  if (stats.revenuePerSeatHour) {
    notes.push(`Resa media: EUR ${Math.round(stats.revenuePerSeatHour)} per posto/ora.`);
  }

  return {
    date: todayKey,
    reservations: todayReservations.length,
    covers,
    vipArrivals: vipArrivals.length,
    riskArrivals: riskArrivals.length,
    openWaitlist: openWaitlist.length,
    peakKitchen,
    notes
  };
}
