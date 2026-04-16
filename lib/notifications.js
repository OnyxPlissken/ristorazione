import nodemailer from "nodemailer";
import { db } from "./db";
import { RESERVATION_STATUS_LABELS } from "./constants";
import { formatDateTime } from "./format";
import { getAppBaseUrl } from "./app-url";
import { ensureReservationManageToken } from "./reservations";

function publicLocationName(location) {
  return location.technicalSettings?.displayName || location.name;
}

function buildManageUrl(token) {
  return `${getAppBaseUrl()}/prenotazione/${token}`;
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

function renderTemplate(template, context) {
  return String(template || "")
    .replaceAll("{{cliente}}", context.guestName)
    .replaceAll("{{nome_cliente}}", context.guestName)
    .replaceAll("{{sede}}", context.locationName)
    .replaceAll("{{data_ora}}", context.dateTime)
    .replaceAll("{{data}}", context.date)
    .replaceAll("{{orario}}", context.time)
    .replaceAll("{{coperti}}", String(context.guests))
    .replaceAll("{{stato}}", context.statusLabel)
    .replaceAll("{{link_prenotazione}}", context.manageUrl);
}

function buildTemplateContext(reservation, location, manageUrl) {
  const date = new Date(reservation.dateTime);

  return {
    guestName: reservation.guestName,
    guests: reservation.guests,
    locationName: publicLocationName(location),
    dateTime: formatDateTime(date),
    date: new Intl.DateTimeFormat("it-IT", {
      dateStyle: "medium"
    }).format(date),
    time: new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date),
    statusLabel: RESERVATION_STATUS_LABELS[reservation.status] || reservation.status,
    manageUrl
  };
}

async function createNotificationLog({
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

async function sendSmsThrough1s2u(technicalSettings, to, message, meta = {}) {
  if (
    !technicalSettings?.smsEnabled ||
    !technicalSettings.smsUsername ||
    !technicalSettings.smsPassword ||
    !technicalSettings.smsAlias ||
    !to ||
    !message
  ) {
    await createNotificationLog({
      ...meta,
      channel: "SMS",
      status: "SKIPPED",
      destination: to || null,
      contentPreview: message ? message.slice(0, 240) : null
    });
    return { skipped: true };
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

  try {
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

    await createNotificationLog({
      ...meta,
      channel: "SMS",
      status: "SENT",
      destination: to,
      contentPreview: message.slice(0, 240),
      providerResponse: text
    });

    return {
      skipped: false,
      providerResponse: text
    };
  } catch (error) {
    await createNotificationLog({
      ...meta,
      channel: "SMS",
      status: "FAILED",
      destination: to,
      contentPreview: message.slice(0, 240),
      errorMessage: error.message || "Invio SMS fallito"
    });
    throw error;
  }
}

async function sendEmailWithSmtp(technicalSettings, to, subject, text, meta = {}) {
  if (
    !to ||
    !subject ||
    !text ||
    !technicalSettings?.smtpHost ||
    !technicalSettings?.smtpPort ||
    !technicalSettings?.smtpFromEmail
  ) {
    await createNotificationLog({
      ...meta,
      channel: "EMAIL",
      status: "SKIPPED",
      destination: to || null,
      subject: subject || null,
      contentPreview: text ? text.slice(0, 240) : null
    });
    return { skipped: true };
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

  try {
    const result = await transporter.sendMail({
      from: technicalSettings.smtpFromName
        ? `"${technicalSettings.smtpFromName}" <${technicalSettings.smtpFromEmail}>`
        : technicalSettings.smtpFromEmail,
      to,
      subject,
      text
    });

    await createNotificationLog({
      ...meta,
      channel: "EMAIL",
      status: "SENT",
      destination: to,
      subject,
      contentPreview: text.slice(0, 240),
      providerResponse: result?.messageId || null
    });

    return {
      skipped: false,
      providerResponse: result?.messageId || null
    };
  } catch (error) {
    await createNotificationLog({
      ...meta,
      channel: "EMAIL",
      status: "FAILED",
      destination: to,
      subject,
      contentPreview: text.slice(0, 240),
      errorMessage: error.message || "Invio email fallito"
    });
    throw error;
  }
}

export async function sendReservationManageLinkNotification(
  reservation,
  location,
  { skipSms = false, waitlistEntryId = null } = {}
) {
  const token = await ensureReservationManageToken(reservation.id);

  if (!token) {
    return;
  }

  const technicalSettings = location.technicalSettings || {};
  const manageUrl = buildManageUrl(token);
  const context = buildTemplateContext(reservation, location, manageUrl);
  const deliveryMode = technicalSettings.manageLinkDeliveryMode || "SMS";
  const smsTemplate =
    technicalSettings.manageLinkSmsTemplate ||
    "Ciao {{cliente}}, gestisci o cancella la tua prenotazione per {{sede}} qui: {{link_prenotazione}}";
  const emailSubject =
    technicalSettings.manageLinkEmailSubject ||
    "Gestisci la tua prenotazione";
  const emailTemplate =
    technicalSettings.manageLinkEmailTemplate ||
    "Ciao {{cliente}},\n\npuoi modificare o cancellare la tua prenotazione per {{sede}} qui:\n{{link_prenotazione}}\n\nData: {{data}}\nOrario: {{orario}}\nCoperti: {{coperti}}";

  if (!skipSms && (deliveryMode === "SMS" || deliveryMode === "BOTH")) {
    await sendSmsThrough1s2u(
      technicalSettings,
      reservation.guestPhone,
      renderTemplate(smsTemplate, context),
      {
        event: "MANAGE_LINK",
        locationId: location.id,
        reservationId: reservation.id,
        waitlistEntryId
      }
    );
  }

  if (deliveryMode === "EMAIL" || deliveryMode === "BOTH") {
    await sendEmailWithSmtp(
      technicalSettings,
      reservation.guestEmail,
      renderTemplate(emailSubject, context),
      renderTemplate(emailTemplate, context),
      {
        event: "MANAGE_LINK",
        locationId: location.id,
        reservationId: reservation.id,
        waitlistEntryId
      }
    );
  }
}

export async function sendReservationStatusSmsNotification(
  reservation,
  location
) {
  const technicalSettings = location.technicalSettings || {};
  const configuredStatuses = technicalSettings.reservationStatusSmsStatuses || [];

  if (
    !reservation.guestPhone ||
    !configuredStatuses.includes(reservation.status) ||
    !technicalSettings.reservationStatusSmsTemplate
  ) {
    await createNotificationLog({
      locationId: location.id,
      reservationId: reservation.id,
      channel: "SMS",
      status: "SKIPPED",
      event: "RESERVATION_STATUS",
      destination: reservation.guestPhone || null,
      contentPreview: null
    });
    return;
  }

  const token = await ensureReservationManageToken(reservation.id);
  const context = buildTemplateContext(
    reservation,
    location,
    token ? buildManageUrl(token) : ""
  );

  await sendSmsThrough1s2u(
    technicalSettings,
    reservation.guestPhone,
    renderTemplate(technicalSettings.reservationStatusSmsTemplate, context),
    {
      event: "RESERVATION_STATUS",
      locationId: location.id,
      reservationId: reservation.id
    }
  );
}

export async function sendWaitlistConversionNotification(
  reservation,
  location,
  waitlistEntryId = null
) {
  const technicalSettings = location.technicalSettings || {};
  const token = await ensureReservationManageToken(reservation.id);
  const manageUrl = token ? buildManageUrl(token) : "";

  if (technicalSettings.waitlistSmsTemplate && reservation.guestPhone) {
    const context = buildTemplateContext(reservation, location, manageUrl);

    await sendSmsThrough1s2u(
      technicalSettings,
      reservation.guestPhone,
      renderTemplate(technicalSettings.waitlistSmsTemplate, context),
      {
        event: "WAITLIST_CONVERSION",
        locationId: location.id,
        reservationId: reservation.id,
        waitlistEntryId
      }
    );

    await sendReservationManageLinkNotification(reservation, location, {
      skipSms: true,
      waitlistEntryId
    });
    return;
  }

  await sendReservationManageLinkNotification(reservation, location, {
    waitlistEntryId
  });
}
