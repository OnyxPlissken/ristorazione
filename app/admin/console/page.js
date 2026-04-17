import Link from "next/link";
import { requireUser } from "../../../lib/auth";
import { saveAdminConsoleLocationAction } from "../../../lib/actions/admin-actions";
import { RESERVATION_STATUS_LABELS } from "../../../lib/constants";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import { getAdminConsoleLocations } from "../../../lib/queries";

export const dynamic = "force-dynamic";

const consoleSections = [
  {
    key: "generale",
    label: "Generale",
    description: "Anagrafica, feature attive e recapiti di base."
  },
  {
    key: "comunicazioni",
    label: "Comunicazioni",
    description: "SMS, link cliente, template ed email."
  },
  {
    key: "integrazioni",
    label: "Integrazioni",
    description: "Delivery, Google Business e pagamenti."
  },
  {
    key: "operativita",
    label: "Operativita",
    description: "QR tavoli, riepiloghi e strumenti rapidi."
  }
];

function featureSummary(technical, location) {
  const items = [];

  if (technical.qrEnabled) {
    items.push("QR");
  }
  if (technical.reservationsEnabled ?? location.reservationEnabled) {
    items.push("Prenotazioni");
  }
  if (technical.deliveryEnabled) {
    items.push("Delivery");
  }
  if (technical.paymentsEnabled) {
    items.push("Pagamenti");
  }
  if (technical.googleBusinessEnabled) {
    items.push("Google");
  }
  if (technical.smsEnabled) {
    items.push("SMS");
  }

  return items;
}

function hrefFor(locationId, section) {
  return `/admin/console?locationId=${locationId}&section=${section}`;
}

function OverviewMetric({ label, value }) {
  return (
    <div className="console-overview-cell">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default async function ConsoleAdminPage({ searchParams }) {
  const user = await requireUser();
  requirePageAccess(user, "console");
  const canManageConsole = canAccessPage(user, "console", "manage");
  const locations = await getAdminConsoleLocations();
  const params = await searchParams;
  const locationId = String(params?.locationId || "");
  const requestedSection = String(params?.section || "generale");
  const selectedLocation =
    locations.find((location) => location.id === locationId) || locations[0] || null;
  const selectedSection =
    consoleSections.find((section) => section.key === requestedSection)?.key || "generale";

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
            <p>Seleziona una sede e lavora su una sola configurazione tecnica alla volta.</p>
          </div>
          <div className="row-meta">
            <span>{locations.length} sedi configurabili</span>
            <span>{selectedLocation.name}</span>
          </div>
        </div>

        <div className="location-picker-grid">
          {locations.map((location) => {
            const isActive = location.id === selectedLocation.id;

            return (
              <Link
                className={isActive ? "location-pill active" : "location-pill"}
                href={hrefFor(location.id, selectedSection)}
                key={location.id}
              >
                <strong>{location.name}</strong>
                <span>{location.city}</span>
                <small>{location.technicalSettings?.displayName || location.name}</small>
              </Link>
            );
          })}
        </div>

        <div className="console-overview-strip">
          <OverviewMetric label="Tavoli" value={selectedLocation.tables.length} />
          <OverviewMetric label="Feature attive" value={flags.length} />
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
              <span className="location-chip empty">Nessuna feature attiva</span>
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
              <strong>Provider SMS</strong>
              <span>{technical.smsEnabled ? technical.smsAlias || "1s2u" : "Disattivo"}</span>
            </div>
            <div>
              <strong>Provider pagamento</strong>
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
                href={hrefFor(selectedLocation.id, section.key)}
                key={section.key}
              >
                <strong>{section.label}</strong>
                <span>{section.description}</span>
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
                    <p>Identita della sede, feature operative e recapiti interni.</p>
                  </div>
                </div>

                <div className="console-block-grid console-block-grid-split">
                  <section className="console-block">
                    <div className="console-block-head">
                      <h4>Anagrafica e feature</h4>
                      <p>Nome interno, nome pubblico e attivazioni del locale.</p>
                    </div>

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

                    <div className="console-checkbox-grid">
                      <label className="checkbox-item">
                        <input
                          defaultChecked={Boolean(technical.qrEnabled)}
                          name="qrEnabled"
                          type="checkbox"
                        />
                        <span>Abilita QR tavolo</span>
                      </label>
                      <label className="checkbox-item">
                        <input
                          defaultChecked={
                            technical.reservationsEnabled ?? selectedLocation.reservationEnabled
                          }
                          name="reservationEnabled"
                          type="checkbox"
                        />
                        <span>Abilita prenotazioni</span>
                      </label>
                      <label className="checkbox-item">
                        <input
                          defaultChecked={Boolean(technical.deliveryEnabled)}
                          name="deliveryEnabled"
                          type="checkbox"
                        />
                        <span>Abilita delivery</span>
                      </label>
                      <label className="checkbox-item">
                        <input
                          defaultChecked={Boolean(technical.paymentsEnabled)}
                          name="paymentsEnabled"
                          type="checkbox"
                        />
                        <span>Abilita pagamenti tavolo</span>
                      </label>
                      <label className="checkbox-item">
                        <input
                          defaultChecked={Boolean(technical.googleBusinessEnabled)}
                          name="googleBusinessEnabled"
                          type="checkbox"
                        />
                        <span>Abilita Google Business</span>
                      </label>
                    </div>
                  </section>

                  <section className="console-block">
                    <div className="console-block-head">
                      <h4>Recapiti e note</h4>
                      <p>Canali interni della sede e note tecniche amministrative.</p>
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
                </div>
              </section>

              <section className="console-section-panel" hidden={selectedSection !== "comunicazioni"}>
                <div className="console-section-header">
                  <div>
                    <h3>Comunicazioni</h3>
                    <p>SMS, template stato, link cliente ed email.</p>
                  </div>
                </div>

                <div className="console-block-grid console-block-grid-split">
                  <section className="console-block">
                    <div className="console-block-head">
                      <h4>1s2u SMS</h4>
                      <p>Notifiche prenotazioni e messaggi automatici.</p>
                    </div>

                    <div className="console-checkbox-grid">
                      <label className="checkbox-item">
                        <input
                          defaultChecked={Boolean(technical.smsEnabled)}
                          name="smsEnabled"
                          type="checkbox"
                        />
                        <span>Abilita invio SMS via 1s2u</span>
                      </label>
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

                  <section className="console-block">
                    <div className="console-block-head">
                      <h4>Link cliente ed email</h4>
                      <p>Messaggi gestione prenotazione e configurazione SMTP.</p>
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
                </div>
              </section>

              <section className="console-section-panel" hidden={selectedSection !== "integrazioni"}>
                <div className="console-section-header">
                  <div>
                    <h3>Integrazioni</h3>
                    <p>Partner esterni, pagamenti e sincronizzazioni business.</p>
                  </div>
                </div>

                <div className="console-block-grid console-block-grid-triple">
                  <section className="console-block">
                    <div className="console-block-head">
                      <h4>Delivery</h4>
                      <p>API e webhook per aggregatori o integrazioni proprietarie.</p>
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

                  <section className="console-block">
                    <div className="console-block-head">
                      <h4>Google Business</h4>
                      <p>Campi tecnici per sincronizzare dati della scheda Google.</p>
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

                  <section className="console-block">
                    <div className="console-block-head">
                      <h4>Pagamenti tavolo</h4>
                      <p>Provider, chiavi e URL checkout per il pagamento diretto.</p>
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
                </div>
              </section>

              <section className="console-section-panel" hidden={selectedSection !== "operativita"}>
                <div className="console-section-header">
                  <div>
                    <h3>Operativita</h3>
                    <p>QR tavoli, riepilogo strumenti e riferimenti rapidi.</p>
                  </div>
                </div>

                <div className="console-block-grid console-block-grid-split">
                  <section className="console-block">
                    <div className="console-block-head">
                      <h4>QR tavoli</h4>
                      <p>Link diretti per menu, carrello e pagamento al tavolo.</p>
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

                  <section className="console-block">
                    <div className="console-block-head">
                      <h4>Riepilogo rapido</h4>
                      <p>Stato configurazione e canali principali della sede.</p>
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
                        <strong>Provider SMS</strong>
                        <span>{technical.smsEnabled ? technical.smsAlias || "1s2u" : "Disattivo"}</span>
                      </div>
                      <div>
                        <strong>Provider pagamento</strong>
                        <span>{technical.paymentProvider || "Non configurato"}</span>
                      </div>
                    </div>
                  </section>
                </div>
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
