import { canManageUsers, requireRoles, roleLabel } from "../../../lib/auth";
import { ROLE_LABELS } from "../../../lib/constants";
import { saveUserAction } from "../../../lib/actions/admin-actions";
import { getAccessibleLocations, getUsersWithLocations } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function UtentiPage() {
  const user = await requireRoles(["ADMIN", "PROPRIETARIO"]);
  const [users, locations] = await Promise.all([
    getUsersWithLocations(),
    getAccessibleLocations(user)
  ]);

  if (!canManageUsers(user)) {
    return null;
  }

  return (
    <div className="page-stack">
      <section className="panel-card">
        <div className="panel-header">
          <h2>Crea nuovo utente</h2>
          <p>Assegna ruolo e sedi operative.</p>
        </div>
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
          <div className="checkbox-group">
            <span>Sedi assegnate</span>
            <div className="checkbox-grid">
              {locations.map((location) => (
                <label className="checkbox-item" key={location.id}>
                  <input name="locationIds" type="checkbox" value={location.id} />
                  <span>{location.name}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="checkbox-item">
            <input defaultChecked name="active" type="checkbox" />
            <span>Utente attivo</span>
          </label>
          <button className="button button-primary" type="submit">
            Salva utente
          </button>
        </form>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <h2>Utenti esistenti</h2>
          <p>Modifica ruolo, stato e sedi associate.</p>
        </div>
        <div className="entity-list">
          {users.map((item) => (
            <form action={saveUserAction} className="entity-card" key={item.id}>
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
                  <input name="password" placeholder="Lascia vuoto per mantenere" type="password" />
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
              <div className="checkbox-group">
                <span>Sedi assegnate</span>
                <div className="checkbox-grid">
                  {locations.map((location) => {
                    const checked = item.locationAccess.some(
                      (assignment) => assignment.locationId === location.id
                    );

                    return (
                      <label className="checkbox-item" key={`${item.id}-${location.id}`}>
                        <input
                          defaultChecked={checked}
                          name="locationIds"
                          type="checkbox"
                          value={location.id}
                        />
                        <span>{location.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="entity-footer">
                <label className="checkbox-item">
                  <input defaultChecked={item.active} name="active" type="checkbox" />
                  <span>
                    {roleLabel(item.role)}{item.active ? " attivo" : " disattivo"}
                  </span>
                </label>
                <button className="button button-primary" type="submit">
                  Aggiorna utente
                </button>
              </div>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
