import AdminChrome from "../../components/admin-chrome";
import { getAdminNotificationSummary } from "../../lib/admin-notifications";
import { requireUser, roleLabel } from "../../lib/auth";
import { canAccessPage } from "../../lib/permissions";
import { getAdminReservationLiveSummary } from "../../lib/queries";

export const dynamic = "force-dynamic";

const navigation = [
  { href: "/admin", label: "Dashboard", page: "dashboard", section: "Operativo" },
  { href: "/admin/sala", label: "Sala", page: "tables", section: "Operativo" },
  {
    href: "/admin/prenotazioni",
    label: "Prenotazioni",
    page: "reservations",
    section: "Operativo"
  },
  {
    href: "/admin/calendario",
    label: "Calendario",
    page: "reservations",
    section: "Operativo"
  },
  { href: "/admin/analytics", label: "Analytics", page: "dashboard", section: "Operativo" },
  { href: "/admin/registro", label: "Registro", page: "reservations", section: "Operativo" },
  { href: "/admin/sedi", label: "Sedi", page: "locations", section: "Setup locale" },
  { href: "/admin/tavoli", label: "Tavoli", page: "tables", section: "Setup locale" },
  { href: "/admin/orari", label: "Orari", page: "hours", section: "Setup locale" },
  { href: "/admin/menu", label: "Menu", page: "menus", section: "Setup locale" },
  { href: "/admin/utenti", label: "Utenti", page: "users", section: "Amministrazione" },
  {
    href: "/admin/console",
    label: "Console Admin",
    page: "console",
    section: "Amministrazione"
  }
];

export default async function AdminLayout({ children }) {
  const user = await requireUser();
  const items = navigation.filter((item) => canAccessPage(user, item.page));
  const reservationSummary = canAccessPage(user, "reservations")
    ? await getAdminReservationLiveSummary(user)
    : null;
  const notificationSummary = await getAdminNotificationSummary(user);

  return (
    <AdminChrome
      handheldMode={Boolean(user.rolePermission?.useHandheldMode)}
      initialNotificationSummary={notificationSummary}
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
