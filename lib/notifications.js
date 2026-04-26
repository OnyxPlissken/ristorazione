import nodemailer from "nodemailer";
import { db } from "./db";
import { RESERVATION_STATUS_LABELS } from "./constants";
import { formatDateTime } from "./format";
import { getAppBaseUrl } from "./app-url";
import { ensureReservationManageToken } from "./reservations";

const RETRY_DELAYS_MINUTES = [5, 15, 60, 180];

function publicLocationName(location) {
  return location?.technicalSettings?.displayName || location?.name || "Sede";
}

export function buildManageUrl(token) {
  return `${getAppBaseUrl()}/prenotazione/${token}`;
}

function buildHostedPaymentUrl(token) {
  return `${getAppBaseUrl()}/pagamento/${token}`;
}

function toUtf16BeHex(message) {
  const buffer = Buffer.from(message, "utf16le");

  for (let index = 0; index < buffer.length; index += 2) {
    const left = buffer[index];
    buffer[index] = buffer[index + 1];
    buffer[index + 1] = left;
  }

  return buffer.toString("hex").toUpperCase();
}

function buildSmsPayload(message) {
  const requiresUnicode = /[^\x00-\x7F]/.test(message);

  return {
    mt: requiresUnicode ? "1" : "0",
    msg: requiresUnicode ? toUtf16BeHex(message) : message
  };
}

export function renderTemplate(template, context) {
  return String(template || "")
    .replaceAll("{{cliente}}", context.guestName || "")
    .replaceAll("{{nome_cliente}}", context.guestName || "")
    .replaceAll("{{sede}}", context.locationName || "")
    .replaceAll("{{data_ora}}", context.dateTime || "")
    .replaceAll("{{data}}", context.date || "")
    .replaceAll("{{orario}}", context.time || "")
    .replaceAll("{{coperti}}", String(context.guests || ""))
    .replaceAll("{{stato}}", context.statusLabel || "")
    .replaceAll("{{link_prenotazione}}", context.manageUrl || "")
    .replaceAll("{{link_pagamento}}", context.paymentUrl || "")
    .replaceAll("{{fascia_cliente}}", context.customerBandLabel || "")
    .replaceAll("{{priorita_cliente}}", String(context.priorityScore || 0))
    .replaceAll("{{importo_deposito}}", context.depositAmount || "")
    .replaceAll("{{motivo_deposito}}", context.depositReason || "")
    .replaceAll("{{scadenza_proposta}}", context.offerExpiresAt || "");
}

export function buildTemplateContext(reservation, location, options = {}) {
  const date = reservation?.dateTime ? new Date(reservation.dateTime) : new Date();
  const depositAmount =
    reservation?.depositAmount != null ? Number(reservation.depositAmount).toFixed(2) : "";

  return {
    guestName: reservation?.guestName || options.guestName || "Cliente",
    guests: reservation?.guests || options.guests || 0,
    locationName: publicLocationName(location),
    dateTime: formatDateTime(date),
    date: new Intl.DateTimeFormat("it-IT", {
      dateStyle: "medium"
    }).format(date),
    time: new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date),
    statusLabel:
      RESERVATION_STATUS_LABELS[reservation?.status] || reservation?.status || "",
    manageUrl: options.manageUrl || "",
    paymentUrl: options.paymentUrl || "",
    customerBandLabel: options.customerBandLabel || "",
    priorityScore: options.priorityScore || 0,
    depositAmount: depositAmount ? `EUR ${depositAmount}` : "",
    depositReason: options.depositReason || "",
    offerExpiresAt: options.offerExpiresAt || ""
  };
}

async function createNotificationLog({
  jobId = null,
  attemptNumber = 1,
  locationId,
  reservationId = null,
  waitlistEntryId = null,
  channel,
  status,
  event,
  destination = null,
  subject = null,
  contentPreview = null,
  providerResponse = null,
  errorMessage = null
}) {
  if (!locationId || !channel || !event || !status) {
    return null;
  }

  return db.notificationLog.create({
    data: {
      jobId,
      attemptNumber,
      locationId,
      reservationId,
      waitlistEntryId,
      channel,
      status,
      event,
      destination,
      subject,
      contentPreview,
      providerResponse,
      errorMessage
    }
  });
}

async function sendSmsDirect(technicalSettings, to, message) {
  if (
    !technicalSettings?.smsEnabled ||
    !technicalSettings.smsUsername ||
    !technicalSettings.smsPassword ||
    !technicalSettings.smsAlias ||
    !to ||
    !message
  ) {
    return {
      skipped: true,
      reason: "Configurazione SMS incompleta o destinatario mancante."
    };
  }

  const payload = buildSmsPayload(message);
  const body = new URLSearchParams({
    username: technicalSettings.smsUsername,
    password: technicalSettings.smsPassword,
    mno: String(to).replace(/\s+/g, ""),
    sid: technicalSettings.smsAlias,
    msg: payload.msg,
    mt: payload.mt
  });

  const response = await fetch("https://api.1s2u.io/bulksms", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: body.toString(),
    cache: "no-store"
  });
  const text = await response.text();

  if (!response.ok || !text.trim().startsWith("OK")) {
    throw new Error(`Invio SMS fallito: ${text || response.status}`);
  }

  return {
    skipped: false,
    providerResponse: text
  };
}

async function sendEmailDirect(technicalSettings, to, subject, text) {
  if (
    !to ||
    !subject ||
    !text ||
    !technicalSettings?.smtpHost ||
    !technicalSettings?.smtpPort ||
    !technicalSettings?.smtpFromEmail
  ) {
    return {
      skipped: true,
      reason: "Configurazione email incompleta o destinatario mancante."
    };
  }

  const transporter = nodemailer.createTransport({
    host: technicalSettings.smtpHost,
    port: Number(technicalSettings.smtpPort),
    secure: Boolean(technicalSettings.smtpSecure),
    auth: technicalSettings.smtpUsername
      ? {
          user: technicalSettings.smtpUsername,
          pass: technicalSettings.smtpPassword || ""
        }
      : undefined
  });

  const result = await transporter.sendMail({
    from: technicalSettings.smtpFromName
      ? `"${technicalSettings.smtpFromName}" <${technicalSettings.smtpFromEmail}>`
      : technicalSettings.smtpFromEmail,
    to,
    subject,
    text
  });

  return {
    skipped: false,
    providerResponse: result?.messageId || null
  };
}

async function sendWebhookDirect(job, technicalSettings) {
  const webhookUrl =
    job.payload?.webhookUrl ||
    (technicalSettings?.notificationWebhookEnabled
      ? technicalSettings.notificationWebhookUrl
      : null);

  if (!webhookUrl) {
    return {
      skipped: true,
      reason: "Webhook non configurato."
    };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(technicalSettings?.notificationWebhookSecret
        ? {
            "x-coperto-webhook-secret": technicalSettings.notificationWebhookSecret
          }
        : {}),
      ...(job.payload?.headers || {})
    },
    body: JSON.stringify(job.payload?.body || {}),
    cache: "no-store"
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Webhook fallito: ${text || response.status}`);
  }

  return {
    skipped: false,
    providerResponse: text || "OK"
  };
}

function nextRetryAt(attempts) {
  const index = Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MINUTES.length - 1);
  return new Date(Date.now() + RETRY_DELAYS_MINUTES[index] * 60 * 1000);
}

export async function enqueueNotificationJob({
  locationId = null,
  reservationId = null,
  waitlistEntryId = null,
  customerProfileId = null,
  paymentRequestId = null,
  channel,
  event,
  destination = null,
  subject = null,
  content = null,
  payload = null,
  maxAttempts = 3,
  nextAttemptAt = new Date()
}) {
  if (!locationId || !channel || !event) {
    return null;
  }

  return db.notificationJob.create({
    data: {
      locationId,
      reservationId,
      waitlistEntryId,
      customerProfileId,
      paymentRequestId,
      channel,
      event,
      destination,
      subject,
      content,
      payload,
      maxAttempts,
      nextAttemptAt
    }
  });
}

async function enqueueWebhookMirrorJob({
  location,
  reservation = null,
  waitlistEntryId = null,
  paymentRequestId = null,
  customerProfileId = null,
  event,
  body
}) {
  if (
    !location?.id ||
    !location.technicalSettings?.notificationWebhookEnabled ||
    !location.technicalSettings?.notificationWebhookUrl
  ) {
    return null;
  }

  return enqueueNotificationJob({
    locationId: location.id,
    reservationId: reservation?.id || null,
    waitlistEntryId,
    paymentRequestId,
    customerProfileId,
    channel: "WEBHOOK",
    event,
    payload: {
      webhookUrl: location.technicalSettings.notificationWebhookUrl,
      body
    }
  });
}

export async function cancelQueuedReservationNotifications(
  reservationId,
  eventPrefix = "CRM_REMINDER"
) {
  if (!reservationId) {
    return;
  }

  await db.notificationJob.updateMany({
    where: {
      reservationId,
      ...(eventPrefix
        ? {
            event: {
              startsWith: eventPrefix
            }
          }
        : {}),
      status: {
        in: ["PENDING", "RETRYING", "PROCESSING"]
      }
    },
    data: {
      status: "CANCELLED",
      completedAt: new Date(),
      lastError: "Rimpiazzato da una nuova schedulazione."
    }
  });
}

function chooseReminderProfile(profile) {
  if (!profile) {
    return "STANDARD";
  }

  if (profile.vip) {
    return "VIP";
  }

  if (profile.noShowCount > 0 || profile.band === "D") {
    return "RISK";
  }

  return "STANDARD";
}

export async function scheduleReservationReminderNotifications(
  reservation,
  location,
  profile = null
) {
  const technicalSettings = location?.technicalSettings || {};
  const leadHours = Number(technicalSettings.crmReminderLeadHours || 24);
  const sendAt = new Date(
    new Date(reservation.dateTime).getTime() - leadHours * 60 * 60 * 1000
  );

  if (sendAt.getTime() <= Date.now()) {
    return [];
  }

  await cancelQueuedReservationNotifications(reservation.id, "CRM_REMINDER");

  const reminderProfile = chooseReminderProfile(profile);
  const token = await ensureReservationManageToken(reservation.id);
  const paymentUrl =
    reservation.depositRequired && reservation.depositAmount && reservation.paymentRequests?.[0]?.token
      ? buildHostedPaymentUrl(reservation.paymentRequests[0].token)
      : "";
  const context = buildTemplateContext(reservation, location, {
    manageUrl: token ? buildManageUrl(token) : "",
    paymentUrl,
    customerBandLabel: profile?.band || reservation.customerBand || "",
    priorityScore: profile?.priorityScore || reservation.customerPriorityScore || 0,
    depositReason:
      reservation.depositRequired && reminderProfile === "RISK"
        ? "Conferma o saldo consigliato per confermare il tavolo."
        : ""
  });

  const defaultTemplate =
    "Ciao {{cliente}}, ti ricordiamo la prenotazione da {{sede}} per {{data}} alle {{orario}}. Gestiscila qui: {{link_prenotazione}}";
  const vipTemplate =
    technicalSettings.crmVipReminderTemplate ||
    "Ciao {{cliente}}, il tuo tavolo da {{sede}} ti aspetta il {{data}} alle {{orario}}. Se vuoi aggiornare la prenotazione usa: {{link_prenotazione}}";
  const riskTemplate =
    technicalSettings.crmRiskReminderTemplate ||
    "Ciao {{cliente}}, ricordati di confermare la prenotazione da {{sede}} per {{data}} alle {{orario}}. Link gestione: {{link_prenotazione}} {{link_pagamento}}";
  const noShowTemplate =
    technicalSettings.crmNoShowReminderTemplate ||
    riskTemplate;
  const standardTemplate = defaultTemplate;

  let template = standardTemplate;
  let event = "CRM_REMINDER_STANDARD";

  if (profile?.vip && technicalSettings.crmVipReminderEnabled) {
    template = vipTemplate;
    event = "CRM_REMINDER_VIP";
  } else if (profile?.noShowCount > 0 && technicalSettings.crmNoShowReminderEnabled) {
    template = noShowTemplate;
    event = "CRM_REMINDER_NOSHOW";
  } else if ((profile?.band === "D" || profile?.noShowCount > 0) && technicalSettings.crmRiskReminderEnabled) {
    template = riskTemplate;
    event = "CRM_REMINDER_RISK";
  }

  const message = renderTemplate(template, context);
  const jobs = [];

  if (reservation.guestPhone) {
    jobs.push(
      enqueueNotificationJob({
        locationId: location.id,
        reservationId: reservation.id,
        customerProfileId: reservation.customerProfileId || profile?.id || null,
        channel: "SMS",
        event,
        destination: reservation.guestPhone,
        content: message,
        nextAttemptAt: sendAt
      })
    );
  }

  if (reservation.guestEmail) {
    jobs.push(
      enqueueNotificationJob({
        locationId: location.id,
        reservationId: reservation.id,
        customerProfileId: reservation.customerProfileId || profile?.id || null,
        channel: "EMAIL",
        event,
        destination: reservation.guestEmail,
        subject: "Promemoria prenotazione",
        content: message,
        nextAttemptAt: sendAt
      })
    );
  }

  await enqueueWebhookMirrorJob({
    location,
    reservation,
    customerProfileId: reservation.customerProfileId || profile?.id || null,
    event,
    body: {
      type: event,
      reservationId: reservation.id,
      customerProfileId: reservation.customerProfileId || profile?.id || null,
      scheduledFor: sendAt.toISOString()
    }
  });

  return Promise.all(jobs);
}

export async function queueCustomerBirthdayNotifications(limit = 50) {
  const today = new Date();
  const month = today.getMonth();
  const day = today.getDate();
  const profiles = await db.customerProfile.findMany({
    where: {
      archivedAt: null,
      birthDate: {
        not: null
      },
      OR: [{ normalizedPhone: { not: null } }, { normalizedEmail: { not: null } }]
    },
    include: {
      reservations: {
        where: {
          archivedAt: null
        },
        include: {
          location: {
            include: {
              technicalSettings: true
            }
          }
        },
        orderBy: {
          dateTime: "desc"
        },
        take: 3
      }
    },
    take: limit
  });

  let queued = 0;

  for (const profile of profiles) {
    const birthDate = profile.birthDate ? new Date(profile.birthDate) : null;

    if (!birthDate || birthDate.getMonth() !== month || birthDate.getDate() !== day) {
      continue;
    }

    const latestReservation = profile.reservations[0];
    const location = latestReservation?.location;

    if (!location?.technicalSettings?.crmBirthdayEnabled) {
      continue;
    }

    const alreadyQueued = await db.notificationJob.findFirst({
      where: {
        customerProfileId: profile.id,
        event: "CRM_BIRTHDAY",
        createdAt: {
          gte: new Date(today.getFullYear(), month, day, 0, 0, 0, 0),
          lte: new Date(today.getFullYear(), month, day, 23, 59, 59, 999)
        }
      }
    });

    if (alreadyQueued) {
      continue;
    }

    const context = {
      guestName: profile.displayName,
      locationName: publicLocationName(location),
      dateTime: "",
      date: "",
      time: "",
      guests: "",
      statusLabel: "",
      manageUrl: "",
      paymentUrl: "",
      customerBandLabel: profile.band || "",
      priorityScore: profile.priorityScore || 0,
      depositAmount: "",
      depositReason: ""
    };
    const message = renderTemplate(
      location.technicalSettings.crmBirthdayTemplate ||
        "Buon compleanno {{cliente}} da {{sede}}. Ti aspettiamo presto al ristorante.",
      context
    );

    if (profile.normalizedPhone) {
      await enqueueNotificationJob({
        locationId: location.id,
        customerProfileId: profile.id,
        channel: "SMS",
        event: "CRM_BIRTHDAY",
        destination: profile.normalizedPhone,
        content: message
      });
      queued += 1;
    } else if (profile.normalizedEmail) {
      await enqueueNotificationJob({
        locationId: location.id,
        customerProfileId: profile.id,
        channel: "EMAIL",
        event: "CRM_BIRTHDAY",
        destination: profile.normalizedEmail,
        subject: "Buon compleanno da Coperto",
        content: message
      });
      queued += 1;
    }
  }

  return queued;
}

async function loadJobRelations(job) {
  return db.notificationJob.findUnique({
    where: {
      id: job.id
    },
    include: {
      location: {
        include: {
          technicalSettings: true
        }
      },
      reservation: true,
      waitlistEntry: true,
      paymentRequest: true
    }
  });
}

async function processNotificationJob(job) {
  const hydratedJob = await loadJobRelations(job);

  if (!hydratedJob || !hydratedJob.locationId || !hydratedJob.location) {
    await db.notificationJob.update({
      where: {
        id: job.id
      },
      data: {
        status: "FAILED",
        attempts: {
          increment: 1
        },
        lastAttemptAt: new Date(),
        lastError: "Job orfano o sede non disponibile."
      }
    });
    return { processed: true, failed: true };
  }

  const technicalSettings = hydratedJob.location.technicalSettings || {};
  const nextAttemptNumber = hydratedJob.attempts + 1;

  try {
    let result = { skipped: true, reason: "Canale non supportato." };

    if (hydratedJob.channel === "SMS") {
      result = await sendSmsDirect(
        technicalSettings,
        hydratedJob.destination,
        hydratedJob.content
      );
    } else if (hydratedJob.channel === "EMAIL") {
      result = await sendEmailDirect(
        technicalSettings,
        hydratedJob.destination,
        hydratedJob.subject,
        hydratedJob.content
      );
    } else if (hydratedJob.channel === "WEBHOOK") {
      result = await sendWebhookDirect(hydratedJob, technicalSettings);
    }

    await createNotificationLog({
      jobId: hydratedJob.id,
      attemptNumber: nextAttemptNumber,
      locationId: hydratedJob.locationId,
      reservationId: hydratedJob.reservationId,
      waitlistEntryId: hydratedJob.waitlistEntryId,
      channel: hydratedJob.channel,
      status: result.skipped ? "SKIPPED" : "SENT",
      event: hydratedJob.event,
      destination: hydratedJob.destination,
      subject: hydratedJob.subject,
      contentPreview: hydratedJob.content?.slice(0, 240) || null,
      providerResponse: result.providerResponse || result.reason || null
    });

    await db.notificationJob.update({
      where: {
        id: hydratedJob.id
      },
      data: {
        status: "COMPLETED",
        attempts: nextAttemptNumber,
        lastAttemptAt: new Date(),
        completedAt: new Date(),
        providerResponse: result.providerResponse || result.reason || null,
        lastError: null
      }
    });

    return {
      processed: true,
      skipped: result.skipped,
      sent: !result.skipped
    };
  } catch (error) {
    const nextStatus =
      nextAttemptNumber >= hydratedJob.maxAttempts ? "FAILED" : "RETRYING";

    await createNotificationLog({
      jobId: hydratedJob.id,
      attemptNumber: nextAttemptNumber,
      locationId: hydratedJob.locationId,
      reservationId: hydratedJob.reservationId,
      waitlistEntryId: hydratedJob.waitlistEntryId,
      channel: hydratedJob.channel,
      status: "FAILED",
      event: hydratedJob.event,
      destination: hydratedJob.destination,
      subject: hydratedJob.subject,
      contentPreview: hydratedJob.content?.slice(0, 240) || null,
      errorMessage: error.message || "Invio fallito"
    });

    await db.notificationJob.update({
      where: {
        id: hydratedJob.id
      },
      data: {
        status: nextStatus,
        attempts: nextAttemptNumber,
        lastAttemptAt: new Date(),
        lastError: error.message || "Invio fallito",
        nextAttemptAt: nextStatus === "RETRYING" ? nextRetryAt(nextAttemptNumber) : new Date()
      }
    });

    return {
      processed: true,
      failed: true
    };
  }
}

export async function processDueNotificationJobs({ limit = 25 } = {}) {
  const jobs = await db.notificationJob.findMany({
    where: {
      status: {
        in: ["PENDING", "RETRYING"]
      },
      nextAttemptAt: {
        lte: new Date()
      }
    },
    orderBy: [
      {
        nextAttemptAt: "asc"
      },
      {
        createdAt: "asc"
      }
    ],
    take: limit
  });

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const job of jobs) {
    const locked = await db.notificationJob.updateMany({
      where: {
        id: job.id,
        status: {
          in: ["PENDING", "RETRYING"]
        }
      },
      data: {
        status: "PROCESSING"
      }
    });

    if (!locked.count) {
      continue;
    }

    const result = await processNotificationJob(job);
    processed += result.processed ? 1 : 0;
    sent += result.sent ? 1 : 0;
    skipped += result.skipped ? 1 : 0;
    failed += result.failed ? 1 : 0;
  }

  return {
    processed,
    sent,
    skipped,
    failed
  };
}

export async function sendReservationManageLinkNotification(
  reservation,
  location,
  { skipSms = false, waitlistEntryId = null } = {}
) {
  const token = await ensureReservationManageToken(reservation.id);

  if (!token) {
    return [];
  }

  const technicalSettings = location.technicalSettings || {};
  const manageUrl = buildManageUrl(token);
  const paymentRequest =
    reservation.paymentRequests?.find((item) => item.status === "PENDING") || null;
  const context = buildTemplateContext(reservation, location, {
    manageUrl,
    paymentUrl: paymentRequest?.token ? buildHostedPaymentUrl(paymentRequest.token) : ""
  });
  const deliveryMode = technicalSettings.manageLinkDeliveryMode || "SMS";
  const smsTemplate =
    technicalSettings.manageLinkSmsTemplate ||
    "Ciao {{cliente}}, gestisci o cancella la tua prenotazione per {{sede}} qui: {{link_prenotazione}}";
  const emailSubject =
    technicalSettings.manageLinkEmailSubject || "Gestisci la tua prenotazione";
  const emailTemplate =
    technicalSettings.manageLinkEmailTemplate ||
    "Ciao {{cliente}},\n\npuoi modificare o cancellare la tua prenotazione per {{sede}} qui:\n{{link_prenotazione}}\n\nData: {{data}}\nOrario: {{orario}}\nCoperti: {{coperti}}";

  const jobs = [];

  if (!skipSms && (deliveryMode === "SMS" || deliveryMode === "BOTH") && reservation.guestPhone) {
    jobs.push(
      enqueueNotificationJob({
        locationId: location.id,
        reservationId: reservation.id,
        waitlistEntryId,
        customerProfileId: reservation.customerProfileId || null,
        channel: "SMS",
        event: "MANAGE_LINK",
        destination: reservation.guestPhone,
        content: renderTemplate(smsTemplate, context)
      })
    );
  }

  if ((deliveryMode === "EMAIL" || deliveryMode === "BOTH") && reservation.guestEmail) {
    jobs.push(
      enqueueNotificationJob({
        locationId: location.id,
        reservationId: reservation.id,
        waitlistEntryId,
        customerProfileId: reservation.customerProfileId || null,
        channel: "EMAIL",
        event: "MANAGE_LINK",
        destination: reservation.guestEmail,
        subject: renderTemplate(emailSubject, context),
        content: renderTemplate(emailTemplate, context)
      })
    );
  }

  await enqueueWebhookMirrorJob({
    location,
    reservation,
    waitlistEntryId,
    customerProfileId: reservation.customerProfileId || null,
    event: "MANAGE_LINK",
    body: {
      type: "MANAGE_LINK",
      reservationId: reservation.id,
      manageUrl
    }
  });

  return Promise.all(jobs);
}

export async function sendReservationStatusSmsNotification(reservation, location) {
  const technicalSettings = location.technicalSettings || {};
  const configuredStatuses = technicalSettings.reservationStatusSmsStatuses || [];

  if (!configuredStatuses.includes(reservation.status) || !technicalSettings.reservationStatusSmsTemplate) {
    return null;
  }

  const token = await ensureReservationManageToken(reservation.id);
  const context = buildTemplateContext(reservation, location, {
    manageUrl: token ? buildManageUrl(token) : ""
  });

  if (reservation.guestPhone) {
    await enqueueNotificationJob({
      locationId: location.id,
      reservationId: reservation.id,
      customerProfileId: reservation.customerProfileId || null,
      channel: "SMS",
      event: "RESERVATION_STATUS",
      destination: reservation.guestPhone,
      content: renderTemplate(technicalSettings.reservationStatusSmsTemplate, context)
    });
  }

  await enqueueWebhookMirrorJob({
    location,
    reservation,
    customerProfileId: reservation.customerProfileId || null,
    event: "RESERVATION_STATUS",
    body: {
      type: "RESERVATION_STATUS",
      reservationId: reservation.id,
      status: reservation.status
    }
  });

  return true;
}

export async function sendWaitlistConversionNotification(
  reservation,
  location,
  waitlistEntryId = null
) {
  const technicalSettings = location.technicalSettings || {};
  const token = await ensureReservationManageToken(reservation.id);
  const manageUrl = token ? buildManageUrl(token) : "";
  const offerExpiresAt = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(
    new Date(Date.now() + (technicalSettings.waitlistOfferTtlMinutes || 8) * 60 * 1000)
  );

  if (technicalSettings.waitlistSmsTemplate && reservation.guestPhone) {
    const context = buildTemplateContext(reservation, location, {
      manageUrl,
      offerExpiresAt
    });

    await enqueueNotificationJob({
      locationId: location.id,
      reservationId: reservation.id,
      waitlistEntryId,
      customerProfileId: reservation.customerProfileId || null,
      channel: "SMS",
      event: "WAITLIST_CONVERSION",
      destination: reservation.guestPhone,
      content: renderTemplate(technicalSettings.waitlistSmsTemplate, context)
    });

    await sendReservationManageLinkNotification(reservation, location, {
      skipSms: true,
      waitlistEntryId
    });
  } else {
    await sendReservationManageLinkNotification(reservation, location, {
      waitlistEntryId
    });
  }

  await enqueueWebhookMirrorJob({
    location,
    reservation,
    waitlistEntryId,
    customerProfileId: reservation.customerProfileId || null,
    event: "WAITLIST_CONVERSION",
    body: {
      type: "WAITLIST_CONVERSION",
      reservationId: reservation.id,
      waitlistEntryId
    }
  });

  return true;
}

export async function enqueuePaymentLinkNotification(
  paymentRequest,
  reservation,
  location
) {
  const token = await ensureReservationManageToken(reservation.id);
  const manageUrl = token ? buildManageUrl(token) : "";
  const paymentUrl = paymentRequest?.token ? buildHostedPaymentUrl(paymentRequest.token) : "";
  const context = buildTemplateContext(reservation, location, {
    manageUrl,
    paymentUrl,
    depositReason:
      reservation.depositRequired && reservation.depositAmount
        ? "Completa il deposito per confermare il tavolo."
        : ""
  });
  const message = renderTemplate(
    "Ciao {{cliente}}, per la tua prenotazione da {{sede}} puoi completare il deposito qui: {{link_pagamento}}",
    context
  );

  const jobs = [];

  if (reservation.guestPhone) {
    jobs.push(
      enqueueNotificationJob({
        locationId: location.id,
        reservationId: reservation.id,
        customerProfileId: reservation.customerProfileId || null,
        paymentRequestId: paymentRequest.id,
        channel: "SMS",
        event: "PAYMENT_LINK",
        destination: reservation.guestPhone,
        content: message
      })
    );
  }

  if (reservation.guestEmail) {
    jobs.push(
      enqueueNotificationJob({
        locationId: location.id,
        reservationId: reservation.id,
        customerProfileId: reservation.customerProfileId || null,
        paymentRequestId: paymentRequest.id,
        channel: "EMAIL",
        event: "PAYMENT_LINK",
        destination: reservation.guestEmail,
        subject: "Link pagamento deposito prenotazione",
        content: message
      })
    );
  }

  await enqueueWebhookMirrorJob({
    location,
    reservation,
    paymentRequestId: paymentRequest.id,
    customerProfileId: reservation.customerProfileId || null,
    event: "PAYMENT_LINK",
    body: {
      type: "PAYMENT_LINK",
      reservationId: reservation.id,
      paymentRequestId: paymentRequest.id,
      paymentUrl
    }
  });

  return Promise.all(jobs);
}
