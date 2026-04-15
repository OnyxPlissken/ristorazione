import { redirect } from "next/navigation";
import { DEFAULT_ROLE_PERMISSIONS } from "./constants";
import { db } from "./db";

const PAGE_PERMISSION_FIELDS = {
  dashboard: { view: "canViewDashboard", manage: "canViewDashboard" },
  locations: { view: "canViewLocations", manage: "canManageLocations" },
  tables: { view: "canViewTables", manage: "canManageTables", delete: "canDeleteTables" },
  menus: { view: "canViewMenus", manage: "canManageMenus" },
  hours: { view: "canViewHours", manage: "canManageHours" },
  reservations: { view: "canViewReservations", manage: "canManageReservations" },
  users: { view: "canViewUsers", manage: "canManageUsers" },
  console: { view: "canViewConsoleAdmin", manage: "canManageConsoleAdmin" }
};

function normalizeRolePermission(role, dbPermission = null) {
  return {
    role,
    ...DEFAULT_ROLE_PERMISSIONS[role],
    ...(dbPermission || {})
  };
}

export async function getRolePermission(role) {
  const dbPermission = await db.rolePermission.findUnique({
    where: {
      role
    }
  });

  return normalizeRolePermission(role, dbPermission);
}

export async function getRolePermissions() {
  const records = await db.rolePermission.findMany({
    orderBy: {
      role: "asc"
    }
  });

  return Object.keys(DEFAULT_ROLE_PERMISSIONS).map((role) =>
    normalizeRolePermission(role, records.find((item) => item.role === role))
  );
}

function getPermissionField(page, mode) {
  const config = PAGE_PERMISSION_FIELDS[page];

  if (!config) {
    throw new Error(`Pagina permessi non supportata: ${page}`);
  }

  return config[mode] || config.view;
}

export function canAccessPage(user, page, mode = "view") {
  if (!user?.rolePermission) {
    return false;
  }

  const field = getPermissionField(page, mode);
  return Boolean(user.rolePermission[field]);
}

export function assertPageAccess(user, page, mode = "view") {
  if (!canAccessPage(user, page, mode)) {
    throw new Error("Non autorizzato");
  }
}

export function requirePageAccess(user, page, mode = "view") {
  if (!canAccessPage(user, page, mode)) {
    redirect("/admin");
  }

  return user;
}

export function getAccessibleLocationIds(user) {
  if (!user) {
    return [];
  }

  if (["ADMIN", "PROPRIETARIO"].includes(user.role)) {
    return null;
  }

  return user.locationAccess.map((assignment) => assignment.locationId);
}

export function canAccessLocation(user, locationId) {
  if (!user) {
    return false;
  }

  if (["ADMIN", "PROPRIETARIO"].includes(user.role)) {
    return true;
  }

  return user.locationAccess.some(
    (assignment) => assignment.locationId === locationId
  );
}

export function assertLocationAccess(user, locationId) {
  if (!canAccessLocation(user, locationId)) {
    throw new Error("Non autorizzato per questa sede");
  }
}
