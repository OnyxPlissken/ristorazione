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

function publicLocationName(location) {
  return location.technicalSettings?.displayName || location.name;
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
      where: {
        locationId: {
          in: locationIds
        }
      }
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
  const locations = await db.location.findMany({
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
      menus: {
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
  });

  return locations.map(normalizeLocation);
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

export async function getTableSessionPageData(tableId) {
  const table = await db.diningTable.findUnique({
    where: {
      id: tableId
    },
    include: {
      zoneRecord: true,
      location: {
        include: {
          technicalSettings: true,
          menus: {
            where: {
              isActive: true
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
          }
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
