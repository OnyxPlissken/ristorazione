import { db } from "./db";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeCustomerEmail(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
}

export function normalizeCustomerPhone(value) {
  const normalized = String(value || "")
    .replace(/[^\d+]/g, "")
    .replace(/^00/, "+")
    .trim();
  return normalized || null;
}

function scoreBandFromPriority({ noShowCount, priorityScore, reliabilityScore }) {
  if (noShowCount >= 2 || reliabilityScore < 35) {
    return "D";
  }

  if (priorityScore >= 82 && reliabilityScore >= 70) {
    return "A";
  }

  if (priorityScore >= 56) {
    return "B";
  }

  return "C";
}

export function buildCustomerScores(profile) {
  const completedReservations = Number(profile.completedReservations || 0);
  const cancelledReservations = Number(profile.cancelledReservations || 0);
  const noShowCount = Number(profile.noShowCount || 0);
  const visitCount = Number(profile.visitCount || 0);
  const averageSpend = Number(profile.averageSpend || 0);
  const totalSpend = Number(profile.totalSpend || 0);
  const waitlistCount = Number(profile.waitlistCount || 0);
  const lastCompletedAt = profile.lastCompletedAt ? new Date(profile.lastCompletedAt) : null;
  const now = Date.now();
  const daysSinceLastCompleted = lastCompletedAt
    ? Math.floor((now - lastCompletedAt.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  let frequencyScore = completedReservations * 8 + visitCount * 2;
  if (daysSinceLastCompleted !== null) {
    if (daysSinceLastCompleted <= 30) {
      frequencyScore += 24;
    } else if (daysSinceLastCompleted <= 90) {
      frequencyScore += 16;
    } else if (daysSinceLastCompleted <= 180) {
      frequencyScore += 8;
    }
  }

  let reliabilityScore = 58 + completedReservations * 6;
  reliabilityScore -= cancelledReservations * 5;
  reliabilityScore -= noShowCount * 26;
  reliabilityScore -= Math.max(waitlistCount - completedReservations, 0) * 2;

  let valueScore = 0;
  if (averageSpend >= 140) {
    valueScore = 92;
  } else if (averageSpend >= 90) {
    valueScore = 76;
  } else if (averageSpend >= 55) {
    valueScore = 58;
  } else if (averageSpend >= 25) {
    valueScore = 40;
  } else if (completedReservations > 0 || totalSpend > 0) {
    valueScore = 24;
  }

  frequencyScore = clamp(frequencyScore, 0, 100);
  reliabilityScore = clamp(reliabilityScore, 0, 100);
  valueScore = clamp(valueScore, 0, 100);

  const priorityScore = Math.round(
    reliabilityScore * 0.45 + frequencyScore * 0.35 + valueScore * 0.2
  );

  return {
    frequencyScore,
    reliabilityScore,
    valueScore,
    priorityScore,
    band: scoreBandFromPriority({
      noShowCount,
      priorityScore,
      reliabilityScore
    })
  };
}

export async function findCustomerProfileByIdentity({ guestEmail, guestPhone }) {
  const normalizedEmail = normalizeCustomerEmail(guestEmail);
  const normalizedPhone = normalizeCustomerPhone(guestPhone);

  if (!normalizedEmail && !normalizedPhone) {
    return null;
  }

  return db.customerProfile.findFirst({
    where: {
      OR: [
        ...(normalizedEmail ? [{ normalizedEmail }] : []),
        ...(normalizedPhone ? [{ normalizedPhone }] : [])
      ]
    }
  });
}

export async function ensureCustomerProfile({
  guestName,
  guestEmail,
  guestPhone
}) {
  const normalizedEmail = normalizeCustomerEmail(guestEmail);
  const normalizedPhone = normalizeCustomerPhone(guestPhone);

  if (!normalizedEmail && !normalizedPhone) {
    return null;
  }

  const existing = await findCustomerProfileByIdentity({
    guestEmail,
    guestPhone
  });

  if (existing) {
    return db.customerProfile.update({
      where: {
        id: existing.id
      },
      data: {
        displayName: guestName || existing.displayName,
        normalizedEmail: existing.normalizedEmail || normalizedEmail,
        normalizedPhone: existing.normalizedPhone || normalizedPhone
      }
    });
  }

  return db.customerProfile.create({
    data: {
      displayName: guestName || normalizedEmail || normalizedPhone || "Cliente",
      normalizedEmail,
      normalizedPhone
    }
  });
}

export async function syncCustomerProfileMetrics(customerProfileId) {
  if (!customerProfileId) {
    return null;
  }

  const profile = await db.customerProfile.findUnique({
    where: {
      id: customerProfileId
    },
    include: {
      reservations: {
        select: {
          status: true,
          dateTime: true,
          createdAt: true,
          spendAmount: true
        }
      },
      waitlistEntries: {
        select: {
          createdAt: true
        }
      }
    }
  });

  if (!profile) {
    return null;
  }

  const reservations = profile.reservations || [];
  const completedReservations = reservations.filter(
    (reservation) => reservation.status === "COMPLETATA"
  );
  const cancelledReservations = reservations.filter(
    (reservation) => reservation.status === "CANCELLATA"
  );
  const noShowReservations = reservations.filter(
    (reservation) => reservation.status === "NO_SHOW"
  );
  const totalSpend = completedReservations.reduce(
    (sum, reservation) => sum + Number(reservation.spendAmount || 0),
    0
  );
  const averageSpend = completedReservations.length > 0
    ? totalSpend / completedReservations.length
    : 0;
  const firstSeenAt = [
    profile.firstSeenAt,
    ...reservations.map((reservation) => reservation.createdAt),
    ...profile.waitlistEntries.map((entry) => entry.createdAt)
  ]
    .filter(Boolean)
    .sort((left, right) => new Date(left) - new Date(right))[0] || new Date();
  const lastReservationAt = reservations
    .map((reservation) => reservation.dateTime)
    .sort((left, right) => new Date(right) - new Date(left))[0] || null;
  const lastCompletedAt = completedReservations
    .map((reservation) => reservation.dateTime)
    .sort((left, right) => new Date(right) - new Date(left))[0] || null;

  const scores = buildCustomerScores({
    completedReservations: completedReservations.length,
    cancelledReservations: cancelledReservations.length,
    noShowCount: noShowReservations.length,
    visitCount: reservations.length,
    waitlistCount: profile.waitlistEntries.length,
    averageSpend,
    totalSpend,
    lastCompletedAt
  });

  return db.customerProfile.update({
    where: {
      id: customerProfileId
    },
    data: {
      firstSeenAt,
      lastReservationAt,
      lastCompletedAt,
      visitCount: reservations.length,
      completedReservations: completedReservations.length,
      cancelledReservations: cancelledReservations.length,
      noShowCount: noShowReservations.length,
      waitlistCount: profile.waitlistEntries.length,
      totalSpend,
      averageSpend,
      frequencyScore: scores.frequencyScore,
      reliabilityScore: scores.reliabilityScore,
      valueScore: scores.valueScore,
      priorityScore: scores.priorityScore,
      band: scores.band
    }
  });
}

export async function touchCustomerProfileFromGuest(guestInput) {
  const profile = await ensureCustomerProfile(guestInput);

  if (!profile) {
    return null;
  }

  return syncCustomerProfileMetrics(profile.id);
}

export function buildCustomerSnapshot(profile, technicalSettings = {}) {
  if (!profile || technicalSettings.customerScoringEnabled === false) {
    return {
      band: null,
      priorityScore: 0,
      depositRequired: false,
      depositAmount: null,
      depositReason: ""
    };
  }

  const depositEnabled = Boolean(technicalSettings.adaptiveDepositEnabled);
  const depositAmount = technicalSettings.adaptiveDepositAmount
    ? Number(technicalSettings.adaptiveDepositAmount)
    : 0;
  const depositRequired =
    depositEnabled &&
    (profile.band === "D" ||
      profile.noShowCount >= 1 ||
      profile.reliabilityScore < 45);
  let depositReason = "";

  if (depositRequired) {
    if (profile.noShowCount >= 1) {
      depositReason = "Storico no-show o affidabilita ridotta.";
    } else if (profile.band === "D") {
      depositReason = "Cliente classificato ad alto rischio operativo.";
    } else {
      depositReason = "Affidabilita bassa su prenotazioni precedenti.";
    }
  }

  return {
    band: profile.band,
    priorityScore: profile.priorityScore,
    depositRequired,
    depositAmount: depositRequired && depositAmount > 0 ? depositAmount : null,
    depositReason
  };
}

export function sortWaitlistEntriesByPriority(entries, technicalSettings = {}) {
  const smartWaitlistEnabled = technicalSettings.smartWaitlistEnabled !== false;

  return [...entries].sort((left, right) => {
    const leftTime = new Date(left.preferredDateTime).getTime();
    const rightTime = new Date(right.preferredDateTime).getTime();

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    if (smartWaitlistEnabled) {
      if ((right.priorityScore || 0) !== (left.priorityScore || 0)) {
        return (right.priorityScore || 0) - (left.priorityScore || 0);
      }

      if (left.guests !== right.guests) {
        return left.guests - right.guests;
      }
    }

    return new Date(left.createdAt) - new Date(right.createdAt);
  });
}
