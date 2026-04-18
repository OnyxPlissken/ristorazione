import Link from "next/link";
import { requireUser } from "../../../lib/auth";
import { summarizeLocationModules } from "../../../lib/location-modules";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import {
  getAccessibleLocationModules,
  getReservationsPageData
} from "../../../lib/queries";
import AdminReservationsPanel from "../../../components/admin-reservations-panel";

export const dynamic = "force-dynamic";

export default async function PrenotazioniPage({ searchParams }) {
  const user = await requireUser();
  requirePageAccess(user, "reservations");
  const canManageReservations = canAccessPage(user, "reservations", "manage");
  const moduleSummary = summarizeLocationModules(await getAccessibleLocationModules(user));

  if (!moduleSummary.has("reservations")) {
    return (
      <div className="page-stack">
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2>Modulo prenotazioni disattivo</h2>
              <p>
                Nessuna sede accessibile ha il modulo prenotazioni online attivo. Riattivalo da Console Admin
                per tornare a gestire lista, slot e calendario prenotazioni.
              </p>
            </div>
            <Link className="button button-primary" href="/admin/console">
              Apri Console Admin
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const reservations = await getReservationsPageData(user);
  const params = await searchParams;
  const reservationId = String(params?.reservationId || "");

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
        initialSelectedReservationId={reservationId}
        reservations={reservations}
      />
    </div>
  );
}
