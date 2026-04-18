import AdminChrome from "../../components/admin-chrome";
import { getAdminNotificationSummary } from "../../lib/admin-notifications";
import { requireUser, roleLabel } from "../../lib/auth";
import { canAccessPage } from "../../lib/permissions";
import { getAdminReservationLiveSummary } from "../../lib/queries";

export const dynamic = "force-dynamic";

const navigation = [
  {
    href: "/admin",
    label: "Dashboard",
    page: "dashboard",
    section: "Operativita",
    sectionDescription: "Monitoraggio servizio, prenotazioni e performance.",
    subsection: "Panoramica"
  },
  {
    href: "/admin/sala",
    label: "Sala",
    page: "tables",
    section: "Operativita",
    sectionDescription: "Monitoraggio servizio, prenotazioni e performance.",
    subsection: "Servizio"
  },
  {
    href: "/admin/prenotazioni",
    label: "Prenotazioni",
    page: "reservations",
    section: "Operativita",
    sectionDescription: "Monitoraggio servizio, prenotazioni e performance.",
    subsection: "Servizio"
  },
  {
    href: "/admin/calendario",
    label: "Calendario",
    page: "reservations",
    section: "Operativita",
    sectionDescription: "Monitoraggio servizio, prenotazioni e performance.",
    subsection: "Servizio"
  },
  {
    href: "/admin/clienti",
    label: "CRM",
    page: "reservations",
    section: "Operativita",
    sectionDescription: "Monitoraggio servizio, prenotazioni e performance.",
    subsection: "Clienti"
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    page: "dashboard",
    section: "Operativita",
    sectionDescription: "Monitoraggio servizio, prenotazioni e performance.",
    subsection: "Clienti"
  },
  {
    href: "/admin/registro",
    label: "Registro",
    page: "reservations",
    section: "Operativita",
    sectionDescription: "Monitoraggio servizio, prenotazioni e performance.",
    subsection: "Clienti"
  },
  {
    href: "/admin/sedi",
    label: "Sedi",
    page: "locations",
    section: "Catalogo e locale",
    sectionDescription: "Assetto del locale, catalogo e configurazione operativa.",
    subsection: "Setup sede"
  },
  {
    href: "/admin/tavoli",
    label: "Tavoli",
    page: "tables",
    section: "Catalogo e locale",
    sectionDescription: "Assetto del locale, catalogo e configurazione operativa.",
    subsection: "Setup sede"
  },
  {
    href: "/admin/orari",
    label: "Orari",
    page: "hours",
    section: "Catalogo e locale",
    sectionDescription: "Assetto del locale, catalogo e configurazione operativa.",
    subsection: "Setup sede"
  },
  {
    href: "/admin/menu",
    label: "Menu",
    page: "menus",
    section: "Catalogo e locale",
    sectionDescription: "Assetto del locale, catalogo e configurazione operativa.",
    subsection: "Catalogo"
  },
  {
    href: "/admin/utenti",
    label: "Utenti",
    page: "users",
    section: "Sistema",
    sectionDescription: "Accessi, permessi e moduli tecnici del prodotto.",
    subsection: "Accessi"
  },
  {
    href: "/admin/console",
    label: "Console Admin",
    page: "console",
    section: "Sistema",
    sectionDescription: "Accessi, permessi e moduli tecnici del prodotto.",
    subsection: "Configurazione"
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
