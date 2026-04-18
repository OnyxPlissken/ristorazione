import { requireUser } from "../../../lib/auth";
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
  const data = await getAnalyticsPageData(user);

  return (
    <div className="page-stack analytics-page">
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Analytics operativa</h2>
            <p>Occupazione, no-show, waitlist e clienti ad alto valore letti in chiave gestionale.</p>
          </div>
          <div className="row-meta">
            <span>Ultimi 90 giorni</span>
            <span>{data.locations.length} sedi</span>
          </div>
        </div>

        <div className="analytics-stat-grid">
          <MetricCard label="Prenotazioni 90g" value={data.stats.reservationsLast90d} />
          <MetricCard label="Completate 90g" value={data.stats.completedLast90d} />
          <MetricCard
            label="No-show 90g"
            value={`${data.stats.noShowLast90d} / ${data.stats.noShowRateLast90d}%`}
          />
          <MetricCard label="In attesa" value={data.stats.pendingReservations} />
          <MetricCard label="Waitlist aperta" value={data.stats.waitlistOpen} />
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
            hint="media per prenotazione"
          />
          <MetricCard label="Clienti fascia A" value={data.stats.highValueCustomers} />
          <MetricCard label="Clienti fascia D" value={data.stats.riskCustomers} />
        </div>
      </section>

      <section className="analytics-grid">
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2>Performance slot</h2>
              <p>Domanda e affidabilita degli orari piu' usati negli ultimi 30 giorni.</p>
            </div>
          </div>

          <div className="analytics-table">
            <div className="analytics-table-head">
              <span>Slot</span>
              <span>Prenotazioni</span>
              <span>Completate</span>
              <span>No-show</span>
            </div>

            {data.slotPerformance.map((slot) => (
              <div className="analytics-table-row" key={slot.label}>
                <strong>{slot.label}</strong>
                <span>{slot.reservations}</span>
                <span>{slot.completed}</span>
                <span>{slot.noShow}</span>
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
              <h2>Top clienti</h2>
              <p>Scoring sintetico per priorita, affidabilita e valore storico.</p>
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
                  </small>
                </div>
                <span className={`customer-band-chip band-${String(customer.band || "B").toLowerCase()}`}>
                  {customer.band}
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
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Confronto sedi</h2>
            <p>Pressione operativa per sede su prenotazioni, attese e no-show.</p>
          </div>
        </div>

        <div className="analytics-table">
          <div className="analytics-table-head analytics-table-head-locations">
            <span>Sede</span>
            <span>Prenotazioni</span>
            <span>In attesa</span>
            <span>No-show</span>
            <span>Waitlist aperta</span>
          </div>

          {data.locations.map((location) => (
            <div className="analytics-table-row analytics-table-row-locations" key={location.id}>
              <strong>{location.name}</strong>
              <span>{location.reservations}</span>
              <span>{location.pending}</span>
              <span>{location.noShow}</span>
              <span>{location.waitlistOpen}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
