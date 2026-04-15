import { saveRolePermissionAction } from "../../../lib/actions/admin-actions";
import { requireRoles } from "../../../lib/auth";
import { ADMIN_PAGE_LABELS, ROLE_LABELS } from "../../../lib/constants";
import { getRolePermissions } from "../../../lib/permissions";

export const dynamic = "force-dynamic";

const permissionSections = [
  {
    title: "Accesso pagine",
    description: "Definisce quali sezioni del pannello sono visibili per ogni ruolo.",
    fields: [
      { key: "canViewDashboard", label: `Vedere ${ADMIN_PAGE_LABELS.dashboard}` },
      { key: "canViewLocations", label: `Vedere ${ADMIN_PAGE_LABELS.locations}` },
      { key: "canViewTables", label: `Vedere ${ADMIN_PAGE_LABELS.tables}` },
      { key: "canViewMenus", label: `Vedere ${ADMIN_PAGE_LABELS.menus}` },
      { key: "canViewHours", label: `Vedere ${ADMIN_PAGE_LABELS.hours}` },
      { key: "canViewReservations", label: `Vedere ${ADMIN_PAGE_LABELS.reservations}` },
      { key: "canViewUsers", label: `Vedere ${ADMIN_PAGE_LABELS.users}` },
      { key: "canViewConsoleAdmin", label: `Vedere ${ADMIN_PAGE_LABELS.console}` }
    ]
  },
  {
    title: "Azioni consentite",
    description: "Definisce quali operazioni sono autorizzate per il ruolo.",
    fields: [
      { key: "canManageLocations", label: "Creare e modificare sedi" },
      { key: "canManageTables", label: "Creare e modificare tavoli e zone" },
      { key: "canDeleteTables", label: "Eliminare tavoli" },
      { key: "canManageMenus", label: "Gestire menu e piatti" },
      { key: "canManageHours", label: "Gestire orari e regole prenotazioni" },
      { key: "canManageReservations", label: "Gestire prenotazioni" },
      { key: "canManageUsers", label: "Gestire utenti e sedi assegnate" },
      { key: "canManageConsoleAdmin", label: "Gestire console tecnica" }
    ]
  }
];

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
              Pagina riservata agli Admin. Qui decidi cosa puo&apos; vedere o fare ogni gruppo
              utente in tutto il pannello.
            </p>
          </div>
        </div>
      </section>

      {permissions.map((permission) => (
        <section className="panel-card" key={permission.role}>
          <div className="panel-header">
            <div>
              <h2>{ROLE_LABELS[permission.role] || permission.role}</h2>
              <p>Le modifiche si applicano a tutti gli utenti che hanno questo ruolo.</p>
            </div>
          </div>

          <form action={saveRolePermissionAction} className="entity-form">
            <input name="role" type="hidden" value={permission.role} />

            <div className="section-stack">
              {permissionSections.map((section) => (
                <div className="section-card" key={`${permission.role}-${section.title}`}>
                  <div className="panel-header">
                    <div>
                      <h2>{section.title}</h2>
                      <p>{section.description}</p>
                    </div>
                  </div>

                  <div className="checkbox-grid">
                    {section.fields.map((field) => (
                      <label className="checkbox-item" key={`${permission.role}-${field.key}`}>
                        <input
                          defaultChecked={Boolean(permission[field.key])}
                          name={field.key}
                          type="checkbox"
                        />
                        <span>{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button className="button button-primary" type="submit">
              Salva permessi {ROLE_LABELS[permission.role] || permission.role}
            </button>
          </form>
        </section>
      ))}
    </div>
  );
}
