import { db } from "./db";
import { getAccessibleLocationIds } from "./permissions";

function buildAccessibleLocationWhere(user) {
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

function buildAccessibleReservationWhere(user) {
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

export async function runAdminGlobalSearch(user, query) {
  const normalizedQuery = String(query || "").trim();

  if (!normalizedQuery) {
    return {
      reservations: [],
      customers: [],
      locations: [],
      menus: [],
      tables: []
    };
  }

  const contains = {
    contains: normalizedQuery,
    mode: "insensitive"
  };
  const locationWhere = buildAccessibleLocationWhere(user);
  const reservationWhere = buildAccessibleReservationWhere(user);

  const [reservations, customers, locations, menus, tables] = await Promise.all([
    db.reservation.findMany({
      where: {
        ...reservationWhere,
        OR: [
          { guestName: contains },
          { guestEmail: contains },
          { guestPhone: contains }
        ]
      },
      include: {
        location: {
          include: {
            technicalSettings: true
          }
        }
      },
      orderBy: {
        dateTime: "desc"
      },
      take: 6
    }),
    db.customerProfile.findMany({
      where: {
        archivedAt: null,
        OR: [
          {
            reservations: {
              some: reservationWhere
            }
          },
          {
            waitlistEntries: {
              some: {
                archivedAt: null,
                ...(getAccessibleLocationIds(user) === null
                  ? {}
                  : {
                      locationId: {
                        in: getAccessibleLocationIds(user)
                      }
                    })
              }
            }
          }
        ],
        AND: [
          {
            OR: [
              { displayName: contains },
              { normalizedEmail: contains },
              { normalizedPhone: contains }
            ]
          }
        ]
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 6
    }),
    db.location.findMany({
      where: {
        ...locationWhere,
        OR: [{ name: contains }, { city: contains }, { address: contains }]
      },
      orderBy: {
        name: "asc"
      },
      take: 5
    }),
    db.menu.findMany({
      where: {
        archivedAt: null,
        OR: [{ name: contains }, { description: contains }],
        location: locationWhere
      },
      include: {
        location: true
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 6
    }),
    db.diningTable.findMany({
      where: {
        archivedAt: null,
        OR: [{ code: contains }, { zone: contains }],
        location: locationWhere
      },
      include: {
        location: true,
        zoneRecord: true
      },
      orderBy: {
        code: "asc"
      },
      take: 6
    })
  ]);

  return {
    reservations: reservations.map((item) => ({
      id: item.id,
      title: item.guestName,
      subtitle: `${item.location?.technicalSettings?.displayName || item.location?.name || "Sede"} / ${item.status}`,
      href: `/admin/prenotazioni?reservationId=${item.id}`
    })),
    customers: customers.map((item) => ({
      id: item.id,
      title: item.displayName,
      subtitle: item.normalizedEmail || item.normalizedPhone || "CRM",
      href: `/admin/clienti?customerId=${item.id}`
    })),
    locations: locations.map((item) => ({
      id: item.id,
      title: item.name,
      subtitle: `${item.city} / ${item.address}`,
      href: `/admin/sedi?locationId=${item.id}`
    })),
    menus: menus.map((item) => ({
      id: item.id,
      title: item.name,
      subtitle: item.location?.name || "Menu",
      href: `/admin/menu?menuId=${item.id}`
    })),
    tables: tables.map((item) => ({
      id: item.id,
      title: item.code,
      subtitle: `${item.location?.name || "Sede"} / ${item.zoneRecord?.name || item.zone || "Sala"}`,
      href: `/admin/tavoli?locationId=${item.locationId}`
    }))
  };
}
