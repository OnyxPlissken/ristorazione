import Link from "next/link";
import { requireUser } from "../../../lib/auth";
import { saveAdminConsoleLocationAction } from "../../../lib/actions/admin-actions";
import { RESERVATION_STATUS_LABELS } from "../../../lib/constants";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import { getAdminConsoleLocations } from "../../../lib/queries";

export const dynamic = "force-dynamic";

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
    items.push("Pagamenti tavolo");
  }
  if (technical.googleBusinessEnabled) {
    items.push("Google Business");
  }
  if (technical.smsEnabled) {
    items.push("SMS");
  }

  return items;
}

export default async function ConsoleAdminPage() {
  const user = await requireUser();
  requirePageAccess(user, "console");
  const canManageConsole = canAccessPage(user, "console", "manage");
  const locations = await getAdminConsoleLocations();

  return (
    <div className="page-stack">
      {!canManageConsole ? (
        <section className="panel-card">
          <div className="panel-header">
            <h2>Accesso in sola lettura</h2>
            <p>
              Puoi consultare la configurazione tecnica, ma solo chi ha permessi di gestione può
              modificarla.
            </p>
          </div>
        </section>
      ) : null}

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Console Admin</h2>
            <p>
              Configurazione tecnica divisa per argomenti: base sede, comunicazioni cliente,
              integrazioni esterne e operatività.
            </p>
          </div>
        </div>

        <div className="permission-role-strip">
          <div className="summary-chip">
            <strong>{locations.length}</strong>
            <span>sedi configurabili</span>
          </div>
          <div className="summary-chip">
            <strong>{locations.reduce((total, location) => total + location.tables.length, 0)}</strong>
            <span>tavoli monitorati</span>
          </div>
          <div className="summary-chip">
            <strong>{locations.filter((location) => location.technicalSettings?.smsEnabled).length}</strong>
            <span>sedi con SMS attivo</span>
          </div>
        </div>
      </section>

      {locations.map((location) => {
        const technical = location.technicalSettings || {};
        const flags = featureSummary(technical, location);

        return (
          <section className="panel-card" key={location.id}>
            <div className="panel-header">
              <div>
                <h2>{location.name}</h2>
                <p>
                  {location.city} · {location.tables.length} tavoli ·{" "}
                  {technical.displayName || location.name}
                </p>
              </div>
              <div className="location-chip-list">
                {flags.length > 0 ? (
                  flags.map((item) => (
                    <span className="location-chip highlighted" key={`${location.id}-${item}`}>
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="location-chip empty">Nessuna feature attiva</span>
                )}
              </div>
            </div>

            <form action={saveAdminConsoleLocationAction} className="entity-form">
              <input name="locationId" type="hidden" value={location.id} />

              <fieldset className="form-fieldset" disabled={!canManageConsole}>
                <div className="console-group">
                  <div className="console-group-header">
                    <div>
                      <h3>Base sede</h3>
                      <p>Identità pubblica, attivazioni principali e recapiti prenotazioni.</p>
                    </div>
                  </div>

                  <div className="console-grid console-grid-main">
                    <div className="section-card console-topic">
                      <div className="panel-header">
                        <div>
                          <h2>Anagrafica e feature</h2>
                          <p>Nome interno, nome pubblico e attivazioni operative della sede.</p>
                        </div>
                      </div>

                      <div className="form-grid">
                        <label>
                          <span>Nome sede interno</span>
                          <input defaultValue={location.name} name="name" type="text" />
                        </label>
                        <label>
                          <span>Nome pubblico locale</span>
                          <input
                            defaultValue={technical.displayName || location.name}
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
                              technical.reservationsEnabled ?? location.reservationEnabled
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
                    </div>

                    <div className="section-card console-topic">
                      <div className="panel-header">
                        <div>
                          <h2>Recapiti prenotazioni</h2>
                          <p>Email operative e note interne usate dalla sede.</p>
                        </div>
                      </div>

                      <label>
                        <span>Email ricezione prenotazioni</span>
                        <textarea
                          defaultValue={technical.reservationEmails || ""}
                          name="reservationEmails"
                          placeholder="prenotazioni@locale.it, sala@locale.it"
                          rows="3"
                        />
                      </label>

                      <label>
                        <span>Note tecniche</span>
                        <textarea
                          defaultValue={technical.technicalNotes || ""}
                          name="technicalNotes"
                          rows="5"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="console-group">
                  <div className="console-group-header">
                    <div>
                      <h3>Comunicazioni cliente</h3>
                      <p>SMS, link cliente e email inviate dal gestionale.</p>
                    </div>
                  </div>

                  <div className="console-grid console-grid-main">
                    <div className="section-card console-topic">
                      <div className="panel-header">
                        <div>
                          <h2>1s2u SMS</h2>
                          <p>Notifiche quando la prenotazione cambia stato o si libera un tavolo.</p>
                        </div>
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
                          <label className="checkbox-item" key={`${location.id}-${value}`}>
                            <input
                              defaultChecked={
                                technical.reservationStatusSmsStatuses?.includes(value)
                              }
                              name="reservationStatusSmsStatuses"
                              type="checkbox"
                              value={value}
                            />
                            <span>Invia SMS su {label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="section-card console-topic">
                      <div className="panel-header">
                        <div>
                          <h2>Link cliente ed email</h2>
                          <p>Messaggi per modifica/cancellazione prenotazione e SMTP opzionale.</p>
                        </div>
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
                              technical.manageLinkEmailSubject ||
                              "Gestisci la tua prenotazione"
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
                    </div>
                  </div>
                </div>

                <div className="console-group">
                  <div className="console-group-header">
                    <div>
                      <h3>Integrazioni esterne</h3>
                      <p>Delivery, Google Business e pagamenti tavolo in una griglia unica.</p>
                    </div>
                  </div>

                  <div className="console-grid console-grid-triple">
                    <div className="section-card console-topic">
                      <div className="panel-header">
                        <div>
                          <h2>Delivery</h2>
                          <p>API e webhook per aggregatori o integrazioni proprietarie.</p>
                        </div>
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
                            placeholder="Chiave API partner"
                            type="text"
                          />
                        </label>
                        <label className="full-width">
                          <span>Webhook secret delivery</span>
                          <input
                            defaultValue={technical.deliveryWebhookSecret || ""}
                            name="deliveryWebhookSecret"
                            placeholder="Segreto webhook"
                            type="text"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="section-card console-topic">
                      <div className="panel-header">
                        <div>
                          <h2>Google Business</h2>
                          <p>Campi tecnici per sincronizzare dati della scheda Google.</p>
                        </div>
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
                    </div>

                    <div className="section-card console-topic">
                      <div className="panel-header">
                        <div>
                          <h2>Pagamenti Tavolo</h2>
                          <p>Provider, chiavi e URL checkout per il pagamento diretto.</p>
                        </div>
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
                    </div>
                  </div>
                </div>

                <div className="console-group">
                  <div className="console-group-header">
                    <div>
                      <h3>Operatività</h3>
                      <p>QR tavoli e riferimenti rapidi per la sede.</p>
                    </div>
                  </div>

                  <div className="console-grid console-grid-main">
                    <div className="section-card console-topic">
                      <div className="panel-header">
                        <div>
                          <h2>QR Tavoli</h2>
                          <p>Link diretti da trasformare in QR per menu e carrello del tavolo.</p>
                        </div>
                      </div>

                      <div className="data-list">
                        {location.tables.map((table) => (
                          <div className="data-row" key={table.id}>
                            <div>
                              <strong>{table.code}</strong>
                              <p>{table.zoneRecord?.name || table.zone || "Sala principale"}</p>
                            </div>
                            <div className="row-meta">
                              <Link href={`/table/${table.id}`}>Apri QR tavolo</Link>
                              <span>/table/{table.id}</span>
                            </div>
                          </div>
                        ))}
                        {location.tables.length === 0 ? (
                          <p className="empty-copy">Nessun tavolo configurato per questa sede.</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="section-card console-topic">
                      <div className="panel-header">
                        <div>
                          <h2>Riepilogo rapido</h2>
                          <p>Stato integrazioni e recapiti principali della sede.</p>
                        </div>
                      </div>

                      <div className="info-list">
                        <div>
                          <strong>Display pubblico</strong>
                          <span>{technical.displayName || location.name}</span>
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
                      </div>
                    </div>
                  </div>
                </div>

                <button className="button button-primary" type="submit">
                  Salva configurazione avanzata
                </button>
              </fieldset>
            </form>
          </section>
        );
      })}
    </div>
  );
}
