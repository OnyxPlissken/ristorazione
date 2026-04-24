import { requireUser } from "../../../lib/auth";
import { getAccessibleLocationOptions, resolveActiveLocation } from "../../../lib/active-location";
import {
  CUSTOMER_SCORE_BAND_LABELS,
  CUSTOMER_SCORE_BAND_SUMMARY_LABELS,
  customerBandTone
} from "../../../lib/constants";
import { requirePageAccess } from "../../../lib/permissions";
import { getAnalyticsPageData } from "../../../lib/queries";

export const dynamic = "force-dynamic";

function MetricCard({ label, value, hint }) {
  return (
    <article className="analytics-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export default async function AnalyticsPage() {
  const user = await requireUser();
  requirePageAccess(user, "dashboard");
  const locationOptions = await getAccessibleLocationOptions(user);
  const { activeLocation, activeLocationId } = await resolveActiveLocation(user, locationOptions);
  const data = await getAnalyticsPageData(user, { locationId: activeLocationId });

  return (
    <div className="page-stack analytics-page">
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Analytics operativa</h2>
            <p>Misura il valore creato da scoring, waitlist, slot engine, POS e reminder sulla sede attiva.</p>
          </div>
          <div className="row-meta">
            <span>Ultimi 90 giorni</span>
            <span>{activeLocation?.publicName || "Nessuna sede"}</span>
          </div>
        </div>

        <div className="analytics-stat-grid">
          <MetricCard label="Prenotazioni 90g" value={data.stats.reservationsLast90d} />
          <MetricCard label="Completate 90g" value={data.stats.completedLast90d} />
          <MetricCard
            label="No-show 90g"
            value={`${data.stats.noShowLast90d} / ${data.stats.noShowRateLast90d}%`}
          />
          <MetricCard label="No-show evitati 30g" value={data.stats.noShowAvoidedLast30d} />
          <MetricCard label="Coperti recuperati 30g" value={data.stats.recoveredCoversLast30d} />
          <MetricCard
            label="Waitlist convertita 30g"
            value={data.stats.waitlistConvertedLast30d}
          />
          <MetricCard
            label="Scontrino medio"
            value={formatCurrency(data.stats.avgSpend)}
            hint="solo prenotazioni completate"
          />
          <MetricCard
            label="Coperti medi"
            value={data.stats.avgGuests.toFixed(1)}
            hint={`base sala ${data.stats.occupancySeatBase} posti`}
          />
          <MetricCard label="Transazioni POS 90g" value={data.stats.posTransactionsLast90d} />
          <MetricCard label={CUSTOMER_SCORE_BAND_SUMMARY_LABELS.A} value={data.stats.highValueCustomers} />
          <MetricCard label={CUSTOMER_SCORE_BAND_SUMMARY_LABELS.D} value={data.stats.riskCustomers} />
        </div>
      </section>

      <section className="analytics-grid">
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2>Performance slot</h2>
              <p>Domanda, coperti, no-show e resa delle fasce orarie più usate negli ultimi 30 giorni.</p>
            </div>
          </div>

          <div className="analytics-table">
            <div className="analytics-table-head">
              <span>Slot</span>
              <span>Prenotazioni</span>
              <span>Coperti</span>
              <span>Occupazione</span>
              <span>Ricavi</span>
            </div>

            {data.slotPerformance.map((slot) => (
              <div className="analytics-table-row" key={slot.label}>
                <strong>{slot.label}</strong>
                <span>{slot.reservations}</span>
                <span>{slot.covers}</span>
                <span>{slot.occupancyRate}%</span>
                <span>{formatCurrency(slot.revenue)}</span>
              </div>
            ))}

            {data.slotPerformance.length === 0 ? (
              <p className="empty-copy">Ancora nessun dato sufficiente sugli slot recenti.</p>
            ) : null}
          </div>
        </section>

        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2>Ricavo per tavolo</h2>
              <p>Focus sui tavoli che stanno generando più valore negli ultimi 30 giorni.</p>
            </div>
          </div>

          <div className="analytics-table">
            <div className="analytics-table-head">
              <span>Tavolo</span>
              <span>Prenotazioni</span>
              <span>Ricavi</span>
            </div>

            {data.tableRevenue.map((table) => (
              <div className="analytics-table-row" key={table.label}>
                <strong>{table.label}</strong>
                <span>{table.reservations}</span>
                <span>{formatCurrency(table.revenue)}</span>
              </div>
            ))}

            {data.tableRevenue.length === 0 ? (
              <p className="empty-copy">Nessun ricavo agganciato ai tavoli per il periodo selezionato.</p>
            ) : null}
          </div>
        </section>
      </section>

      <section className="analytics-grid">
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2>Top clienti</h2>
              <p>Scoring sintetico per priorità, affidabilità, VIP e valore storico.</p>
            </div>
          </div>

          <div className="analytics-table">
            <div className="analytics-table-head">
              <span>Cliente</span>
              <span>Fascia</span>
              <span>Priority</span>
              <span>Spesa media</span>
            </div>

            {data.topCustomers.map((customer) => (
              <div className="analytics-table-row" key={customer.id}>
                <div className="analytics-customer-cell">
                  <strong>{customer.displayName}</strong>
                  <small>
                    {customer.completedReservations} completate / {customer.noShowCount} no-show
                    {customer.vip ? " / VIP" : ""}
                  </small>
                </div>
                <span className={`customer-band-chip ${customerBandTone(customer.band || "B")}`}>
                  {CUSTOMER_SCORE_BAND_LABELS[customer.band] || customer.band}
                </span>
                <span>{customer.priorityScore}</span>
                <span>{formatCurrency(customer.averageSpend)}</span>
              </div>
            ))}

            {data.topCustomers.length === 0 ? (
              <p className="empty-copy">Nessun profilo cliente ancora consolidato.</p>
            ) : null}
          </div>
        </section>

        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2>Confronto sedi</h2>
              <p>Pressione operativa per sede su prenotazioni, attese, no-show e ricavi.</p>
            </div>
          </div>

          <div className="analytics-table">
            <div className="analytics-table-head analytics-table-head-locations">
              <span>Sede</span>
              <span>Prenotazioni</span>
              <span>In attesa</span>
              <span>No-show</span>
              <span>Ricavi</span>
            </div>

            {data.locations.map((location) => (
              <div className="analytics-table-row analytics-table-row-locations" key={location.id}>
                <strong>{location.name}</strong>
                <span>{location.reservations}</span>
                <span>{location.pending}</span>
                <span>{location.noShow}</span>
                <span>{formatCurrency(location.revenue)}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
