import { cookies } from "next/headers";
import { ACTIVE_LOCATION_COOKIE_NAME, SESSION_DURATION_DAYS } from "./constants";
import { db } from "./db";
import { getAccessibleLocationIds } from "./permissions";

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(
      Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
    )
  };
}

function accessibleLocationWhere(user) {
  const ids = getAccessibleLocationIds(user);

  if (ids === null) {
    return {
      archivedAt: null
    };
  }

  return {
    archivedAt: null,
    id: {
      in: ids
    }
  };
}

function formatLocationOption(location) {
  return {
    id: location.id,
    name: location.name,
    city: location.city,
    address: location.address,
    publicName: location.technicalSettings?.displayName || location.name
  };
}

export async function getActiveLocationId() {
  const cookieStore = await cookies();
  return String(cookieStore.get(ACTIVE_LOCATION_COOKIE_NAME)?.value || "");
}

export async function setActiveLocationId(locationId) {
  const cookieStore = await cookies();

  if (!locationId) {
    cookieStore.delete(ACTIVE_LOCATION_COOKIE_NAME);
    return;
  }

  cookieStore.set(ACTIVE_LOCATION_COOKIE_NAME, locationId, getCookieOptions());
}

export async function clearActiveLocationId() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_LOCATION_COOKIE_NAME);
}

export async function getLoginLocationOptions() {
  const locations = await db.location.findMany({
    where: {
      archivedAt: null
    },
    include: {
      technicalSettings: {
        select: {
          displayName: true
        }
      }
    },
    orderBy: [
      {
        name: "asc"
      },
      {
        city: "asc"
      }
    ]
  });

  return locations.map(formatLocationOption);
}

export async function getAccessibleLocationOptions(user) {
  const locations = await db.location.findMany({
    where: accessibleLocationWhere(user),
    include: {
      technicalSettings: {
        select: {
          displayName: true
        }
      }
    },
    orderBy: [
      {
        name: "asc"
      },
      {
        city: "asc"
      }
    ]
  });

  return locations.map(formatLocationOption);
}

export async function resolveActiveLocation(user, locations) {
  const currentLocationId = await getActiveLocationId();
  const selectedLocation =
    locations.find((location) => location.id === currentLocationId) || locations[0] || null;

  if (!selectedLocation) {
    await clearActiveLocationId();
    return {
      activeLocation: null,
      activeLocationId: "",
      locations
    };
  }

  if (selectedLocation.id !== currentLocationId) {
    await setActiveLocationId(selectedLocation.id);
  }

  return {
    activeLocation: selectedLocation,
    activeLocationId: selectedLocation.id,
    locations
  };
}

export async function getAccessibleLocationsForLogin(user) {
  if (["ADMIN", "PROPRIETARIO"].includes(user.role)) {
    return getLoginLocationOptions();
  }

  const locations = (user.locationAccess || [])
    .map((assignment) => assignment.location)
    .filter((location) => location && !location.archivedAt)
    .map((location) => ({
      id: location.id,
      name: location.name,
      city: location.city,
      address: location.address,
      publicName: location.technicalSettings?.displayName || location.name
    }))
    .sort((left, right) => {
      const byName = left.name.localeCompare(right.name, "it");
      if (byName !== 0) {
        return byName;
      }
      return (left.city || "").localeCompare(right.city || "", "it");
    });

  return locations;
}
