import Link from "next/link";
import { resolveActiveLocation } from "../../../lib/active-location";
import { requireUser } from "../../../lib/auth";
import { saveAdminConsoleLocationAction } from "../../../lib/actions/admin-actions";
import {
  LOCATION_MODULE_DEFINITIONS,
  getEnabledLocationModules,
  isLocationModuleEnabled
} from "../../../lib/location-modules";
import { RESERVATION_STATUS_LABELS } from "../../../lib/constants";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import { getAdminConsoleLocations } from "../../../lib/queries";

export const dynamic = "force-dynamic";

const consoleSections = [
  {
    key: "generale",
    label: "Generale",
    description: "Identita sede, moduli attivi e recapiti interni."
  },
  {
    key: "comunicazioni",
    label: "Comunicazioni",
    description: "SMS, link cliente e configurazione email."
  },
  {
    key: "integrazioni",
    label: "Integrazioni",
    description: "Delivery, Google Business e pagamenti."
  },
  {
    key: "operativita",
    label: "Operativita",
    description: "Motore prenotazioni, QR tavoli e riepiloghi."
  }
];

const consolePanels = {
  generale: [
    {
      key: "overview",
      label: "Quadro sede",
      description: "Anagrafica pubblica e stato operativo."
    },
    {
      key: "modules",
      label: "Moduli",
      description: "Attiva o disattiva le funzionalita del prodotto."
    },
    {
      key: "contacts",
      label: "Recapiti",
      description: "Email prenotazioni e note amministrative."
    }
  ],
  comunicazioni: [
    {
      key: "sms",
      label: "SMS",
      description: "Alias, credenziali 1s2u e trigger stato."
    },
    {
      key: "links",
      label: "Link cliente",
      description: "Template e canale di invio del link gestione."
    },
    {
      key: "email",
      label: "SMTP",
      description: "Provider email e mittente transazionale."
    },
    {
      key: "crm",
      label: "Automazioni CRM",
      description: "Reminder per VIP, rischio, no-show e compleanni."
    }
  ],
  integrazioni: [
    {
      key: "delivery",
      label: "Delivery",
      description: "API e webhook aggregatori."
    },
    {
      key: "google",
      label: "Google Business",
      description: "Campi tecnici per sincronizzazioni esterne."
    },
    {
      key: "payments",
      label: "Pagamenti",
      description: "Checkout, chiavi e webhook provider."
    },
    {
      key: "pos",
      label: "POS",
      description: "Ingest transazioni e sincronizzazione spesa reale."
    },
    {
      key: "webhooks",
      label: "Webhook",
      description: "Mirror eventi booking verso sistemi esterni."
    }
  ],
  operativita: [
    {
      key: "engine",
      label: "Motore tavoli",
      description: "Slot, waitlist, scoring e deposito."
    },
    {
      key: "qr",
      label: "QR tavoli",
      description: "Link rapidi per tavoli e planimetria digitale."
    },
    {
      key: "summary",
      label: "Riepilogo",
      description: "Stato finale della configurazione per sede."
    }
  ]
};

function featureSummary(technical, location) {
  return getEnabledLocationModules({
    ...location,
    technicalSettings: technical
  })
    .map((definition) => definition.title);
}

function hrefFor(section, panel) {
  const params = new URLSearchParams();
  params.set("section", section);

  if (panel) {
    params.set("panel", panel);
  }

  return `/admin/console?${params.toString()}`;
}

function OverviewMetric({ label, value }) {
  return (
    <div className="console-overview-cell">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ConsoleModuleCard({
  checked,
  definition,
  disabled,
  location,
  technical
}) {
  const isEnabled = isLocationModuleEnabled(definition.key, technical, location);

  return (
    <label className={isEnabled ? "console-module-card active" : "console-module-card"}>
      <div className="console-module-card-head">
        <div>
          <strong>{definition.title}</strong>
          <p>{definition.description}</p>
        </div>
        <input
          defaultChecked={checked}
          disabled={disabled}
          name={definition.field}
          type="checkbox"
        />
      </div>
      <div className="console-module-card-meta">
        <span className="location-chip">{definition.cluster}</span>
        <small>{isEnabled ? "Attivo" : "Disattivo"}</small>
      </div>
    </label>
  );
}

export default async function ConsoleAdminPage({ searchParams }) {
  const user = await requireUser();
  requirePageAccess(user, "console");
  const canManageConsole = canAccessPage(user, "console", "manage");
  const locations = await getAdminConsoleLocations();
  const params = await searchParams;
  const requestedSection = String(params?.section || "generale");
  const { activeLocation: selectedLocation } = await resolveActiveLocation(user, locations);
  const selectedSection =
    consoleSections.find((section) => section.key === requestedSection)?.key || "generale";
  const availablePanels = consolePanels[selectedSection] || [];
  const requestedPanel = String(params?.panel || availablePanels[0]?.key || "");
  const selectedPanel =
    availablePanels.find((panel) => panel.key === requestedPanel)?.key ||
    availablePanels[0]?.key ||
    "";

  if (!selectedLocation) {
    return (
      <div className="page-stack">
        <section className="panel-card">
          <div className="panel-header">
            <h2>Console Admin</h2>
            <p>Nessuna sede disponibile.</p>
          </div>
        </section>
      </div>
    );
  }

  const technical = selectedLocation.technicalSettings || {};
  const flags = featureSummary(technical, selectedLocation);
  const moduleGroups = LOCATION_MODULE_DEFINITIONS.reduce((groups, definition) => {
    const cluster = definition.cluster;
    if (!groups.has(cluster)) {
      groups.set(cluster, []);
    }
    groups.get(cluster).push(definition);
    return groups;
  }, new Map());

  return (
    <div className="page-stack">
      {!canManageConsole ? (
        <section className="panel-card">
          <div className="panel-header">
            <h2>Accesso in sola lettura</h2>
            <p>Puoi consultare la configurazione tecnica, ma non modificarla.</p>
          </div>
        </section>
      ) : null}

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Console Admin</h2>
            <p>La sede attiva viene scelta una volta sola e qui entri direttamente nella configurazione tecnica.</p>
          </div>
          <div className="row-meta">
            <span>{locations.length} sedi configurabili</span>
            <span>{selectedLocation.name}</span>
          </div>
        </div>

        <div className="console-overview-strip">
          <OverviewMetric label="Tavoli" value={selectedLocation.tables.length} />
          <OverviewMetric label="Moduli attivi" value={flags.length} />
          <OverviewMetric
            label="Canale link cliente"
            value={technical.manageLinkDeliveryMode || "SMS"}
          />
          <OverviewMetric
            label="Provider pagamento"
            value={technical.paymentProvider || "Non configurato"}
          />
        </div>
      </section>

      <section className="panel-card console-workspace-panel">
        <aside className="console-side-rail">
          <div className="console-side-head">
            <h2>{selectedLocation.name}</h2>
            <p>
              {selectedLocation.city} - {selectedLocation.address}
            </p>
          </div>

          <div className="location-chip-list">
            {flags.length > 0 ? (
              flags.map((item) => (
                <span className="location-chip highlighted" key={`${selectedLocation.id}-${item}`}>
                  {item}
                </span>
              ))
            ) : (
              <span className="location-chip empty">Nessun modulo attivo</span>
            )}
          </div>

          <div className="console-side-summary">
            <div>
              <strong>Display pubblico</strong>
              <span>{technical.displayName || selectedLocation.name}</span>
            </div>
            <div>
              <strong>Email prenotazioni</strong>
              <span>{technical.reservationEmails || "Non configurate"}</span>
            </div>
            <div>
              <strong>SMS provider</strong>
              <span>{technical.smsEnabled ? technical.smsAlias || "1s2u" : "Disattivo"}</span>
            </div>
            <div>
              <strong>Pagamenti</strong>
              <span>{technical.paymentProvider || "Non configurato"}</span>
            </div>
          </div>
        </aside>

        <div className="console-main-workspace">
          <div className="admin-section-tabs console-tab-strip">
            {consoleSections.map((section) => (
              <Link
                className={
                  selectedSection === section.key
                    ? "admin-section-tab active"
                    : "admin-section-tab"
                }
                href={hrefFor(section.key, consolePanels[section.key]?.[0]?.key || "")}
                key={section.key}
              >
                <strong>{section.label}</strong>
                <span>{section.description}</span>
              </Link>
            ))}
          </div>

          <div className="console-subnav-strip">
            {availablePanels.map((panel) => (
              <Link
                className={
                  selectedPanel === panel.key
                    ? "console-subnav-pill active"
                    : "console-subnav-pill"
                }
                href={hrefFor(selectedSection, panel.key)}
                key={panel.key}
              >
                <strong>{panel.label}</strong>
                <span>{panel.description}</span>
              </Link>
            ))}
          </div>

          <form action={saveAdminConsoleLocationAction} className="entity-form">
            <input name="locationId" type="hidden" value={selectedLocation.id} />
            <fieldset className="form-fieldset" disabled={!canManageConsole}>
              <section className="console-section-panel" hidden={selectedSection !== "generale"}>
                <div className="console-section-header">
                  <div>
                    <h3>Generale</h3>
                    <p>Base sede, moduli del prodotto e riferimenti interni.</p>
                  </div>
                </div>

                <section className="console-block" hidden={selectedPanel !== "overview"}>
                  <div className="console-block-head">
                    <h4>Quadro sede</h4>
                    <p>Nome interno, nome pubblico e stato sintetico del profilo tecnico.</p>
                  </div>

                  <div className="console-block-grid console-block-grid-split">
                    <div className="console-stack-block">
                      <div className="form-grid">
                        <label>
                          <span>Nome sede interno</span>
                          <input defaultValue={selectedLocation.name} name="name" type="text" />
                        </label>
                        <label>
                          <span>Nome pubblico locale</span>
                          <input
                            defaultValue={technical.displayName || selectedLocation.name}
                            name="displayName"
                            type="text"
                          />
                        </label>
                      </div>

                      <div className="console-overview-grid">
                        <OverviewMetric label="Sede" value={selectedLocation.city} />
                        <OverviewMetric label="Tavoli" value={selectedLocation.tables.length} />
                        <OverviewMetric label="Moduli attivi" value={flags.length} />
                        <OverviewMetric
                          label="Booking"
                          value={
                            technical.reservationsEnabled ?? selectedLocation.reservationEnabled
                              ? "Attivo"
                              : "Disattivo"
                          }
                        />
                      </div>
                    </div>

                    <div className="console-stack-block">
                      <div className="note-box">
                        <strong>Profilo operativo</strong>
                        <p>
                          Usa la sezione <strong>Moduli</strong> per attivare o disattivare funzioni come
                          prenotazioni, QR tavolo, scoring CRM, waitlist smart, delivery,
                          pagamenti e Google Business.
                        </p>
                      </div>

                      <div className="location-chip-list">
                        {flags.length > 0 ? (
                          flags.map((flag) => (
                            <span className="location-chip highlighted" key={`${selectedLocation.id}-overview-${flag}`}>
                              {flag}
                            </span>
                          ))
                        ) : (
                          <span className="location-chip empty">Nessun modulo attivo</span>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="console-block" hidden={selectedPanel !== "modules"}>
                  <div className="console-block-head">
                    <h4>Moduli attivabili</h4>
                    <p>Ogni funzione opzionale della sede viene gestita come modulo tecnico.</p>
                  </div>

                  {[...moduleGroups.entries()].map(([cluster, definitions]) => (
                    <div className="console-module-group" key={`${selectedLocation.id}-${cluster}`}>
                      <div className="console-module-group-head">
                        <h5>{cluster}</h5>
                        <p>Moduli coerenti per lo stesso ambito operativo.</p>
                      </div>

                      <div className="console-module-grid">
                        {definitions.map((definition) => (
                          <ConsoleModuleCard
                            checked={isLocationModuleEnabled(
                              definition.key,
                              technical,
                              selectedLocation
                            )}
                            definition={definition}
                            disabled={!canManageConsole}
                            key={definition.field}
                            location={selectedLocation}
                            technical={technical}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="console-inline-setting">
                    <label>
                      <span>Deposito consigliato (EUR)</span>
                      <input
                        defaultValue={technical.adaptiveDepositAmount || ""}
                        min="0"
                        name="adaptiveDepositAmount"
                        step="0.01"
                        type="number"
                      />
                    </label>
                    <p className="helper-copy">
                      Viene applicato solo se il modulo <strong>Deposito adattivo</strong> e' attivo.
                    </p>
                  </div>
                </section>

                <section className="console-block" hidden={selectedPanel !== "contacts"}>
                  <div className="console-block-head">
                    <h4>Recapiti e note</h4>
                    <p>Canali interni usati dal team booking e note tecniche amministrative.</p>
                  </div>

                  <label>
                    <span>Email ricezione prenotazioni</span>
                    <textarea
                      defaultValue={technical.reservationEmails || ""}
                      name="reservationEmails"
                      placeholder="prenotazioni@locale.it, sala@locale.it"
                      rows="4"
                    />
                  </label>

                  <label>
                    <span>Note tecniche</span>
                    <textarea
                      defaultValue={technical.technicalNotes || ""}
                      name="technicalNotes"
                      rows="6"
                    />
                  </label>
                </section>
              </section>

              <section className="console-section-panel" hidden={selectedSection !== "comunicazioni"}>
                <div className="console-section-header">
                  <div>
                    <h3>Comunicazioni</h3>
                    <p>Trigger SMS, link cliente e configurazione email transazionale.</p>
                  </div>
                </div>

                <section className="console-block" hidden={selectedPanel !== "sms"}>
                  <div className="console-block-head">
                    <h4>1s2u SMS</h4>
                    <p>Provider, alias e momenti in cui inviare messaggi al cliente.</p>
                  </div>

                  <div className="form-grid">
                    <label>
                      <span>Alias mittente</span>
                      <input
                        defaultValue={technical.smsAlias || ""}
                        name="smsAlias"
                        placeholder="COPERTO"
                        type="text"
                      />
                    </label>
                    <label>
                      <span>Username API</span>
                      <input
                        defaultValue={technical.smsUsername || ""}
                        name="smsUsername"
                        type="text"
                      />
                    </label>
                    <label className="full-width">
                      <span>Password API</span>
                      <input
                        defaultValue={technical.smsPassword || ""}
                        name="smsPassword"
                        type="text"
                      />
                    </label>
                    <label className="full-width">
                      <span>Template SMS cambio stato</span>
                      <textarea
                        defaultValue={
                          technical.reservationStatusSmsTemplate ||
                          "Ciao {{cliente}}, la tua prenotazione da {{sede}} e' ora {{stato}} per {{data}} alle {{orario}}. Gestiscila qui: {{link_prenotazione}}"
                        }
                        name="reservationStatusSmsTemplate"
                        rows="4"
                      />
                    </label>
                    <label className="full-width">
                      <span>Template SMS liberazione tavolo da coda</span>
                      <textarea
                        defaultValue={
                          technical.waitlistSmsTemplate ||
                          "Ciao {{cliente}}, si e' liberato un tavolo da {{sede}} per {{data}} alle {{orario}}. Gestisci la prenotazione qui: {{link_prenotazione}}"
                        }
                        name="waitlistSmsTemplate"
                        rows="4"
                      />
                    </label>
                  </div>

                  <div className="console-checkbox-grid">
                    {Object.entries(RESERVATION_STATUS_LABELS).map(([value, label]) => (
                      <label className="checkbox-item" key={`${selectedLocation.id}-${value}`}>
                        <input
                          defaultChecked={technical.reservationStatusSmsStatuses?.includes(value)}
                          name="reservationStatusSmsStatuses"
                          type="checkbox"
                          value={value}
                        />
                        <span>Invia SMS su {label}</span>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="console-block" hidden={selectedPanel !== "links"}>
                  <div className="console-block-head">
                    <h4>Link cliente</h4>
                    <p>Canale preferito e template usati per modificare o cancellare la prenotazione.</p>
                  </div>

                  <div className="form-grid">
                    <label>
                      <span>Canale invio link</span>
                      <select
                        defaultValue={technical.manageLinkDeliveryMode || "SMS"}
                        name="manageLinkDeliveryMode"
                      >
                        <option value="SMS">Solo SMS</option>
                        <option value="EMAIL">Solo email</option>
                        <option value="BOTH">SMS + email</option>
                      </select>
                    </label>
                    <label className="full-width">
                      <span>Template SMS link prenotazione</span>
                      <textarea
                        defaultValue={
                          technical.manageLinkSmsTemplate ||
                          "Ciao {{cliente}}, modifica o cancella la tua prenotazione per {{sede}} qui: {{link_prenotazione}}"
                        }
                        name="manageLinkSmsTemplate"
                        rows="4"
                      />
                    </label>
                    <label>
                      <span>Oggetto email link prenotazione</span>
                      <input
                        defaultValue={
                          technical.manageLinkEmailSubject || "Gestisci la tua prenotazione"
                        }
                        name="manageLinkEmailSubject"
                        type="text"
                      />
                    </label>
                    <label className="full-width">
                      <span>Corpo email link prenotazione</span>
                      <textarea
                        defaultValue={
                          technical.manageLinkEmailTemplate ||
                          "Ciao {{cliente}},\n\npuoi gestire la tua prenotazione per {{sede}} qui:\n{{link_prenotazione}}\n\nData: {{data}}\nOrario: {{orario}}\nCoperti: {{coperti}}"
                        }
                        name="manageLinkEmailTemplate"
                        rows="6"
                      />
                    </label>
                  </div>
                </section>

                <section className="console-block" hidden={selectedPanel !== "email"}>
                  <div className="console-block-head">
                    <h4>SMTP</h4>
                    <p>Provider email, credenziali e mittente usato nelle comunicazioni cliente.</p>
                  </div>

                  <div className="console-grid console-grid-compact">
                    <label>
                      <span>SMTP host</span>
                      <input
                        defaultValue={technical.smtpHost || ""}
                        name="smtpHost"
                        placeholder="smtp.provider.it"
                        type="text"
                      />
                    </label>
                    <label>
                      <span>SMTP port</span>
                      <input
                        defaultValue={technical.smtpPort || 587}
                        name="smtpPort"
                        type="number"
                      />
                    </label>
                    <label className="checkbox-item">
                      <input
                        defaultChecked={Boolean(technical.smtpSecure)}
                        name="smtpSecure"
                        type="checkbox"
                      />
                      <span>Connessione sicura</span>
                    </label>
                    <label>
                      <span>SMTP username</span>
                      <input
                        defaultValue={technical.smtpUsername || ""}
                        name="smtpUsername"
                        type="text"
                      />
                    </label>
                    <label>
                      <span>SMTP password</span>
                      <input
                        defaultValue={technical.smtpPassword || ""}
                        name="smtpPassword"
                        type="text"
                      />
                    </label>
                    <label>
                      <span>Nome mittente</span>
                      <input
                        defaultValue={technical.smtpFromName || ""}
                        name="smtpFromName"
                        type="text"
                      />
                    </label>
                    <label className="full-width">
                      <span>Email mittente</span>
                      <input
                        defaultValue={technical.smtpFromEmail || ""}
                        name="smtpFromEmail"
                        type="email"
                      />
                    </label>
                  </div>
                </section>

                <section className="console-block" hidden={selectedPanel !== "crm"}>
                  <div className="console-block-head">
                    <h4>Reminder CRM e compleanni</h4>
                    <p>Messaggi differenziati per VIP, rischio, storico no-show e compleanni.</p>
                  </div>

                  <div className="form-grid">
                    <label>
                      <span>Ore anticipo reminder</span>
                      <input
                        defaultValue={technical.crmReminderLeadHours || 24}
                        min="1"
                        name="crmReminderLeadHours"
                        type="number"
                      />
                    </label>
                    <label className="checkbox-item">
                      <input
                        defaultChecked={Boolean(technical.crmVipReminderEnabled)}
                        name="crmVipReminderEnabled"
                        type="checkbox"
                      />
                      <span>Reminder VIP dedicato</span>
                    </label>
                    <label className="full-width">
                      <span>Template VIP</span>
                      <textarea
                        defaultValue={
                          technical.crmVipReminderTemplate ||
                          "Ciao {{cliente}}, il tuo tavolo da {{sede}} ti aspetta il {{data}} alle {{orario}}. Link: {{link_prenotazione}}"
                        }
                        name="crmVipReminderTemplate"
                        rows="4"
                      />
                    </label>
                    <label className="checkbox-item">
                      <input
                        defaultChecked={Boolean(technical.crmRiskReminderEnabled)}
                        name="crmRiskReminderEnabled"
                        type="checkbox"
                      />
                      <span>Reminder clienti a rischio</span>
                    </label>
                    <label className="full-width">
                      <span>Template rischio</span>
                      <textarea
                        defaultValue={
                          technical.crmRiskReminderTemplate ||
                          "Ciao {{cliente}}, ricordati la prenotazione da {{sede}} per {{data}} alle {{orario}}. Gestiscila qui: {{link_prenotazione}}"
                        }
                        name="crmRiskReminderTemplate"
                        rows="4"
                      />
                    </label>
                    <label className="checkbox-item">
                      <input
                        defaultChecked={Boolean(technical.crmNoShowReminderEnabled)}
                        name="crmNoShowReminderEnabled"
                        type="checkbox"
                      />
                      <span>Reminder storico no-show</span>
                    </label>
                    <label className="full-width">
                      <span>Template no-show</span>
                      <textarea
                        defaultValue={
                          technical.crmNoShowReminderTemplate ||
                          "Ciao {{cliente}}, conferma la tua presenza per {{data}} alle {{orario}} da {{sede}}. Link: {{link_prenotazione}}"
                        }
                        name="crmNoShowReminderTemplate"
                        rows="4"
                      />
                    </label>
                    <label className="checkbox-item">
                      <input
                        defaultChecked={Boolean(technical.crmBirthdayEnabled)}
                        name="crmBirthdayEnabled"
                        type="checkbox"
                      />
                      <span>Messaggio compleanno</span>
                    </label>
                    <label className="full-width">
                      <span>Template compleanno</span>
                      <textarea
                        defaultValue={
                          technical.crmBirthdayTemplate ||
                          "Buon compleanno {{cliente}} da {{sede}}. Ti aspettiamo presto."
                        }
                        name="crmBirthdayTemplate"
                        rows="4"
                      />
                    </label>
                  </div>
                </section>
              </section>

              <section className="console-section-panel" hidden={selectedSection !== "integrazioni"}>
                <div className="console-section-header">
                  <div>
                    <h3>Integrazioni</h3>
                    <p>Provider esterni e canali opzionali agganciati alla sede.</p>
                  </div>
                </div>

                <section className="console-block" hidden={selectedPanel !== "delivery"}>
                  <div className="console-block-head">
                    <h4>Delivery</h4>
                    <p>Aggregatori esterni, webhook e configurazione API proprietaria.</p>
                  </div>

                  <div className="form-grid">
                    <label>
                      <span>Provider delivery</span>
                      <input
                        defaultValue={technical.deliveryProvider || ""}
                        name="deliveryProvider"
                        placeholder="Glovo / Deliveroo / Uber Eats / Custom"
                        type="text"
                      />
                    </label>
                    <label>
                      <span>Base URL API delivery</span>
                      <input
                        defaultValue={technical.deliveryApiBaseUrl || ""}
                        name="deliveryApiBaseUrl"
                        placeholder="https://api.partner.com"
                        type="text"
                      />
                    </label>
                    <label className="full-width">
                      <span>API key delivery</span>
                      <input
                        defaultValue={technical.deliveryApiKey || ""}
                        name="deliveryApiKey"
                        type="text"
                      />
                    </label>
                    <label className="full-width">
                      <span>Webhook secret delivery</span>
                      <input
                        defaultValue={technical.deliveryWebhookSecret || ""}
                        name="deliveryWebhookSecret"
                        type="text"
                      />
                    </label>
                  </div>
                </section>

                <section className="console-block" hidden={selectedPanel !== "google"}>
                  <div className="console-block-head">
                    <h4>Google Business</h4>
                    <p>Dati tecnici usati per allineare la scheda locale e le informazioni pubbliche.</p>
                  </div>

                  <div className="form-grid">
                    <label>
                      <span>Google Place ID</span>
                      <input
                        defaultValue={technical.googleBusinessPlaceId || ""}
                        name="googleBusinessPlaceId"
                        type="text"
                      />
                    </label>
                    <label>
                      <span>Google account ID</span>
                      <input
                        defaultValue={technical.googleBusinessAccountId || ""}
                        name="googleBusinessAccountId"
                        type="text"
                      />
                    </label>
                    <label>
                      <span>Google location ID</span>
                      <input
                        defaultValue={technical.googleBusinessLocationId || ""}
                        name="googleBusinessLocationId"
                        type="text"
                      />
                    </label>
                    <label>
                      <span>Google Business API key</span>
                      <input
                        defaultValue={technical.googleBusinessApiKey || ""}
                        name="googleBusinessApiKey"
                        type="text"
                      />
                    </label>
                  </div>
                </section>

                <section className="console-block" hidden={selectedPanel !== "payments"}>
                  <div className="console-block-head">
                    <h4>Pagamenti tavolo</h4>
                    <p>Provider, chiavi, webhook e checkout per tavolo e depositi prenotazione.</p>
                  </div>

                  <div className="form-grid">
                    <label>
                      <span>Provider pagamenti</span>
                      <input
                        defaultValue={technical.paymentProvider || ""}
                        name="paymentProvider"
                        placeholder="Stripe / Nexi / Satispay / Custom"
                        type="text"
                      />
                    </label>
                    <label>
                      <span>Checkout base URL</span>
                      <input
                        defaultValue={technical.paymentCheckoutBaseUrl || ""}
                        name="paymentCheckoutBaseUrl"
                        placeholder="https://pay.partner.com/checkout"
                        type="text"
                      />
                    </label>
                    <label className="full-width">
                      <span>Public key provider</span>
                      <input
                        defaultValue={technical.paymentPublicKey || ""}
                        name="paymentPublicKey"
                        type="text"
                      />
                    </label>
                    <label className="full-width">
                      <span>API key provider</span>
                      <input
                        defaultValue={technical.paymentApiKey || ""}
                        name="paymentApiKey"
                        type="text"
                      />
                    </label>
                    <label className="full-width">
                      <span>Webhook secret pagamenti</span>
                      <input
                        defaultValue={technical.paymentWebhookSecret || ""}
                        name="paymentWebhookSecret"
                        type="text"
                      />
                    </label>
                  </div>
                </section>

                <section className="console-block" hidden={selectedPanel !== "pos"}>
                  <div className="console-block-head">
                    <h4>POS e scontrini</h4>
                    <p>Endpoint, provider e secret per importare scontrini reali e consolidare il CRM.</p>
                  </div>

                  <div className="form-grid">
                    <label className="checkbox-item">
                      <input
                        defaultChecked={Boolean(technical.posEnabled)}
                        name="posEnabled"
                        type="checkbox"
                      />
                      <span>Integrazione POS attiva</span>
                    </label>
                    <label>
                      <span>Provider POS</span>
                      <input
                        defaultValue={technical.posProvider || ""}
                        name="posProvider"
                        placeholder="Custom / Lightspeed / Cassa in cloud"
                        type="text"
                      />
                    </label>
                    <label>
                      <span>Base URL POS</span>
                      <input
                        defaultValue={technical.posApiBaseUrl || ""}
                        name="posApiBaseUrl"
                        placeholder="https://pos.partner.com/api"
                        type="text"
                      />
                    </label>
                    <label className="full-width">
                      <span>API key POS</span>
                      <input
                        defaultValue={technical.posApiKey || ""}
                        name="posApiKey"
                        type="text"
                      />
                    </label>
                    <label className="full-width">
                      <span>Webhook secret POS</span>
                      <input
                        defaultValue={technical.posWebhookSecret || ""}
                        name="posWebhookSecret"
                        type="text"
                      />
                    </label>
                  </div>

                  <div className="note-box">
                    <strong>Endpoint ingest</strong>
                    <p>/api/integrations/pos</p>
                  </div>
                </section>

                <section className="console-block" hidden={selectedPanel !== "webhooks"}>
                  <div className="console-block-head">
                    <h4>Webhook eventi</h4>
                    <p>Mirror verso sistemi esterni di booking, pagamento, waitlist e reminder.</p>
                  </div>

                  <div className="form-grid">
                    <label className="checkbox-item">
                      <input
                        defaultChecked={Boolean(technical.notificationWebhookEnabled)}
                        name="notificationWebhookEnabled"
                        type="checkbox"
                      />
                      <span>Webhook mirror attivo</span>
                    </label>
                    <label className="full-width">
                      <span>Webhook URL</span>
                      <input
                        defaultValue={technical.notificationWebhookUrl || ""}
                        name="notificationWebhookUrl"
                        placeholder="https://erp.partner.com/webhooks/coperto"
                        type="text"
                      />
                    </label>
                    <label className="full-width">
                      <span>Webhook secret</span>
                      <input
                        defaultValue={technical.notificationWebhookSecret || ""}
                        name="notificationWebhookSecret"
                        type="text"
                      />
                    </label>
                  </div>
                </section>
              </section>

              <section className="console-section-panel" hidden={selectedSection !== "operativita"}>
                <div className="console-section-header">
                  <div>
                    <h3>Operativita</h3>
                    <p>Motore prenotazioni, QR tavoli e riepilogo della sede.</p>
                  </div>
                </div>

                <section className="console-block" hidden={selectedPanel !== "engine"}>
                  <div className="console-block-head">
                    <h4>Motore tavoli e booking</h4>
                    <p>Stato dei moduli che impattano occupazione, scoring e recupero domanda.</p>
                  </div>

                  <div className="console-side-summary">
                    <div>
                      <strong>Ottimizzazione slot</strong>
                      <span>{technical.slotOptimizationEnabled !== false ? "Attiva" : "Disattiva"}</span>
                    </div>
                    <div>
                      <strong>Waitlist intelligente</strong>
                      <span>{technical.smartWaitlistEnabled !== false ? "Attiva" : "Disattiva"}</span>
                    </div>
                    <div>
                      <strong>CRM scoring</strong>
                      <span>{technical.customerScoringEnabled !== false ? "Attivo" : "Disattivo"}</span>
                    </div>
                    <div>
                      <strong>Deposito adattivo</strong>
                      <span>
                        {technical.adaptiveDepositEnabled
                          ? technical.adaptiveDepositAmount
                            ? `EUR ${Number(technical.adaptiveDepositAmount).toFixed(2)}`
                            : "Attivo senza importo"
                          : "Disattivo"}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="console-block" hidden={selectedPanel !== "qr"}>
                  <div className="console-block-head">
                    <h4>QR tavoli</h4>
                    <p>Link diretti ai tavoli attivi della sede per menu, carrello e pagamenti.</p>
                  </div>

                  <div className="console-table-list">
                    <div className="console-table-head">
                      <span>Tavolo</span>
                      <span>Zona</span>
                      <span>Link</span>
                    </div>

                    {selectedLocation.tables.map((table) => (
                      <div className="console-table-row" key={table.id}>
                        <strong>{table.code}</strong>
                        <span>{table.zoneRecord?.name || table.zone || "Sala principale"}</span>
                        <Link href={`/table/${table.id}`}>/table/{table.id}</Link>
                      </div>
                    ))}

                    {selectedLocation.tables.length === 0 ? (
                      <p className="empty-copy">Nessun tavolo configurato per questa sede.</p>
                    ) : null}
                  </div>
                </section>

                <section className="console-block" hidden={selectedPanel !== "summary"}>
                  <div className="console-block-head">
                    <h4>Riepilogo rapido</h4>
                    <p>Vista finale della configurazione tecnica, pronta per il team operativo.</p>
                  </div>

                  <div className="console-side-summary">
                    <div>
                      <strong>Display pubblico</strong>
                      <span>{technical.displayName || selectedLocation.name}</span>
                    </div>
                    <div>
                      <strong>Recapiti prenotazioni</strong>
                      <span>{technical.reservationEmails || "Non configurati"}</span>
                    </div>
                    <div>
                      <strong>Canale link cliente</strong>
                      <span>{technical.manageLinkDeliveryMode || "SMS"}</span>
                    </div>
                    <div>
                      <strong>SMS provider</strong>
                      <span>{technical.smsEnabled ? technical.smsAlias || "1s2u" : "Disattivo"}</span>
                    </div>
                    <div>
                      <strong>Provider pagamento</strong>
                      <span>{technical.paymentProvider || "Non configurato"}</span>
                    </div>
                  </div>
                </section>
              </section>

              <div className="section-submit-bar">
                <button className="button button-primary" type="submit">
                  Salva configurazione avanzata
                </button>
              </div>
            </fieldset>
          </form>
        </div>
      </section>
    </div>
  );
}
