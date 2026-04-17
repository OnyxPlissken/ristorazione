import { saveRolePermissionMatrixAction } from "../../../lib/actions/admin-actions";
import { requireRoles } from "../../../lib/auth";
import {
  ADMIN_PAGE_LABELS,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_LABELS
} from "../../../lib/constants";
import { getRolePermissions } from "../../../lib/permissions";

export const dynamic = "force-dynamic";

const permissionSections = [
  {
    title: "Visibilita pagine",
    description: "Definisce quali viste del pannello ogni ruolo puo consultare.",
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
    description: "Definisce cosa puo modificare o amministrare ogni ruolo.",
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
  },
  {
    title: "Esperienza interfaccia",
    description: "Permette di forzare un workspace touch ottimizzato per smartphone, tablet o palmari.",
    fields: [{ key: "useHandheldMode", label: "Usa modalita palmare" }]
  }
];

function countEnabled(permission) {
  return Object.keys(DEFAULT_ROLE_PERMISSIONS[permission.role]).reduce(
    (total, key) => total + (key.startsWith("can") && permission[key] ? 1 : 0),
    0
  );
}

export default async function PermessiPage() {
  await requireRoles(["ADMIN"]);
  const permissions = await getRolePermissions();
  const totalControls = permissionSections.reduce(
    (total, section) => total + section.fields.length,
    0
  );

  return (
    <div className="page-stack">
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Permessi per ruolo</h2>
            <p>Matrice tecnica unica: leggi i ruoli in colonna e modifichi tutto nello stesso workspace.</p>
          </div>
          <div className="row-meta">
            <span>{permissions.length} ruoli</span>
            <span>{totalControls} controlli</span>
          </div>
        </div>

        <div className="permission-summary-strip">
          {permissions.map((permission) => (
            <div className="permission-summary-cell" key={permission.role}>
              <strong>{ROLE_LABELS[permission.role] || permission.role}</strong>
              <span>{countEnabled(permission)} permessi attivi</span>
              <small>{permission.useHandheldMode ? "Modalita palmare" : "Modalita tecnica"}</small>
            </div>
          ))}
        </div>
      </section>

      <form action={saveRolePermissionMatrixAction} className="entity-form">
        <section className="panel-card permission-workspace">
          <div className="panel-header">
            <div>
              <h2>Matrice permessi</h2>
              <p>Le sezioni sono separate da righe divisorie, non da blocchi ripetuti.</p>
            </div>
          </div>

          <div className="permission-matrix-shell">
            <div className="permission-matrix permission-matrix-dense">
              <div className="permission-matrix-head permission-matrix-head-label">Permesso</div>

              {permissions.map((permission) => (
                <div className="permission-matrix-head" key={`head-${permission.role}`}>
                  <strong>{ROLE_LABELS[permission.role] || permission.role}</strong>
                </div>
              ))}

              {permissionSections.map((section) => (
                <div className="permission-section-group" key={section.title}>
                  <div className="permission-section-row">
                    <strong>{section.title}</strong>
                    <span>{section.description}</span>
                  </div>

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
              ))}
            </div>
          </div>

          <div className="section-submit-bar">
            <button className="button button-primary" type="submit">
              Salva matrice permessi
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
