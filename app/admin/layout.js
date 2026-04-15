import Link from "next/link";
import AdminSidebarNav from "../../components/admin-sidebar-nav";
import { logoutAction } from "../../lib/actions/auth-actions";
import { requireUser, roleLabel } from "../../lib/auth";
import { canAccessPage } from "../../lib/permissions";
import { getAdminReservationLiveSummary } from "../../lib/queries";

export const dynamic = "force-dynamic";

const navigation = [
  { href: "/admin", label: "Dashboard", page: "dashboard" },
  { href: "/admin/sedi", label: "Sedi", page: "locations" },
  { href: "/admin/tavoli", label: "Tavoli", page: "tables" },
  { href: "/admin/menu", label: "Menu", page: "menus" },
  { href: "/admin/orari", label: "Orari", page: "hours" },
  { href: "/admin/prenotazioni", label: "Prenotazioni", page: "reservations" },
  { href: "/admin/utenti", label: "Utenti", page: "users" },
  { href: "/admin/console", label: "Console Admin", page: "console" }
];

export default async function AdminLayout({ children }) {
  const user = await requireUser();
  const items = navigation.filter((item) => canAccessPage(user, item.page));
  const reservationSummary = canAccessPage(user, "reservations")
    ? await getAdminReservationLiveSummary(user)
    : null;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" href="/admin">
          Coperto
        </Link>
        <p className="sidebar-copy">Gestionale ristorazione in italiano.</p>
        <AdminSidebarNav
          initialLatestReservation={reservationSummary?.latestReservation || null}
          initialPendingCount={reservationSummary?.pendingCount || 0}
          items={items}
          showPermissions={user.role === "ADMIN"}
        />
        <div className="sidebar-user">
          <strong>{user.name}</strong>
          <span>{roleLabel(user.role)}</span>
        </div>
        <form action={logoutAction}>
          <button className="button button-secondary button-full" type="submit">
            Esci
          </button>
        </form>
      </aside>

      <div className="admin-content">
        <header className="admin-topbar">
          <div>
            <div className="eyebrow">Pannello amministrativo</div>
            <h1>Gestione operativa</h1>
          </div>
          <Link className="button button-secondary" href="/prenota">
            Pagina prenotazione
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
