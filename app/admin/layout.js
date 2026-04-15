import Link from "next/link";
import { logoutAction } from "../../lib/actions/auth-actions";
import { canManageUsers, requireUser, roleLabel } from "../../lib/auth";

export const dynamic = "force-dynamic";

const navigation = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/sedi", label: "Sedi" },
  { href: "/admin/tavoli", label: "Tavoli" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/orari", label: "Orari" },
  { href: "/admin/prenotazioni", label: "Prenotazioni" }
];

export default async function AdminLayout({ children }) {
  const user = await requireUser();
  const items = [...navigation];

  if (canManageUsers(user)) {
    items.push({ href: "/admin/utenti", label: "Utenti" });
  }

  if (user.role === "ADMIN") {
    items.push({ href: "/admin/console", label: "Console Admin" });
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand" href="/admin">
          Coperto
        </Link>
        <p className="sidebar-copy">Gestionale ristorazione in italiano.</p>
        <nav className="sidebar-nav">
          {items.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
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
