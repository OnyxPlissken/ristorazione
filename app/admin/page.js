import Link from "next/link";
import { requireUser } from "../../lib/auth";
import { formatDateTime } from "../../lib/format";
import { canAccessPage, requirePageAccess } from "../../lib/permissions";
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

function HandheldModuleCard({ href, label, meta }) {
  return (
    <Link className="handheld-module-card" href={href}>
      <strong>{label}</strong>
      <span>{meta}</span>
    </Link>
  );
}

export default async function AdminHomePage() {
  const user = await requireUser();
  requirePageAccess(user, "dashboard");
  const data = await getAdminDashboardData(user);
  const handheldModules = [
    canAccessPage(user, "reservations")
      ? {
          href: "/admin/prenotazioni",
          label: "Prenotazioni",
          meta: `${data.upcomingReservations.length} arrivi prossimi`
        }
      : null,
    canAccessPage(user, "tables")
      ? {
          href: "/admin/sala",
          label: "Sala",
          meta: `${data.stats.tables} tavoli configurati`
        }
      : null,
    canAccessPage(user, "tables", "manage")
      ? {
          href: "/admin/tavoli?view=layout",
          label: "Planimetria",
          meta: "Drag and drop tavoli e zone"
        }
      : null,
    canAccessPage(user, "menus")
      ? {
          href: "/admin/menu",
          label: "Menu",
          meta: `${data.stats.menus} menu attivi`
        }
      : null
  ].filter(Boolean);

  if (user.rolePermission?.useHandheldMode) {
    return (
      <div className="page-stack handheld-dashboard">
        <section className="panel-card handheld-hero">
          <div className="panel-header">
            <div>
              <h2>Vista palmare</h2>
              <p>Accesso rapido alle funzioni operative del turno.</p>
            </div>
            <div className="row-meta">
              <span>{data.stats.locations} sedi</span>
              <span>{data.upcomingReservations.length} arrivi imminenti</span>
            </div>
          </div>

          <div className="handheld-module-grid">
            {handheldModules.map((module) => (
              <HandheldModuleCard
                href={module.href}
                key={module.href}
                label={module.label}
                meta={module.meta}
              />
            ))}
          </div>
        </section>

        <section className="panel-card">
          <div className="panel-header">
            <h2>Servizio in arrivo</h2>
            <p>Carte rapide ottimizzate per lettura e tap su schermi compatti.</p>
          </div>
          <div className="handheld-reservation-list">
            {data.upcomingReservations.map((reservation) => (
              <Link
                className="handheld-reservation-card"
                href={`/admin/prenotazioni?reservationId=${reservation.id}`}
                key={reservation.id}
              >
                <div>
                  <strong>{reservation.guestName}</strong>
                  <p>
                    {reservation.locationLabel}
                    {reservation.table ? ` / Tavolo ${reservation.table.code}` : " / Da assegnare"}
                  </p>
                </div>
                <div className="row-meta">
                  <span>{reservation.guests} ospiti</span>
                  <strong>{formatDateTime(reservation.dateTime)}</strong>
                </div>
              </Link>
            ))}
            {data.upcomingReservations.length === 0 ? (
              <p className="empty-copy">Nessun arrivo imminente per il turno corrente.</p>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="stats-grid">
        <StatCard label="Sedi accessibili" value={data.stats.locations} />
        <StatCard label="Tavoli configurati" value={data.stats.tables} />
        <StatCard label="Menu attivi" value={data.stats.menus} />
        <StatCard label="Prenotazioni registrate" value={data.stats.reservations} />
        <StatCard label="Sessioni QR aperte" value={data.stats.qrSessions} />
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
                  {reservation.locationLabel}
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
