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
