import { db } from "./db";
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

export async function getAdminDashboardData(user) {
  const whereLocation = locationFilter(user);
  const locations = await db.location.findMany({
    where: whereLocation,
    orderBy: { name: "asc" }
  });

  const locationIds = locations.map((item) => item.id);

  const [tables, reservations, menus, users] = await Promise.all([
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
    db.user.count()
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
      location: true,
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
      users
    },
    upcomingReservations
  };
}

export async function getAccessibleLocations(user) {
  return db.location.findMany({
    where: locationFilter(user),
    include: {
      settings: true,
      openingHours: {
        orderBy: {
          weekday: "asc"
        }
      },
      tables: {
        orderBy: {
          code: "asc"
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
}

export async function getUsersWithLocations() {
  return db.user.findMany({
    include: {
      locationAccess: {
        include: {
          location: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });
}

export async function getPublicReservationData() {
  return db.location.findMany({
    where: {
      reservationEnabled: true
    },
    include: {
      settings: true,
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
}
