import { db } from "./db";
import { naturalCompare } from "./format";
import { getAccessibleLocationIds } from "./permissions";

function locationFilter(user) {
  const ids = getAccessibleLocationIds(user);

  if (ids === null) {
    return {};
  }

  return {
    id: {
      in: ids
    }
  };
}

function reservationFilter(user) {
  const ids = getAccessibleLocationIds(user);

  if (ids === null) {
    return {};
  }

  return {
    locationId: {
      in: ids
    }
  };
}

function menuFilter(user) {
  const ids = getAccessibleLocationIds(user);

  if (ids === null) {
    return {};
  }

  return {
    OR: [
      {
        locationId: {
          in: ids
        }
      },
      {
        locationIds: {
          hasSome: ids
        }
      },
      {
        appliesToAllLocations: true
      }
    ]
  };
}

function publicLocationName(location) {
  return location.technicalSettings?.displayName || location.name;
}

function getMenuAssignedLocationIds(menu) {
  const ids = new Set([menu.locationId, ...(menu.locationIds || [])].filter(Boolean));
  return [...ids];
}

function menuMatchesLocation(menu, locationId) {
  if (menu.appliesToAllLocations) {
    return true;
  }

  return getMenuAssignedLocationIds(menu).includes(locationId);
}

function normalizeMenu(menu, locationsById) {
  const assignedLocationIds = getMenuAssignedLocationIds(menu);
  const assignedLocations = menu.appliesToAllLocations
    ? [...locationsById.values()]
    : assignedLocationIds
        .map((locationId) => locationsById.get(locationId))
        .filter(Boolean)
        .sort((left, right) => naturalCompare(left.name, right.name));

  return {
    ...menu,
    assignedLocationIds,
    assignedLocations,
    locationSummary: menu.appliesToAllLocations
      ? "Tutte le sedi"
      : assignedLocations.map((location) => location.name).join(", ")
  };
}

function flattenMenuItems(location) {
  return location.menus.flatMap((menu) =>
    menu.sections.flatMap((section) =>
      section.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        category: section.name,
        price: Number(item.price),
        allergens: item.allergens
      }))
    )
  );
}

function sortZones(zones) {
  return [...zones].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || naturalCompare(left.name, right.name)
  );
}

function sortTables(tables) {
  return [...tables].sort((left, right) => naturalCompare(left.code, right.code));
}

function normalizeLocation(location) {
  return {
    ...location,
    zones: location.zones ? sortZones(location.zones) : [],
    tables: location.tables ? sortTables(location.tables) : []
  };
}

export async function getAdminDashboardData(user) {
  const whereLocation = locationFilter(user);
  const locations = await db.location.findMany({
    where: whereLocation,
    include: {
      technicalSettings: true
    },
    orderBy: { name: "asc" }
  });

  const locationIds = locations.map((item) => item.id);

  const [tables, reservations, menus, users, qrSessions] = await Promise.all([
    db.diningTable.count({
      where: {
        locationId: {
          in: locationIds
        }
      }
    }),
    db.reservation.count({
      where: {
        locationId: {
          in: locationIds
        }
      }
    }),
    db.menu.count({
      where: menuFilter(user)
    }),
    db.user.count(),
    db.tableSession.count({
      where: {
        locationId: {
          in: locationIds
        },
        status: {
          in: ["OPEN", "PAYMENT_REQUESTED"]
        }
      }
    })
  ]);

  const upcomingReservations = await db.reservation.findMany({
    where: {
      locationId: {
        in: locationIds
      },
      dateTime: {
        gte: new Date()
      }
    },
    include: {
      location: {
        include: {
          technicalSettings: true
        }
      },
      table: true
    },
    orderBy: {
      dateTime: "asc"
    },
    take: 8
  });

  return {
    locations,
    stats: {
      locations: locations.length,
      tables,
      reservations,
      menus,
      users,
      qrSessions
    },
    upcomingReservations: upcomingReservations.map((reservation) => ({
      ...reservation,
      locationLabel: publicLocationName(reservation.location)
    }))
  };
}

export async function getAccessibleLocations(user) {
  const [locations, menus] = await Promise.all([
    db.location.findMany({
      where: locationFilter(user),
      include: {
        settings: true,
        technicalSettings: true,
        openingHours: {
          orderBy: {
            weekday: "asc"
          }
        },
        tables: {
          include: {
            zoneRecord: true
          }
        },
        zones: {
          orderBy: {
            sortOrder: "asc"
          }
        },
        reservations: {
          include: {
            table: true
          },
          orderBy: {
            dateTime: "desc"
          },
          take: 30
        }
      },
      orderBy: {
        name: "asc"
      }
    }),
    db.menu.findMany({
      where: menuFilter(user),
      include: {
        sections: {
          include: {
            items: {
              orderBy: {
                sortOrder: "asc"
              }
            }
          },
          orderBy: {
            sortOrder: "asc"
          }
        }
      },
      orderBy: {
        name: "asc"
      }
    })
  ]);

  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const normalizedMenus = menus.map((menu) => normalizeMenu(menu, locationsById));

  return locations.map((location) =>
    normalizeLocation({
      ...location,
      menus: normalizedMenus.filter((menu) => menuMatchesLocation(menu, location.id))
    })
  );
}

export async function getAdminConsoleLocations() {
  const locations = await db.location.findMany({
    include: {
      technicalSettings: true,
      tables: {
        include: {
          zoneRecord: true
        }
      },
      zones: {
        orderBy: {
          sortOrder: "asc"
        }
      }
    },
    orderBy: {
      name: "asc"
    }
  });

  return locations.map(normalizeLocation);
}

export async function getUsersWithLocations() {
  const users = await db.user.findMany({
    include: {
      locationAccess: {
        include: {
          location: true
        }
      }
    },
    orderBy: [
      {
        name: "asc"
      },
      {
        createdAt: "asc"
      }
    ]
  });

  return users.map((user) => ({
    ...user,
    locationAccess: [...user.locationAccess].sort((left, right) =>
      naturalCompare(left.location.name, right.location.name)
    )
  }));
}

export async function getReservationsPageData(user) {
  const reservations = await db.reservation.findMany({
    where: reservationFilter(user),
    include: {
      location: {
        include: {
          technicalSettings: true,
          tables: {
            where: {
              active: true
            },
            include: {
              zoneRecord: true
            }
          }
        }
      },
      table: true
    },
    orderBy: [
      {
        dateTime: "asc"
      },
      {
        createdAt: "desc"
      }
    ]
  });

  return reservations.map((reservation) => ({
    ...reservation,
    locationName: publicLocationName(reservation.location),
    availableTables: sortTables(reservation.location.tables)
  }));
}

export async function getAdminReservationLiveSummary(user) {
  const where = reservationFilter(user);
  const [pendingCount, pendingReservations] = await Promise.all([
    db.reservation.count({
      where: {
        ...where,
        status: "IN_ATTESA"
      }
    }),
    db.reservation.findMany({
      where: {
        ...where,
        status: "IN_ATTESA"
      },
      include: {
        location: {
          include: {
            technicalSettings: true
          }
        }
      },
      orderBy: [
        {
          createdAt: "desc"
        },
        {
          dateTime: "asc"
        }
      ],
      take: 8
    })
  ]);

  const normalizedReservations = pendingReservations.map((reservation) => ({
    id: reservation.id,
    guestName: reservation.guestName,
    guests: reservation.guests,
    status: reservation.status,
    dateTime: reservation.dateTime,
    createdAt: reservation.createdAt,
    locationName: publicLocationName(reservation.location)
  }));

  return {
    pendingCount,
    latestReservation: normalizedReservations[0] || null,
    recentReservations: normalizedReservations,
    pendingReservations: normalizedReservations
  };
}

export async function getPublicReservationData() {
  const locations = await db.location.findMany({
    where: {
      reservationEnabled: true
    },
    include: {
      settings: true,
      technicalSettings: true,
      openingHours: {
        orderBy: {
          weekday: "asc"
        }
      }
    },
    orderBy: {
      name: "asc"
    }
  });

  return locations
    .filter((location) => location.technicalSettings?.reservationsEnabled !== false)
    .map((location) => ({
      ...location,
      publicName: publicLocationName(location)
    }));
}

export async function getPublicReservationManageData(token) {
  const reservation = await db.reservation.findFirst({
    where: {
      manageToken: token
    },
    include: {
      location: {
        include: {
          settings: true,
          technicalSettings: true,
          openingHours: {
            orderBy: {
              weekday: "asc"
            }
          }
        }
      },
      table: true
    }
  });

  if (!reservation) {
    return null;
  }

  return {
    ...reservation,
    locationName: publicLocationName(reservation.location)
  };
}

export async function getTableSessionPageData(tableId) {
  const table = await db.diningTable.findUnique({
    where: {
      id: tableId
    },
    include: {
      zoneRecord: true,
      location: {
        include: {
          technicalSettings: true
        }
      }
    }
  });

  if (!table || !table.active) {
    return null;
  }

  if (!table.location.technicalSettings?.qrEnabled) {
    return {
      table,
      qrEnabled: false
    };
  }

  const tableLocationMenus = await db.menu.findMany({
    where: {
      isActive: true,
      OR: [
        {
          locationId: table.locationId
        },
        {
          locationIds: {
            has: table.locationId
          }
        },
        {
          appliesToAllLocations: true
        }
      ]
    },
    include: {
      sections: {
        orderBy: {
          sortOrder: "asc"
        },
        include: {
          items: {
            where: {
              available: true
            },
            orderBy: {
              sortOrder: "asc"
            }
          }
        }
      }
    },
    orderBy: {
      name: "asc"
    }
  });

  let session = await db.tableSession.findFirst({
    where: {
      tableId: table.id,
      status: {
        in: ["OPEN", "PAYMENT_REQUESTED"]
      }
    },
    include: {
      seats: {
        orderBy: {
          code: "asc"
        }
      },
      items: {
        include: {
          seat: true
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!session) {
    session = await db.tableSession.create({
      data: {
        locationId: table.locationId,
        tableId: table.id,
        seats: {
          create: Array.from({ length: table.seats }, (_, index) => ({
            code: `S${index + 1}`,
            label: `Posto ${index + 1}`
          }))
        }
      },
      include: {
        seats: {
          orderBy: {
            code: "asc"
          }
        },
        items: {
          include: {
            seat: true
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });
  }

  return {
    qrEnabled: true,
    table,
    location: {
      ...table.location,
      menus: tableLocationMenus,
      publicName: publicLocationName(table.location)
    },
    session: {
      ...session,
      items: session.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice)
      }))
    },
    menuItems: flattenMenuItems(table.location)
  };
}
