import AdminFloorServiceBoard from "../../../components/admin-floor-service-board";
import { requireUser } from "../../../lib/auth";
import { getDateKey } from "../../../lib/reservations";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import { getFloorPageData } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function SalaPage({ searchParams }) {
  const user = await requireUser();
  requirePageAccess(user, "tables");
  const canManageTables = canAccessPage(user, "tables", "manage");
  const canManageReservations = canAccessPage(user, "reservations", "manage");
  const params = await searchParams;
  const locationId = String(params?.locationId || "");
  const dateText = String(params?.date || getDateKey(new Date()));
  const data = await getFloorPageData(user, {
    locationId,
    dateText
  });

  return (
    <div className="page-stack">
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Sala operativa</h2>
            <p>Seleziona sede e data, poi lavora sulla planimetria live del servizio.</p>
          </div>
          <div className="row-meta">
            <span>{data.selectedLocation ? data.selectedLocation.name : "Nessuna sede"}</span>
            <span>{dateText}</span>
          </div>
        </div>

        <form className="reservation-toolbar">
          <div className="form-grid">
            <label>
              <span>Sede</span>
              <select defaultValue={data.selectedLocation?.id || ""} name="locationId">
                {data.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} - {location.city}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Data</span>
              <input defaultValue={dateText} name="date" type="date" />
            </label>
          </div>
          <button className="button button-primary" type="submit">
            Aggiorna vista sala
          </button>
        </form>
      </section>

      {data.selectedLocation ? (
        <AdminFloorServiceBoard
          canManageReservations={canManageReservations}
          canManageTables={canManageTables}
          location={data.selectedLocation}
          reservations={data.reservations}
          selectedDate={dateText}
          zones={data.zones}
        />
      ) : (
        <section className="panel-card">
          <p className="empty-copy">Nessuna sede accessibile disponibile.</p>
        </section>
      )}
    </div>
  );
}
