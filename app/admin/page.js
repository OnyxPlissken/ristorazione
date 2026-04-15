import { requireUser } from "../../lib/auth";
import { formatDateTime } from "../../lib/format";
import { getAdminDashboardData } from "../../lib/queries";

export const dynamic = "force-dynamic";

function StatCard({ label, value }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default async function AdminHomePage() {
  const user = await requireUser();
  const data = await getAdminDashboardData(user);

  return (
    <div className="page-stack">
      <section className="stats-grid">
        <StatCard label="Sedi accessibili" value={data.stats.locations} />
        <StatCard label="Tavoli configurati" value={data.stats.tables} />
        <StatCard label="Menu attivi" value={data.stats.menus} />
        <StatCard label="Prenotazioni registrate" value={data.stats.reservations} />
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <h2>Prenotazioni imminenti</h2>
          <p>Vista rapida del servizio in arrivo.</p>
        </div>
        <div className="data-list">
          {data.upcomingReservations.map((reservation) => (
            <div className="data-row" key={reservation.id}>
              <div>
                <strong>{reservation.guestName}</strong>
                <p>
                  {reservation.location.name}
                  {reservation.table ? ` / Tavolo ${reservation.table.code}` : " / Da assegnare"}
                </p>
              </div>
              <div className="row-meta">
                <span>{reservation.guests} ospiti</span>
                <strong>{formatDateTime(reservation.dateTime)}</strong>
              </div>
            </div>
          ))}
          {data.upcomingReservations.length === 0 ? (
            <p className="empty-copy">Nessuna prenotazione imminente.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
