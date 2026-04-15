import { requireUser } from "../../../lib/auth";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import { getReservationsPageData } from "../../../lib/queries";
import AdminReservationsPanel from "../../../components/admin-reservations-panel";

export const dynamic = "force-dynamic";

export default async function PrenotazioniPage() {
  const user = await requireUser();
  requirePageAccess(user, "reservations");
  const canManageReservations = canAccessPage(user, "reservations", "manage");
  const reservations = await getReservationsPageData(user);

  return (
    <div className="page-stack">
      {!canManageReservations ? (
        <section className="panel-card">
          <div className="panel-header">
            <h2>Accesso in sola lettura</h2>
            <p>Puoi consultare le prenotazioni ma non cambiarne stato o assegnazione tavolo.</p>
          </div>
        </section>
      ) : null}

      <AdminReservationsPanel
        canManageReservations={canManageReservations}
        reservations={reservations}
      />
    </div>
  );
}
