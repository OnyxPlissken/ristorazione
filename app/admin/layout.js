import AdminChrome from "../../components/admin-chrome";
import { getAdminNotificationSummary } from "../../lib/admin-notifications";
import { requireUser, roleLabel } from "../../lib/auth";
import { summarizeLocationModules } from "../../lib/location-modules";
import { canAccessPage } from "../../lib/permissions";
import {
  getAccessibleLocationModules,
  getAdminReservationLiveSummary
} from "../../lib/queries";

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
    subsection: "Servizio",
    moduleKey: "reservations"
  },
  {
    href: "/admin/calendario",
    label: "Calendario",
    page: "reservations",
    section: "Operativita",
    sectionDescription: "Monitoraggio servizio, prenotazioni e performance.",
    subsection: "Servizio",
    moduleKey: "reservations"
  },
  {
    href: "/admin/clienti",
    label: "CRM",
    page: "reservations",
    section: "Operativita",
    sectionDescription: "Monitoraggio servizio, prenotazioni e performance.",
    subsection: "Clienti",
    moduleKey: "customerScoring"
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    page: "dashboard",
    section: "Operativita",
    sectionDescription: "Monitoraggio servizio, prenotazioni e performance.",
    subsection: "Clienti",
    moduleKeysAny: ["reservations", "customerScoring", "smartWaitlist"]
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

function matchesModuleVisibility(item, moduleSummary) {
  if (!item.moduleKey && !item.moduleKeysAny) {
    return true;
  }

  if (item.moduleKey) {
    return moduleSummary.has(item.moduleKey);
  }

  return moduleSummary.any(item.moduleKeysAny || []);
}

export default async function AdminLayout({ children }) {
  const user = await requireUser();
  const accessibleLocationModules = await getAccessibleLocationModules(user);
  const moduleSummary = summarizeLocationModules(accessibleLocationModules);
  const items = navigation.filter(
    (item) => canAccessPage(user, item.page) && matchesModuleVisibility(item, moduleSummary)
  );
  const showReservationTools = canAccessPage(user, "reservations") && moduleSummary.has("reservations");
  const reservationSummary = showReservationTools
    ? await getAdminReservationLiveSummary(user)
    : null;
  const notificationSummary = await getAdminNotificationSummary(user);

  return (
    <AdminChrome
      handheldMode={Boolean(user.rolePermission?.useHandheldMode)}
      initialNotificationSummary={notificationSummary}
      initialReservationSummary={reservationSummary}
      items={items}
      watchReservationSummary={showReservationTools}
      showPermissions={user.role === "ADMIN"}
      userName={user.name}
      userRoleLabel={roleLabel(user.role)}
    >
      {children}
    </AdminChrome>
  );
}
