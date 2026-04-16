import { saveRolePermissionMatrixAction } from "../../../lib/actions/admin-actions";
import { requireRoles } from "../../../lib/auth";
import { ADMIN_PAGE_LABELS, DEFAULT_ROLE_PERMISSIONS, ROLE_LABELS } from "../../../lib/constants";
import { getRolePermissions } from "../../../lib/permissions";

export const dynamic = "force-dynamic";

const permissionSections = [
  {
    title: "Visibilità pagine",
    description: "Quali voci del pannello ogni ruolo può vedere.",
    fields: [
      { key: "canViewDashboard", label: ADMIN_PAGE_LABELS.dashboard },
      { key: "canViewLocations", label: ADMIN_PAGE_LABELS.locations },
      { key: "canViewTables", label: ADMIN_PAGE_LABELS.tables },
      { key: "canViewMenus", label: ADMIN_PAGE_LABELS.menus },
      { key: "canViewHours", label: ADMIN_PAGE_LABELS.hours },
      { key: "canViewReservations", label: ADMIN_PAGE_LABELS.reservations },
      { key: "canViewUsers", label: ADMIN_PAGE_LABELS.users },
      { key: "canViewConsoleAdmin", label: ADMIN_PAGE_LABELS.console }
    ]
  },
  {
    title: "Operazioni consentite",
    description: "Quali azioni operative e gestionali ogni ruolo può eseguire.",
    fields: [
      { key: "canManageLocations", label: "Gestire sedi" },
      { key: "canManageTables", label: "Gestire tavoli e zone" },
      { key: "canDeleteTables", label: "Eliminare tavoli" },
      { key: "canManageMenus", label: "Gestire menu e piatti" },
      { key: "canManageHours", label: "Gestire orari e slot" },
      { key: "canManageReservations", label: "Gestire prenotazioni" },
      { key: "canManageUsers", label: "Gestire utenti" },
      { key: "canManageConsoleAdmin", label: "Gestire console tecnica" }
    ]
  }
];

function countEnabled(permission) {
  return Object.keys(DEFAULT_ROLE_PERMISSIONS[permission.role]).reduce(
    (total, key) => total + (permission[key] ? 1 : 0),
    0
  );
}

export default async function PermessiPage() {
  await requireRoles(["ADMIN"]);
  const permissions = await getRolePermissions();

  return (
    <div className="page-stack">
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Permessi per ruolo</h2>
            <p>
              Vista unica per Admin. Modifichi tutti i ruoli nello stesso schermo, senza blocchi
              ripetuti.
            </p>
          </div>
        </div>

        <div className="permission-role-strip">
          {permissions.map((permission) => (
            <div className="summary-chip" key={permission.role}>
              <strong>{ROLE_LABELS[permission.role] || permission.role}</strong>
              <span>{countEnabled(permission)} permessi attivi</span>
            </div>
          ))}
        </div>
      </section>

      <form action={saveRolePermissionMatrixAction} className="entity-form">
        {permissionSections.map((section) => (
          <section className="panel-card" key={section.title}>
            <div className="panel-header">
              <div>
                <h2>{section.title}</h2>
                <p>{section.description}</p>
              </div>
            </div>

            <div className="permission-matrix-shell">
              <div className="permission-matrix">
                <div className="permission-matrix-head permission-matrix-head-label">
                  Permesso
                </div>

                {permissions.map((permission) => (
                  <div className="permission-matrix-head" key={`${section.title}-${permission.role}`}>
                    <strong>{ROLE_LABELS[permission.role] || permission.role}</strong>
                  </div>
                ))}

                {section.fields.map((field) => (
                  <div className="permission-matrix-row" key={`${section.title}-${field.key}`}>
                    <div className="permission-matrix-label">{field.label}</div>

                    {permissions.map((permission) => (
                      <label
                        className="permission-matrix-cell"
                        key={`${permission.role}-${field.key}`}
                      >
                        <input
                          defaultChecked={Boolean(permission[field.key])}
                          name={`${permission.role}__${field.key}`}
                          type="checkbox"
                        />
                        <span className="sr-only">
                          {field.label} per {ROLE_LABELS[permission.role] || permission.role}
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}

        <button className="button button-primary" type="submit">
          Salva matrice permessi
        </button>
      </form>
    </div>
  );
}
