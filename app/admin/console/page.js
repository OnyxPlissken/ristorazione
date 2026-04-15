import Link from "next/link";
import { requireRoles } from "../../../lib/auth";
import { saveAdminConsoleLocationAction } from "../../../lib/actions/admin-actions";
import { getAdminConsoleLocations } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function ConsoleAdminPage() {
  await requireRoles(["ADMIN"]);
  const locations = await getAdminConsoleLocations();

  return (
    <div className="page-stack">
      <section className="panel-card">
        <div className="panel-header">
          <h2>Console Admin</h2>
          <p>
            Menu riservato agli amministratori per feature flag, integrazioni esterne,
            rename pubblico del locale e configurazioni tecniche.
          </p>
        </div>
      </section>

      {locations.map((location) => {
        const technical = location.technicalSettings || {};

        return (
          <section className="panel-card" key={location.id}>
            <div className="panel-header">
              <div>
                <h2>{location.name}</h2>
                <p>Configurazioni avanzate per sede, QR, delivery, Google Business e pagamenti.</p>
              </div>
              <div className="row-meta">
                <span>{location.tables.length} tavoli</span>
                <span>{location.city}</span>
              </div>
            </div>

            <form action={saveAdminConsoleLocationAction} className="entity-form">
              <input name="locationId" type="hidden" value={location.id} />

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

              <div className="checkbox-grid">
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
                    defaultChecked={technical.reservationsEnabled ?? location.reservationEnabled}
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

              <div className="form-grid">
                <label className="full-width">
                  <span>Email ricezione prenotazioni</span>
                  <textarea
                    defaultValue={technical.reservationEmails || ""}
                    name="reservationEmails"
                    placeholder="prenotazioni@locale.it, sala@locale.it"
                    rows="2"
                  />
                </label>
              </div>

              <div className="section-stack">
                <div className="section-card">
                  <div className="panel-header">
                    <h2>Delivery</h2>
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

                <div className="section-card">
                  <div className="panel-header">
                    <h2>Google Business</h2>
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
                </div>

                <div className="section-card">
                  <div className="panel-header">
                    <h2>Pagamenti Tavolo</h2>
                    <p>
                      Configurazione tecnica per aprire checkout esterni o provider pay-at-table.
                    </p>
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

                <div className="section-card">
                  <div className="panel-header">
                    <h2>QR Tavoli</h2>
                    <p>Link diretti da trasformare in QR per menu e carrello condiviso del tavolo.</p>
                  </div>
                  <div className="data-list">
                    {location.tables.map((table) => (
                      <div className="data-row" key={table.id}>
                        <div>
                          <strong>{table.code}</strong>
                          <p>{table.zone || "Sala principale"}</p>
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

                <div className="section-card">
                  <div className="panel-header">
                    <h2>Note Tecniche</h2>
                    <p>Appunti operativi per integrazioni, mapping o credenziali da completare.</p>
                  </div>
                  <label>
                    <span>Note</span>
                    <textarea
                      defaultValue={technical.technicalNotes || ""}
                      name="technicalNotes"
                      rows="4"
                    />
                  </label>
                </div>
              </div>

              <button className="button button-primary" type="submit">
                Salva configurazione avanzata
              </button>
            </form>
          </section>
        );
      })}
    </div>
  );
}
