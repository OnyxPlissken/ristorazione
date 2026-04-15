import { AdminDialog } from "../../../components/admin-dialog";
import { saveUserAction } from "../../../lib/actions/admin-actions";
import { requireUser, roleLabel } from "../../../lib/auth";
import { ROLE_LABELS } from "../../../lib/constants";
import { naturalCompare } from "../../../lib/format";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import { getAccessibleLocations, getUsersWithLocations } from "../../../lib/queries";

export const dynamic = "force-dynamic";

function sortLocations(locations) {
  return [...locations].sort(
    (left, right) =>
      naturalCompare(left.name, right.name) || naturalCompare(left.city || "", right.city || "")
  );
}

function getAssignedLocations(item) {
  return item.locationAccess.map((assignment) => assignment.location.name);
}

function isGlobalRole(role) {
  return role === "ADMIN" || role === "PROPRIETARIO";
}

function renderLocationSelection(locations, selectedIds = []) {
  return (
    <div className="checkbox-group">
      <span>Sedi assegnate</span>
      <p className="helper-copy">
        Seleziona le sedi operative per questo utente. Per Admin e Proprietario l&apos;accesso
        resta comunque globale.
      </p>
      <div className="checkbox-grid">
        {locations.map((location) => (
          <label className="checkbox-item" key={location.id}>
            <input
              defaultChecked={selectedIds.includes(location.id)}
              name="locationIds"
              type="checkbox"
              value={location.id}
            />
            <span>
              {location.name}
              {location.city ? ` - ${location.city}` : ""}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default async function UtentiPage() {
  const user = await requireUser();
  requirePageAccess(user, "users");
  const canManageUsers = canAccessPage(user, "users", "manage");
  const [users, rawLocations] = await Promise.all([
    getUsersWithLocations(),
    getAccessibleLocations(user)
  ]);

  const locations = sortLocations(rawLocations);
  const activeUsers = users.filter((item) => item.active).length;
  const scopedUsers = users.filter((item) => !isGlobalRole(item.role)).length;

  return (
    <div className="page-stack">
      {!canManageUsers ? (
        <section className="panel-card">
          <div className="panel-header">
            <h2>Accesso in sola lettura</h2>
            <p>Puoi consultare gli utenti ma non crearli o modificarli.</p>
          </div>
        </section>
      ) : null}

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Gestione utenti</h2>
            <p>
              Vista a lista per controllare rapidamente ruolo, stato e sedi assegnate a ogni utenza.
            </p>
          </div>
          {canManageUsers ? (
            <AdminDialog
              buttonClassName="button button-primary"
              buttonLabel="Nuovo utente"
              description="Crea un nuovo accesso e assegna subito le sedi operative."
              title="Crea nuovo utente"
            >
              <form action={saveUserAction} className="entity-form">
                <div className="form-grid">
                  <label>
                    <span>Nome</span>
                    <input name="name" required type="text" />
                  </label>
                  <label>
                    <span>Email</span>
                    <input name="email" required type="email" />
                  </label>
                  <label>
                    <span>Password iniziale</span>
                    <input name="password" required type="password" />
                  </label>
                  <label>
                    <span>Ruolo</span>
                    <select defaultValue="STAFF" name="role">
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {renderLocationSelection(locations)}

                <label className="checkbox-item">
                  <input defaultChecked name="active" type="checkbox" />
                  <span>Utente attivo</span>
                </label>

                <button className="button button-primary" type="submit">
                  Salva utente
                </button>
              </form>
            </AdminDialog>
          ) : null}
        </div>

        <div className="zone-summary-grid">
          <article className="summary-chip">
            <strong>Utenti totali</strong>
            <span>{users.length} account configurati</span>
          </article>
          <article className="summary-chip">
            <strong>Utenti attivi</strong>
            <span>{activeUsers} utenti attivi</span>
          </article>
          <article className="summary-chip">
            <strong>Utenti con sedi dedicate</strong>
            <span>{scopedUsers} account operativi per sede</span>
          </article>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Lista utenti</h2>
            <p>Per ogni utente puoi vedere subito ruolo, sedi assegnate e stato operativo.</p>
          </div>
          <div className="row-meta">
            <span>{locations.length} sedi selezionabili</span>
            <span>{users.length} utenti in elenco</span>
          </div>
        </div>

        <div className="user-list">
          <div className="user-list-head">
            <span>Utente</span>
            <span>Ruolo</span>
            <span>Sedi assegnate</span>
            <span>Stato</span>
            <span>Azioni</span>
          </div>

          {users.map((item) => {
            const assignedLocations = getAssignedLocations(item);
            const selectedLocationIds = item.locationAccess.map((assignment) => assignment.locationId);

            return (
              <article className="user-list-row" key={item.id}>
                <div className="user-cell user-primary">
                  <span className="user-cell-label">Utente</span>
                  <strong>{item.name}</strong>
                  <p>{item.email}</p>
                </div>

                <div className="user-cell user-role-cell">
                  <span className="user-cell-label">Ruolo</span>
                  <span className="user-tag">{roleLabel(item.role)}</span>
                </div>

                <div className="user-cell">
                  <span className="user-cell-label">Sedi assegnate</span>
                  <div className="location-chip-list">
                    {isGlobalRole(item.role) ? (
                      <span className="location-chip highlighted">Tutte le sedi</span>
                    ) : assignedLocations.length > 0 ? (
                      assignedLocations.map((locationName) => (
                        <span className="location-chip" key={`${item.id}-${locationName}`}>
                          {locationName}
                        </span>
                      ))
                    ) : (
                      <span className="location-chip empty">Nessuna sede</span>
                    )}
                  </div>
                </div>

                <div className="user-cell user-status-cell">
                  <span className="user-cell-label">Stato</span>
                  <span className={item.active ? "user-tag success" : "user-tag muted"}>
                    {item.active ? "Attivo" : "Disattivo"}
                  </span>
                </div>

                <div className="user-cell user-actions">
                  <span className="user-cell-label">Azioni</span>
                  {canManageUsers ? (
                    <AdminDialog
                      buttonLabel="Modifica"
                      description="Aggiorna ruolo, stato e sedi operative dell&apos;utente."
                      title={`Modifica ${item.name}`}
                    >
                      <form action={saveUserAction} className="entity-form">
                        <input name="userId" type="hidden" value={item.id} />

                        <div className="form-grid">
                          <label>
                            <span>Nome</span>
                            <input defaultValue={item.name} name="name" type="text" />
                          </label>
                          <label>
                            <span>Email</span>
                            <input defaultValue={item.email} name="email" type="email" />
                          </label>
                          <label>
                            <span>Nuova password</span>
                            <input
                              name="password"
                              placeholder="Lascia vuoto per mantenere"
                              type="password"
                            />
                          </label>
                          <label>
                            <span>Ruolo</span>
                            <select defaultValue={item.role} name="role">
                              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        {renderLocationSelection(locations, selectedLocationIds)}

                        <div className="entity-footer">
                          <label className="checkbox-item">
                            <input defaultChecked={item.active} name="active" type="checkbox" />
                            <span>Utente attivo</span>
                          </label>

                          <button className="button button-primary" type="submit">
                            Aggiorna utente
                          </button>
                        </div>
                      </form>
                    </AdminDialog>
                  ) : (
                    <span className="helper-copy">Solo lettura</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
