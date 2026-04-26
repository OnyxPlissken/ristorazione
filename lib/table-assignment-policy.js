import {
  deriveTechnicalSettingsFromYieldRules,
  shouldApplyYieldRule
} from "./yield-rules";

const STRATEGY_DEFAULTS = {
  FIRST_COME: {
    tableFit: 25,
    partySize: 10,
    customerPriority: 5,
    averageSpend: 0,
    createdAt: 60
  },
  BALANCED: {
    tableFit: 30,
    partySize: 25,
    customerPriority: 20,
    averageSpend: 15,
    createdAt: 10
  },
  REVENUE: {
    tableFit: 20,
    partySize: 35,
    customerPriority: 15,
    averageSpend: 25,
    createdAt: 5
  },
  VIP: {
    tableFit: 20,
    partySize: 10,
    customerPriority: 40,
    averageSpend: 25,
    createdAt: 5
  },
  FIT: {
    tableFit: 55,
    partySize: 25,
    customerPriority: 10,
    averageSpend: 0,
    createdAt: 10
  }
};

export const TABLE_ASSIGNMENT_STRATEGIES = Object.keys(STRATEGY_DEFAULTS);
export const TABLE_ASSIGNMENT_SLOT_MODES = ["PRECISE", "FLEXIBLE"];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function cleanPositiveInteger(value, fallback, min = 0, max = 1000) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(Math.round(parsed), min, max) : fallback;
}

function normalizeStrategy(value) {
  const normalized = String(value || "BALANCED").trim().toUpperCase();
  return TABLE_ASSIGNMENT_STRATEGIES.includes(normalized) ? normalized : "BALANCED";
}

function normalizeSlotMode(value) {
  const normalized = String(value || "FLEXIBLE").trim().toUpperCase();
  return TABLE_ASSIGNMENT_SLOT_MODES.includes(normalized) ? normalized : "FLEXIBLE";
}

function normalizeWeights(policy) {
  const total =
    policy.weightTableFit +
    policy.weightPartySize +
    policy.weightCustomerPriority +
    policy.weightAverageSpend +
    policy.weightCreatedAt;

  if (total <= 0) {
    return {
      tableFit: 0.3,
      partySize: 0.25,
      customerPriority: 0.2,
      averageSpend: 0.15,
      createdAt: 0.1
    };
  }

  return {
    tableFit: policy.weightTableFit / total,
    partySize: policy.weightPartySize / total,
    customerPriority: policy.weightCustomerPriority / total,
    averageSpend: policy.weightAverageSpend / total,
    createdAt: policy.weightCreatedAt / total
  };
}

export function getTableAssignmentPolicy(technicalSettings = {}) {
  const derivedSettings = technicalSettings.yieldRuleSettings
    ? {
        ...technicalSettings,
        ...deriveTechnicalSettingsFromYieldRules(
          technicalSettings.yieldRuleSettings,
          technicalSettings
        )
      }
    : technicalSettings;
  const strategy = normalizeStrategy(derivedSettings.tableAssignmentStrategy);
  const defaults = STRATEGY_DEFAULTS[strategy];
  const enabled = Boolean(derivedSettings.yieldEngineEnabled);
  const policy = {
    enabled,
    ruleSettings: derivedSettings.yieldRuleSettings || null,
    strategy,
    slotMode: normalizeSlotMode(derivedSettings.tableAssignmentSlotMode),
    flexMinutes: cleanPositiveInteger(
      derivedSettings.tableAssignmentFlexMinutes,
      enabled ? 30 : 0,
      0,
      180
    ),
    turnoverBufferMinutes: cleanPositiveInteger(
      derivedSettings.tableAssignmentTurnoverBufferMinutes,
      enabled ? 15 : 0,
      0,
      90
    ),
    combineTablesEnabled: derivedSettings.tableAssignmentCombineTablesEnabled !== false,
    maxTables: cleanPositiveInteger(
      derivedSettings.tableAssignmentMaxTables,
      4,
      1,
      8
    ),
    minOccupancyPercent: cleanPositiveInteger(
      derivedSettings.tableAssignmentMinOccupancyPercent,
      50,
      0,
      100
    ),
    weightTableFit: cleanPositiveInteger(
      derivedSettings.tableAssignmentWeightTableFit,
      defaults.tableFit,
      0,
      100
    ),
    weightPartySize: cleanPositiveInteger(
      derivedSettings.tableAssignmentWeightPartySize,
      defaults.partySize,
      0,
      100
    ),
    weightCustomerPriority: cleanPositiveInteger(
      derivedSettings.tableAssignmentWeightCustomerPriority,
      defaults.customerPriority,
      0,
      100
    ),
    weightAverageSpend: cleanPositiveInteger(
      derivedSettings.tableAssignmentWeightAverageSpend,
      defaults.averageSpend,
      0,
      100
    ),
    weightCreatedAt: cleanPositiveInteger(
      derivedSettings.tableAssignmentWeightCreatedAt,
      defaults.createdAt,
      0,
      100
    )
  };

  return {
    ...policy,
    normalizedWeights: normalizeWeights(policy)
  };
}

function getCustomerPriority(reservation) {
  const profile = reservation.customerProfile || {};

  if (profile.vip) {
    return 100;
  }

  return clamp(
    Number(profile.priorityScore ?? reservation.customerPriorityScore ?? 0),
    0,
    100
  );
}

function getAverageSpendScore(reservation) {
  const profile = reservation.customerProfile || {};
  const averageSpend = Number(profile.averageSpend ?? reservation.spendAmount ?? 0);

  if (!Number.isFinite(averageSpend) || averageSpend <= 0) {
    return 0;
  }

  return clamp(Math.round((averageSpend / 150) * 100), 0, 100);
}

function getCreatedAtScore(reservation, context = {}) {
  const createdAt = new Date(reservation.createdAt || Date.now()).getTime();
  const oldest = context.oldestCreatedAt
    ? new Date(context.oldestCreatedAt).getTime()
    : createdAt;
  const newest = context.newestCreatedAt
    ? new Date(context.newestCreatedAt).getTime()
    : createdAt;

  if (!Number.isFinite(createdAt) || newest <= oldest) {
    return 100;
  }

  return clamp(Math.round(100 - ((createdAt - oldest) / (newest - oldest)) * 100), 0, 100);
}

function getTableFitScore(reservation, assignment, policy) {
  if (!assignment?.totalSeats || !reservation?.guests) {
    return 0;
  }

  const occupancyPercent = (Number(reservation.guests) / Number(assignment.totalSeats)) * 100;
  const wastePenalty = Math.max(Number(assignment.totalSeats) - Number(reservation.guests), 0) * 9;
  const belowMinPenalty = Math.max(policy.minOccupancyPercent - occupancyPercent, 0) * 1.4;
  const combinationPenalty = Math.max((assignment.tables?.length || 1) - 1, 0) * 10;

  return clamp(
    Math.round(occupancyPercent - wastePenalty - belowMinPenalty - combinationPenalty),
    0,
    100
  );
}

function getPartySizeScore(reservation, assignment) {
  if (!assignment?.totalSeats || !reservation?.guests) {
    return 0;
  }

  return clamp(
    Math.round((Number(reservation.guests) / Number(assignment.totalSeats)) * 100),
    0,
    100
  );
}

export function scoreReservationAssignment({ reservation, assignment, policy, context = {} }) {
  const normalizedPolicy = policy || getTableAssignmentPolicy();
  const weights = normalizedPolicy.normalizedWeights;
  const ruleContext = {
    ...context,
    dateTime: reservation?.dateTime,
    needsCombination: assignment?.isCombined,
    singleTableAvailable: assignment?.isCombined ? false : true
  };
  const ruleSettings = normalizedPolicy.ruleSettings;
  const components = {
    tableFit:
      !ruleSettings ||
      shouldApplyYieldRule(ruleSettings, "exactTableFit", ruleContext) ||
      shouldApplyYieldRule(ruleSettings, "underfillProtection", ruleContext)
        ? getTableFitScore(reservation, assignment, normalizedPolicy)
        : 0,
    partySize:
      !ruleSettings || shouldApplyYieldRule(ruleSettings, "maximizeCovers", ruleContext)
        ? getPartySizeScore(reservation, assignment)
        : 0,
    customerPriority:
      !ruleSettings ||
      shouldApplyYieldRule(ruleSettings, "bestCustomerPriority", ruleContext)
        ? getCustomerPriority(reservation)
        : 0,
    averageSpend:
      !ruleSettings ||
      shouldApplyYieldRule(ruleSettings, "bestCustomerPriority", ruleContext)
        ? getAverageSpendScore(reservation)
        : 0,
    createdAt:
      !ruleSettings || shouldApplyYieldRule(ruleSettings, "firstRequestTieBreak", ruleContext)
        ? getCreatedAtScore(reservation, context)
        : 0
  };
  const total = Math.round(
    components.tableFit * weights.tableFit +
      components.partySize * weights.partySize +
      components.customerPriority * weights.customerPriority +
      components.averageSpend * weights.averageSpend +
      components.createdAt * weights.createdAt
  );

  return {
    total,
    components
  };
}

export function compareReservationAssignmentCandidates(left, right) {
  if ((right.score?.total || 0) !== (left.score?.total || 0)) {
    return (right.score?.total || 0) - (left.score?.total || 0);
  }

  if ((right.reservation?.guests || 0) !== (left.reservation?.guests || 0)) {
    return (right.reservation?.guests || 0) - (left.reservation?.guests || 0);
  }

  const rightPriority =
    right.score?.components?.customerPriority || right.reservation?.customerPriorityScore || 0;
  const leftPriority =
    left.score?.components?.customerPriority || left.reservation?.customerPriorityScore || 0;

  if (rightPriority !== leftPriority) {
    return rightPriority - leftPriority;
  }

  const rightSpend = right.score?.components?.averageSpend || 0;
  const leftSpend = left.score?.components?.averageSpend || 0;

  if (rightSpend !== leftSpend) {
    return rightSpend - leftSpend;
  }

  return new Date(left.reservation?.createdAt || 0) - new Date(right.reservation?.createdAt || 0);
}

export function formatAssignmentReason(candidate) {
  const components = candidate?.score?.components || {};
  const reasons = [];

  if (components.tableFit >= 85) {
    reasons.push("aderenza tavolo alta");
  } else if (components.tableFit <= 45) {
    reasons.push("occupa un tavolo ampio");
  }

  if (components.customerPriority >= 82) {
    reasons.push("cliente prioritario");
  }

  if (components.averageSpend >= 60) {
    reasons.push("carrello medio rilevante");
  }

  if (components.createdAt >= 90) {
    reasons.push("richiesta tra le prime dello slot");
  }

  return reasons.length > 0 ? reasons.join(", ") : "miglior punteggio operativo";
}
