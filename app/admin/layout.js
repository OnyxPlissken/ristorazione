import AdminChrome from "../../components/admin-chrome";
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
    <AdminChrome
      initialReservationSummary={reservationSummary}
      items={items}
      showPermissions={user.role === "ADMIN"}
      userName={user.name}
      userRoleLabel={roleLabel(user.role)}
    >
      {children}
    </AdminChrome>
  );
}
