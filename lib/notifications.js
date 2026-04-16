import nodemailer from "nodemailer";
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

async function sendSmsThrough1s2u(technicalSettings, to, message) {
  if (
    !technicalSettings?.smsEnabled ||
    !technicalSettings.smsUsername ||
    !technicalSettings.smsPassword ||
    !technicalSettings.smsAlias ||
    !to ||
    !message
  ) {
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

async function sendEmailWithSmtp(technicalSettings, to, subject, text) {
  if (
    !to ||
    !subject ||
    !text ||
    !technicalSettings?.smtpHost ||
    !technicalSettings?.smtpPort ||
    !technicalSettings?.smtpFromEmail
  ) {
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

  await transporter.sendMail({
    from: technicalSettings.smtpFromName
      ? `"${technicalSettings.smtpFromName}" <${technicalSettings.smtpFromEmail}>`
      : technicalSettings.smtpFromEmail,
    to,
    subject,
    text
  });

  return {
    skipped: false
  };
}

export async function sendReservationManageLinkNotification(
  reservation,
  location,
  { skipSms = false } = {}
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
      renderTemplate(smsTemplate, context)
    );
  }

  if (deliveryMode === "EMAIL" || deliveryMode === "BOTH") {
    await sendEmailWithSmtp(
      technicalSettings,
      reservation.guestEmail,
      renderTemplate(emailSubject, context),
      renderTemplate(emailTemplate, context)
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
    renderTemplate(technicalSettings.reservationStatusSmsTemplate, context)
  );
}

export async function sendWaitlistConversionNotification(reservation, location) {
  const technicalSettings = location.technicalSettings || {};
  const token = await ensureReservationManageToken(reservation.id);
  const manageUrl = token ? buildManageUrl(token) : "";

  if (technicalSettings.waitlistSmsTemplate && reservation.guestPhone) {
    const context = buildTemplateContext(reservation, location, manageUrl);

    await sendSmsThrough1s2u(
      technicalSettings,
      reservation.guestPhone,
      renderTemplate(technicalSettings.waitlistSmsTemplate, context)
    );

    await sendReservationManageLinkNotification(reservation, location, {
      skipSms: true
    });
    return;
  }

  await sendReservationManageLinkNotification(reservation, location);
}
