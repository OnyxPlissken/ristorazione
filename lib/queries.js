import { db } from "./db";
import { naturalCompare } from "./format";
import { getAccessibleLocationIds } from "./permissions";
import { getDateKey, getReservationWindow } from "./reservations";

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

function logFilter(user) {
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
      (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || naturalCompare(left.name, right.name)
  );
}

function sortTables(tables) {
  return [...tables].sort((left, right) => naturalCompare(left.code, right.code));
}

function normalizeLocation(location) {
  return {
    ...location,
    zones: location.zones ? sortZones(location.zones) : [],
    tables: location.tables ? sortTables(location.tables) : [],
    openingExceptions: (location.openingExceptions || []).sort(
      (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
    )
  };
}

function getAssignedTableIds(reservation) {
  return [...new Set([reservation.tableId, ...(reservation.tableIds || [])].filter(Boolean))];
}

function resolveAssignedTables(reservation, locationTables) {
  const tableIds = getAssignedTableIds(reservation);
  const tableLookup = new Map(locationTables.map((table) => [table.id, table]));
  return tableIds.map((tableId) => tableLookup.get(tableId)).filter(Boolean);
}

function parseDateText(dateText) {
  const date = dateText ? new Date(`${dateText}T00:00:00`) : new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDayWindow(dateText) {
  const start = parseDateText(dateText);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isSameDay(left, right) {
  return getDateKey(left) === getDateKey(right);
}

function buildFloorStatus({ table, reservations, locationSettings, selectedDate }) {
  const durationMinutes = locationSettings?.durationMinutes || 120;
  const now = new Date();
  const isToday = isSameDay(selectedDate, now);
  const referenceTime = isToday ? now : new Date(`${getDateKey(selectedDate)}T00:00:00`);
  const currentReservation = reservations.find((reservation) => {
    const window = getReservationWindow(reservation.dateTime, durationMinutes);
    return window.start <= referenceTime && referenceTime < window.end;
  });
  const nextReservation = reservations
    .filter((reservation) => new Date(reservation.dateTime) >= referenceTime)
    .sort((left, right) => new Date(left.dateTime) - new Date(right.dateTime))[0];

  if (!table.active) {
    return {
      code: "INATTIVO",
      label: "Tavolo inattivo",
      tone: "inactive"
    };
  }

  if (currentReservation) {
    return {
      code: "OCCUPATO",
      label: "Occupato ora",
      tone: "occupied",
      reservation: currentReservation
    };
  }

  if (nextReservation) {
    return {
      code: "PRENOTATO",
      label: "Prossima prenotazione",
      tone: "scheduled",
      reservation: nextReservation
    };
  }

  return {
    code: "LIBERO",
    label: "Libero",
    tone: "free"
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
        openingExceptions: {
          orderBy: {
            date: "asc"
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
          settings: true,
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

  return reservations.map((reservation) => {
    const assignedTables = resolveAssignedTables(reservation, reservation.location.tables);
    return {
      ...reservation,
      locationName: publicLocationName(reservation.location),
      availableTables: sortTables(reservation.location.tables),
      assignedTables,
      assignedTableCodes: assignedTables.map((table) => table.code)
    };
  });
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
      },
      openingExceptions: {
        where: {
          date: {
            gte: new Date()
          }
        },
        orderBy: {
          date: "asc"
        },
        take: 8
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
          },
          openingExceptions: {
            orderBy: {
              date: "asc"
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

export async function getFloorPageData(user, options = {}) {
  const locations = await getAccessibleLocations(user);
  const selectedDate = options.dateText || getDateKey(new Date());
  const selectedLocation =
    locations.find((location) => location.id === options.locationId) || locations[0] || null;

  if (!selectedLocation) {
    return {
      locations,
      selectedLocation: null,
      selectedDate
    };
  }

  const { start, end } = getDayWindow(selectedDate);
  const selectedDateValue = parseDateText(selectedDate);
  const reservations = await db.reservation.findMany({
    where: {
      locationId: selectedLocation.id,
      dateTime: {
        gte: start,
        lte: end
      },
      status: {
        in: ["IN_ATTESA", "CONFERMATA", "IN_CORSO", "COMPLETATA"]
      }
    },
    orderBy: [
      {
        dateTime: "asc"
      },
      {
        createdAt: "asc"
      }
    ]
  });

  const tableLookup = new Map(selectedLocation.tables.map((table) => [table.id, table]));
  const normalizedReservations = reservations.map((reservation) => {
    const assignedTableIds = getAssignedTableIds(reservation);
    const assignedTables = assignedTableIds
      .map((tableId) => tableLookup.get(tableId))
      .filter(Boolean);

    return {
      ...reservation,
      assignedTableIds,
      assignedTableCodes: assignedTables.map((table) => table.code)
    };
  });

  const reservationsByTableId = new Map();

  for (const reservation of normalizedReservations) {
    for (const tableId of reservation.assignedTableIds) {
      const items = reservationsByTableId.get(tableId) || [];
      items.push(reservation);
      reservationsByTableId.set(tableId, items);
    }
  }

  const hasUnassignedTables = selectedLocation.tables.some((table) => !table.zoneId);
  const floorZones = selectedLocation.zones.length > 0
    ? [
        ...selectedLocation.zones,
        ...(hasUnassignedTables
          ? [{ id: "unassigned", name: "Senza zona", sortOrder: 999, active: true }]
          : [])
      ]
    : [{ id: "default", name: "Sala principale", sortOrder: 0, active: true }];
  const zones = floorZones.map((zone) => {
    const zoneTables = selectedLocation.tables
      .filter((table) =>
        zone.id === "default" || zone.id === "unassigned"
          ? !table.zoneId
          : table.zoneId === zone.id || (!table.zoneId && table.zone === zone.name)
      )
      .map((table) => {
        const tableReservations = reservationsByTableId.get(table.id) || [];
        return {
          ...table,
          combinableCodes: (table.combinableWithIds || [])
            .map((tableId) => tableLookup.get(tableId)?.code)
            .filter(Boolean)
            .sort((left, right) => naturalCompare(left, right)),
          reservations: tableReservations,
          floorStatus: buildFloorStatus({
            table,
            reservations: tableReservations,
            locationSettings: selectedLocation.settings,
            selectedDate: selectedDateValue
          })
        };
      });

    return {
      ...zone,
      tables: sortTables(zoneTables)
    };
  });

  return {
    locations,
    selectedLocation,
    selectedDate,
    zones,
    reservations: normalizedReservations
  };
}

export async function getReservationCalendarPageData(user, options = {}) {
  const locations = await getAccessibleLocations(user);
  const selectedDate = options.dateText || getDateKey(new Date());
  const locationId = options.locationId || "";
  const { start, end } = getDayWindow(selectedDate);
  const reservations = await db.reservation.findMany({
    where: {
      ...reservationFilter(user),
      ...(locationId ? { locationId } : {}),
      dateTime: {
        gte: start,
        lte: end
      }
    },
    include: {
      location: {
        include: {
          technicalSettings: true,
          tables: true
        }
      },
      table: true
    },
    orderBy: [
      {
        dateTime: "asc"
      },
      {
        createdAt: "asc"
      }
    ]
  });

  const normalizedReservations = reservations.map((reservation) => ({
    ...reservation,
    locationName: publicLocationName(reservation.location),
    assignedTables: resolveAssignedTables(reservation, reservation.location.tables),
    assignedTableCodes: resolveAssignedTables(reservation, reservation.location.tables).map(
      (table) => table.code
    ),
    slotLabel: new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(reservation.dateTime))
  }));

  const groupedByLocation = locations.map((location) => ({
    ...location,
    reservations: normalizedReservations.filter(
      (reservation) => reservation.locationId === location.id
    )
  }));

  return {
    locations,
    selectedDate,
    selectedLocationId: locationId,
    groups: groupedByLocation.filter((group) =>
      locationId ? group.id === locationId : group.reservations.length > 0 || locations.length === 1
    )
  };
}

export async function getActivityLogPageData(user) {
  const where = logFilter(user);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [notificationLogs, auditLogs, stats] = await Promise.all([
    db.notificationLog.findMany({
      where,
      include: {
        location: {
          include: {
            technicalSettings: true
          }
        },
        reservation: true,
        waitlistEntry: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 80
    }),
    db.auditLog.findMany({
      where,
      include: {
        location: {
          include: {
            technicalSettings: true
          }
        },
        reservation: true,
        user: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 80
    }),
    Promise.all([
      db.notificationLog.count({
        where: {
          ...where,
          createdAt: {
            gte: since
          }
        }
      }),
      db.auditLog.count({
        where: {
          ...where,
          createdAt: {
            gte: since
          }
        }
      }),
      db.notificationLog.count({
        where: {
          ...where,
          status: "FAILED",
          createdAt: {
            gte: since
          }
        }
      })
    ])
  ]);

  return {
    notificationLogs: notificationLogs.map((item) => ({
      ...item,
      locationName: item.location ? publicLocationName(item.location) : "Sistema"
    })),
    auditLogs: auditLogs.map((item) => ({
      ...item,
      locationName: item.location ? publicLocationName(item.location) : "Sistema"
    })),
    stats: {
      notificationsLast24h: stats[0],
      auditLast24h: stats[1],
      failedNotificationsLast24h: stats[2]
    }
  };
}
