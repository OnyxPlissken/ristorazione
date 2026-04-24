import { db } from "./db";
import { naturalCompare } from "./format";
import { getAccessibleLocationIds } from "./permissions";
import { getDateKey, getReservationWindow } from "./reservations";

function locationFilter(user) {
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

function reservationFilter(user) {
  const ids = getAccessibleLocationIds(user);

  if (ids === null) {
    return {
      archivedAt: null
    };
  }

  return {
    archivedAt: null,
    locationId: {
      in: ids
    }
  };
}

function waitlistFilter(user) {
  const ids = getAccessibleLocationIds(user);

  if (ids === null) {
    return {
      archivedAt: null
    };
  }

  return {
    archivedAt: null,
    locationId: {
      in: ids
    }
  };
}

function menuFilter(user) {
  const ids = getAccessibleLocationIds(user);

  if (ids === null) {
    return {
      archivedAt: null
    };
  }

  return {
    archivedAt: null,
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

function scopedWhere(user, field = "locationId") {
  const ids = getAccessibleLocationIds(user);

  if (ids === null) {
    return {};
  }

  return {
    [field]: {
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
    zones: location.zones ? sortZones(location.zones.filter((zone) => zone.active !== false)) : [],
    tables: location.tables
      ? sortTables(location.tables.filter((table) => !table.archivedAt))
      : [],
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

function numberValue(value) {
  return Number(value || 0);
}

function buildCustomerProfileSummary(reservation) {
  const profile = reservation.customerProfile;

  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    band: reservation.customerBand || profile.band,
    priorityScore: reservation.customerPriorityScore || profile.priorityScore || 0,
    completedReservations: profile.completedReservations || 0,
    cancelledReservations: profile.cancelledReservations || 0,
    noShowCount: profile.noShowCount || 0,
    averageSpend: numberValue(profile.averageSpend),
    totalSpend: numberValue(profile.totalSpend),
    reliabilityScore: profile.reliabilityScore || 0,
    frequencyScore: profile.frequencyScore || 0,
    valueScore: profile.valueScore || 0
  };
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
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    tables,
    reservations,
    menus,
    users,
    qrSessions,
    waitlistOpen,
    noShowLast30,
    completedLast30,
    highValueCustomers
  ] = await Promise.all([
    db.diningTable.count({
      where: {
        locationId: {
          in: locationIds
        },
        archivedAt: null
      }
    }),
    db.reservation.count({
      where: {
        locationId: {
          in: locationIds
        },
        archivedAt: null
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
    }),
    db.waitlistEntry.count({
      where: {
        locationId: {
          in: locationIds
        },
        status: "OPEN",
        archivedAt: null
      }
    }),
    db.reservation.count({
      where: {
        locationId: {
          in: locationIds
        },
        archivedAt: null,
        status: "NO_SHOW",
        dateTime: {
          gte: last30Days
        }
      }
    }),
    db.reservation.count({
      where: {
        locationId: {
          in: locationIds
        },
        archivedAt: null,
        status: "COMPLETATA",
        dateTime: {
          gte: last30Days
        }
      }
    }),
    db.customerProfile.count({
      where: {
        archivedAt: null,
        band: "A",
        reservations: {
          some: reservationFilter(user)
        }
      }
    })
  ]);

  const upcomingReservations = await db.reservation.findMany({
    where: {
      locationId: {
        in: locationIds
      },
      archivedAt: null,
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
      qrSessions,
      waitlistOpen,
      highValueCustomers
    },
    insights: {
      noShowRateLast30:
        completedLast30 + noShowLast30 > 0
          ? Math.round((noShowLast30 / (completedLast30 + noShowLast30)) * 100)
          : 0
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
          where: {
            archivedAt: null
          },
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
          where: {
            archivedAt: null
          },
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

export async function getAccessibleLocationModules(user) {
  return db.location.findMany({
    where: locationFilter(user),
    select: {
      id: true,
      name: true,
      reservationEnabled: true,
      technicalSettings: {
        select: {
          qrEnabled: true,
          reservationsEnabled: true,
          slotOptimizationEnabled: true,
          smartWaitlistEnabled: true,
          customerScoringEnabled: true,
          adaptiveDepositEnabled: true,
          customerTableSelectionEnabled: true,
          deliveryEnabled: true,
          paymentsEnabled: true,
          googleBusinessEnabled: true,
          smsEnabled: true
        }
      }
    },
    orderBy: {
      name: "asc"
    }
  });
}

export async function getAdminConsoleLocations() {
  const locations = await db.location.findMany({
    where: {
      archivedAt: null
    },
    include: {
      technicalSettings: true,
      tables: {
        where: {
          archivedAt: null
        },
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
    where: {
      archivedAt: null
    },
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
              active: true,
              archivedAt: null
            },
            include: {
              zoneRecord: true
            }
          }
        }
      },
      table: true,
      customerProfile: true,
      paymentRequests: {
        orderBy: {
          createdAt: "desc"
        },
        take: 3
      }
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
      assignedTableCodes: assignedTables.map((table) => table.code),
      spendAmount: numberValue(reservation.spendAmount),
      depositAmount: reservation.depositAmount ? numberValue(reservation.depositAmount) : null,
      customerProfileSummary: buildCustomerProfileSummary(reservation)
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
      reservationEnabled: true,
      archivedAt: null
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
      manageToken: token,
      archivedAt: null
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
      table: true,
      customerProfile: true,
      paymentRequests: {
        orderBy: {
          createdAt: "desc"
        },
        take: 5
      }
    }
  });

  if (!reservation) {
    return null;
  }

  return {
    ...reservation,
    locationName: publicLocationName(reservation.location),
    spendAmount: numberValue(reservation.spendAmount),
    depositAmount: reservation.depositAmount ? numberValue(reservation.depositAmount) : null,
    customerProfileSummary: buildCustomerProfileSummary(reservation)
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

  if (!table || !table.active || table.archivedAt) {
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
      archivedAt: null,
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
      archivedAt: null,
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
          tables: {
            where: {
              archivedAt: null
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
  const [notificationLogs, notificationJobs, auditLogs, stats] = await Promise.all([
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
      take: 200
    }),
    db.notificationJob.findMany({
      where,
      include: {
        location: {
          include: {
            technicalSettings: true
          }
        },
        reservation: true,
        paymentRequest: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 120
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
      take: 200
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
      }),
      db.waitlistEntry.count({
        where: {
          ...waitlistFilter(user),
          status: "OPEN"
        }
      }),
      db.waitlistEntry.count({
        where: {
          ...waitlistFilter(user),
          status: "CONVERTED",
          notifiedAt: {
            gte: since
          }
        }
      }),
      db.notificationJob.count({
        where: {
          ...where,
          status: {
            in: ["PENDING", "RETRYING", "PROCESSING"]
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
    notificationJobs: notificationJobs.map((item) => ({
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
      failedNotificationsLast24h: stats[2],
      waitlistOpen: stats[3],
      waitlistConvertedLast24h: stats[4],
      queuedNotifications: stats[5]
    }
  };
}

export async function getAnalyticsPageData(user) {
  const [locations, reservations, waitlistEntries, customerProfiles, posTransactions] = await Promise.all([
    db.location.findMany({
      where: locationFilter(user),
      include: {
        technicalSettings: true,
        tables: {
          where: {
            archivedAt: null,
            active: true
          },
          select: {
            id: true,
            code: true,
            seats: true
          }
        }
      },
      orderBy: {
        name: "asc"
      }
    }),
    db.reservation.findMany({
      where: reservationFilter(user),
      include: {
        location: {
          include: {
            technicalSettings: true
          }
        },
        customerProfile: true
      },
      orderBy: {
        dateTime: "desc"
      }
    }),
    db.waitlistEntry.findMany({
      where: waitlistFilter(user),
      include: {
        location: {
          include: {
            technicalSettings: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    db.customerProfile.findMany({
      where: {
        archivedAt: null,
        reservations: {
          some: reservationFilter(user)
        }
      },
      orderBy: [
        {
          priorityScore: "desc"
        },
        {
          completedReservations: "desc"
        }
      ]
    }),
    db.posTransaction.findMany({
      where: scopedWhere(user, "locationId"),
      orderBy: {
        occurredAt: "desc"
      }
    })
  ]);

  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const last90Days = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const recentReservations = reservations.filter(
    (reservation) =>
      new Date(reservation.dateTime) >= last90Days &&
      new Date(reservation.dateTime) <= now
  );
  const last30Reservations = reservations.filter(
    (reservation) =>
      new Date(reservation.dateTime) >= last30Days &&
      new Date(reservation.dateTime) <= now
  );
  const completedReservations = recentReservations.filter(
    (reservation) => reservation.status === "COMPLETATA"
  );
  const noShowReservations = recentReservations.filter(
    (reservation) => reservation.status === "NO_SHOW"
  );
  const cancelledReservations = recentReservations.filter(
    (reservation) => reservation.status === "CANCELLATA"
  );
  const pendingReservations = reservations.filter(
    (reservation) => reservation.status === "IN_ATTESA"
  );
  const totalSeatCount = locations.reduce(
    (sum, location) => sum + (location.tables || []).reduce((sub, table) => sub + table.seats, 0),
    0
  );
  const totalSpend = completedReservations.reduce(
    (sum, reservation) => sum + numberValue(reservation.spendAmount),
    0
  );
  const avgSpend =
    completedReservations.length > 0 ? totalSpend / completedReservations.length : 0;
  const avgGuests =
    recentReservations.length > 0
      ? recentReservations.reduce((sum, reservation) => sum + reservation.guests, 0) /
        recentReservations.length
      : 0;

  const slotMap = new Map();
  const revenueByTableMap = new Map();
  const recoveredWaitlistEntries = waitlistEntries.filter(
    (entry) =>
      entry.status === "CONVERTED" &&
      entry.notifiedAt &&
      new Date(entry.notifiedAt) >= last30Days
  );
  const noShowAvoidedReservations = last30Reservations.filter(
    (reservation) =>
      reservation.status === "COMPLETATA" &&
      (reservation.depositRequired || reservation.customerBand === "D" || reservation.customerPriorityScore >= 80)
  );

  for (const reservation of last30Reservations) {
    const hourLabel = new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(reservation.dateTime));
    const current = slotMap.get(hourLabel) || {
      label: hourLabel,
      reservations: 0,
      completed: 0,
      noShow: 0,
      covers: 0,
      revenue: 0
    };

    current.reservations += 1;
    current.completed += reservation.status === "COMPLETATA" ? 1 : 0;
    current.noShow += reservation.status === "NO_SHOW" ? 1 : 0;
    current.covers += reservation.guests;
    current.revenue += numberValue(reservation.spendAmount);
    slotMap.set(hourLabel, current);

    if (reservation.status === "COMPLETATA") {
      const tableCode = getAssignedTableIds(reservation)[0] || "AUTO";
      const currentTable = revenueByTableMap.get(tableCode) || {
        label: tableCode,
        revenue: 0,
        reservations: 0
      };

      currentTable.revenue += numberValue(reservation.spendAmount);
      currentTable.reservations += 1;
      revenueByTableMap.set(tableCode, currentTable);
    }
  }

  const locationStats = locations.map((location) => {
    const locationReservations = reservations.filter(
      (reservation) => reservation.locationId === location.id
    );
    const locationWaitlist = waitlistEntries.filter(
      (entry) => entry.locationId === location.id
    );

    return {
      id: location.id,
      name: publicLocationName(location),
      reservations: locationReservations.length,
      pending: locationReservations.filter((reservation) => reservation.status === "IN_ATTESA").length,
      noShow: locationReservations.filter((reservation) => reservation.status === "NO_SHOW").length,
      waitlistOpen: locationWaitlist.filter((entry) => entry.status === "OPEN").length,
      revenue: locationReservations
        .filter((reservation) => reservation.status === "COMPLETATA")
        .reduce((sum, reservation) => sum + numberValue(reservation.spendAmount), 0)
    };
  });

  return {
    stats: {
      reservationsLast90d: recentReservations.length,
      completedLast90d: completedReservations.length,
      cancelledLast90d: cancelledReservations.length,
      noShowLast90d: noShowReservations.length,
      noShowRateLast90d:
        completedReservations.length + noShowReservations.length > 0
          ? Math.round(
              (noShowReservations.length /
                (completedReservations.length + noShowReservations.length)) *
                100
            )
          : 0,
      pendingReservations: pendingReservations.length,
      waitlistOpen: waitlistEntries.filter((entry) => entry.status === "OPEN").length,
      waitlistConvertedLast30d: recoveredWaitlistEntries.length,
      noShowAvoidedLast30d: noShowAvoidedReservations.length,
      recoveredCoversLast30d: recoveredWaitlistEntries.reduce(
        (sum, entry) => sum + entry.guests,
        0
      ),
      occupancySeatBase: totalSeatCount,
      posTransactionsLast90d: posTransactions.filter(
        (item) => new Date(item.occurredAt) >= last90Days
      ).length,
      avgSpend,
      avgGuests,
      highValueCustomers: customerProfiles.filter((profile) => profile.band === "A").length,
      riskCustomers: customerProfiles.filter((profile) => profile.band === "D").length
    },
    slotPerformance: [...slotMap.values()]
      .map((slot) => ({
        ...slot,
        occupancyRate: totalSeatCount > 0 ? Math.round((slot.covers / totalSeatCount) * 100) : 0
      }))
      .sort((left, right) => left.label.localeCompare(right.label, "it"))
      .slice(0, 12),
    tableRevenue: [...revenueByTableMap.values()]
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 12),
    topCustomers: customerProfiles.slice(0, 8).map((profile) => ({
      id: profile.id,
      displayName: profile.displayName,
      band: profile.band,
      priorityScore: profile.priorityScore,
      averageSpend: numberValue(profile.averageSpend),
      totalSpend: numberValue(profile.totalSpend),
      completedReservations: profile.completedReservations,
      noShowCount: profile.noShowCount,
      vip: Boolean(profile.vip)
    })),
    locations: locationStats
  };
}

export async function getCustomerCrmPageData(user) {
  const [profiles] = await Promise.all([
    db.customerProfile.findMany({
      where: {
        archivedAt: null,
        OR: [
          {
            reservations: {
              some: reservationFilter(user)
            }
          },
          {
            waitlistEntries: {
              some: waitlistFilter(user)
            }
          }
        ]
      },
      include: {
        reservations: {
          where: reservationFilter(user),
          include: {
            location: {
              include: {
                technicalSettings: true,
                tables: true
              }
            },
            table: true
          },
          orderBy: {
            dateTime: "desc"
          },
          take: 8
        },
        waitlistEntries: {
          where: waitlistFilter(user),
          include: {
            location: {
              include: {
                technicalSettings: true
              }
            }
          },
          orderBy: {
            preferredDateTime: "desc"
          },
          take: 6
        }
      },
      orderBy: [
        {
          priorityScore: "desc"
        },
        {
          updatedAt: "desc"
        }
      ]
    })
  ]);

  const normalizedProfiles = profiles.map((profile) => {
    const type = profile.completedReservations > 0 ? "CLIENTE" : "PROSPECT";
    const latestReservation = profile.reservations[0] || null;
    const latestWaitlist = profile.waitlistEntries[0] || null;
    const lastTouchAt =
      latestReservation?.dateTime ||
      latestWaitlist?.preferredDateTime ||
      profile.lastReservationAt ||
      profile.updatedAt;
    const activeReservations = profile.reservations.filter((reservation) =>
      ["IN_ATTESA", "CONFERMATA", "IN_CORSO"].includes(reservation.status)
    );
    const openWaitlist = profile.waitlistEntries.filter((entry) => entry.status === "OPEN");
    const locations = [
      ...new Map(
        [
          ...profile.reservations.map((reservation) => ({
            id: reservation.locationId,
            name: publicLocationName(reservation.location)
          })),
          ...profile.waitlistEntries.map((entry) => ({
            id: entry.locationId,
            name: publicLocationName(entry.location)
          }))
        ].map((item) => [item.id, item])
      ).values()
    ];

    return {
      id: profile.id,
      displayName: profile.displayName,
      normalizedEmail: profile.normalizedEmail,
      normalizedPhone: profile.normalizedPhone,
      type,
      band: profile.band,
      vip: Boolean(profile.vip),
      birthDate: profile.birthDate,
      tags: profile.tags || [],
      notes: profile.notes || "",
      priorityScore: profile.priorityScore,
      reliabilityScore: profile.reliabilityScore,
      frequencyScore: profile.frequencyScore,
      valueScore: profile.valueScore,
      visitCount: profile.visitCount,
      completedReservations: profile.completedReservations,
      cancelledReservations: profile.cancelledReservations,
      noShowCount: profile.noShowCount,
      waitlistCount: profile.waitlistCount,
      totalSpend: numberValue(profile.totalSpend),
      averageSpend: numberValue(profile.averageSpend),
      firstSeenAt: profile.firstSeenAt,
      lastReservationAt: profile.lastReservationAt,
      lastCompletedAt: profile.lastCompletedAt,
      updatedAt: profile.updatedAt,
      lastTouchAt,
      activeReservationsCount: activeReservations.length,
      openWaitlistCount: openWaitlist.length,
      locations,
      reservations: profile.reservations.map((reservation) => ({
        id: reservation.id,
        dateTime: reservation.dateTime,
        status: reservation.status,
        guests: reservation.guests,
        locationName: publicLocationName(reservation.location),
        assignedTableCodes: resolveAssignedTables(
          reservation,
          reservation.location.tables || []
        ).map((table) => table.code),
        spendAmount: numberValue(reservation.spendAmount)
      })),
      waitlistEntries: profile.waitlistEntries.map((entry) => ({
        id: entry.id,
        preferredDateTime: entry.preferredDateTime,
        status: entry.status,
        guests: entry.guests,
        locationName: publicLocationName(entry.location),
        priorityScore: entry.priorityScore
      }))
    };
  });

  return {
    profiles: normalizedProfiles,
    stats: {
      total: normalizedProfiles.length,
      clienti: normalizedProfiles.filter((profile) => profile.type === "CLIENTE").length,
      prospect: normalizedProfiles.filter((profile) => profile.type === "PROSPECT").length,
      highValue: normalizedProfiles.filter((profile) => profile.band === "A").length,
      risk: normalizedProfiles.filter((profile) => profile.band === "D").length
    }
  };
}
