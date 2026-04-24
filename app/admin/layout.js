import AdminChrome from "../../components/admin-chrome";
import {
  getAccessibleLocationOptions,
  resolveActiveLocation
} from "../../lib/active-location";
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
    section: "Principali",
    isPrimary: true
  },
  {
    href: "/admin/prenotazioni",
    label: "Prenotazioni",
    page: "reservations",
    section: "Principali",
    moduleKey: "reservations",
    isPrimary: true
  },
  {
    href: "/admin/sala",
    label: "Sala",
    page: "tables",
    section: "Principali",
    isPrimary: true
  },
  {
    href: "/admin/calendario",
    label: "Calendario",
    page: "reservations",
    section: "Principali",
    moduleKey: "reservations"
  },
  {
    href: "/admin/clienti",
    label: "CRM",
    page: "reservations",
    section: "Principali",
    moduleKey: "customerScoring",
    isPrimary: true
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    page: "dashboard",
    section: "Analisi",
    moduleKeysAny: ["reservations", "customerScoring", "smartWaitlist"]
  },
  {
    href: "/admin/registro",
    label: "Registro",
    page: "reservations",
    section: "Analisi"
  },
  {
    href: "/admin/menu",
    label: "Menu",
    page: "menus",
    section: "Locale",
    isPrimary: true
  },
  {
    href: "/admin/tavoli",
    label: "Tavoli",
    page: "tables",
    section: "Locale"
  },
  {
    href: "/admin/orari",
    label: "Orari",
    page: "hours",
    section: "Locale"
  },
  {
    href: "/admin/sedi",
    label: "Sedi",
    page: "locations",
    section: "Locale"
  },
  {
    href: "/admin/utenti",
    label: "Utenti",
    page: "users",
    section: "Sistema"
  },
  {
    href: "/admin/backup",
    label: "Backup",
    page: "console",
    section: "Sistema"
  },
  {
    href: "/admin/console",
    label: "Console Admin",
    page: "console",
    section: "Sistema",
    isPrimary: true
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
  const [locationOptions, accessibleLocationModules] = await Promise.all([
    getAccessibleLocationOptions(user),
    getAccessibleLocationModules(user)
  ]);
  const { activeLocation, activeLocationId } = await resolveActiveLocation(user, locationOptions);
  const scopedModules = activeLocationId
    ? accessibleLocationModules.filter((location) => location.id === activeLocationId)
    : accessibleLocationModules;
  const moduleSummary = summarizeLocationModules(scopedModules);
  const items = navigation.filter(
    (item) => canAccessPage(user, item.page) && matchesModuleVisibility(item, moduleSummary)
  );
  const showReservationTools = canAccessPage(user, "reservations") && moduleSummary.has("reservations");
  const reservationSummary = showReservationTools
    ? await getAdminReservationLiveSummary(user, { locationId: activeLocationId })
    : null;
  const notificationSummary = await getAdminNotificationSummary(user, {
    locationId: activeLocationId
  });

  return (
    <AdminChrome
      activeLocationId={activeLocationId}
      activeLocationLabel={activeLocation?.publicName || activeLocation?.name || ""}
      handheldMode={Boolean(user.rolePermission?.useHandheldMode)}
      initialNotificationSummary={notificationSummary}
      initialReservationSummary={reservationSummary}
      items={items}
      locationOptions={locationOptions}
      watchReservationSummary={showReservationTools}
      showPermissions={user.role === "ADMIN"}
      userName={user.name}
      userRoleLabel={roleLabel(user.role)}
    >
      {children}
    </AdminChrome>
  );
}
