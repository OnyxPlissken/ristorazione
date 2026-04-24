import { db } from "./db";
import { createAuditLog } from "./audit";

function plainDate(value) {
  if (!value) {
    return null;
  }

  return new Date(value);
}

export async function createLocationConfigSnapshot(user, locationId, name = "") {
  const location = await db.location.findUnique({
    where: {
      id: locationId
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
        orderBy: {
          date: "asc"
        }
      },
      zones: {
        orderBy: {
          sortOrder: "asc"
        }
      },
      tables: {
        orderBy: {
          code: "asc"
        }
      },
      menus: {
        where: {
          archivedAt: null
        },
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
      }
    }
  });

  if (!location) {
    throw new Error("Sede non trovata.");
  }

  const payload = {
    location: {
      name: location.name,
      slug: location.slug,
      address: location.address,
      city: location.city,
      phone: location.phone,
      email: location.email,
      reservationEnabled: location.reservationEnabled
    },
    settings: location.settings,
    technicalSettings: location.technicalSettings,
    openingHours: location.openingHours,
    openingExceptions: location.openingExceptions,
    zones: location.zones,
    tables: location.tables.map((table) => ({
      code: table.code,
      seats: table.seats,
      zoneName: table.zoneRecord?.name || table.zone || null,
      layoutX: table.layoutX,
      layoutY: table.layoutY,
      layoutWidth: table.layoutWidth,
      layoutHeight: table.layoutHeight,
      layoutRotation: table.layoutRotation,
      layoutShape: table.layoutShape,
      combinableWithCodes: table.combinableWithIds
    })),
    menus: location.menus.map((menu) => ({
      name: menu.name,
      description: menu.description,
      isActive: menu.isActive,
      deliveryEnabled: menu.deliveryEnabled,
      appliesToAllLocations: menu.appliesToAllLocations,
      locationIds: menu.locationIds,
      sections: menu.sections.map((section) => ({
        name: section.name,
        sortOrder: section.sortOrder,
        items: section.items.map((item) => ({
          name: item.name,
          description: item.description,
          imageUrl: item.imageUrl,
          price: Number(item.price),
          allergens: item.allergens,
          available: item.available,
          sortOrder: item.sortOrder
        }))
      }))
    }))
  };

  const snapshot = await db.backupSnapshot.create({
    data: {
      locationId,
      createdById: user?.id || null,
      kind: "CONFIG",
      name: name || `Backup configurazione ${location.name}`,
      payload
    }
  });

  await createAuditLog({
    userId: user?.id || null,
    locationId,
    entityType: "backup_snapshot",
    entityId: snapshot.id,
    action: "BACKUP_CREATED",
    summary: `Backup configurazione creato: ${snapshot.name}`,
    metadata: {
      kind: snapshot.kind
    }
  });

  return snapshot;
}

export async function restoreLocationConfigSnapshot(user, snapshotId) {
  const snapshot = await db.backupSnapshot.findUnique({
    where: {
      id: snapshotId
    }
  });

  if (!snapshot?.locationId || snapshot.kind !== "CONFIG") {
    throw new Error("Backup non valido per il restore.");
  }

  const payload = snapshot.payload || {};
  const locationId = snapshot.locationId;

  await db.$transaction(async (tx) => {
    if (payload.location) {
      await tx.location.update({
        where: {
          id: locationId
        },
        data: payload.location
      });
    }

    if (payload.settings) {
      const { id: _id, locationId: _locationId, ...settings } = payload.settings;
      await tx.reservationSetting.upsert({
        where: {
          locationId
        },
        update: settings,
        create: {
          locationId,
          ...settings
        }
      });
    }

    if (payload.technicalSettings) {
      const { id: _id, locationId: _locationId, createdAt: _createdAt, updatedAt: _updatedAt, ...technicalSettings } =
        payload.technicalSettings;
      await tx.locationTechnicalSetting.upsert({
        where: {
          locationId
        },
        update: technicalSettings,
        create: {
          locationId,
          ...technicalSettings
        }
      });
    }

    await tx.openingHour.deleteMany({
      where: {
        locationId
      }
    });
    await tx.openingHour.createMany({
      data: (payload.openingHours || []).map((item) => ({
        locationId,
        weekday: item.weekday,
        opensAt: item.opensAt,
        closesAt: item.closesAt,
        isClosed: item.isClosed
      })),
      skipDuplicates: true
    });

    await tx.openingHourException.deleteMany({
      where: {
        locationId
      }
    });
    for (const exception of payload.openingExceptions || []) {
      await tx.openingHourException.create({
        data: {
          locationId,
          date: plainDate(exception.date),
          opensAt: exception.opensAt,
          closesAt: exception.closesAt,
          isClosed: exception.isClosed,
          note: exception.note
        }
      });
    }

    const zoneMap = new Map();

    for (const zone of payload.zones || []) {
      const record = await tx.locationZone.upsert({
        where: {
          locationId_name: {
            locationId,
            name: zone.name
          }
        },
        update: {
          sortOrder: zone.sortOrder,
          active: zone.active
        },
        create: {
          locationId,
          name: zone.name,
          sortOrder: zone.sortOrder,
          active: zone.active
        }
      });

      zoneMap.set(zone.name, record.id);
    }

    for (const table of payload.tables || []) {
      await tx.diningTable.upsert({
        where: {
          locationId_code: {
            locationId,
            code: table.code
          }
        },
        update: {
          seats: table.seats,
          zoneId: table.zoneName ? zoneMap.get(table.zoneName) || null : null,
          zone: table.zoneName,
          layoutX: table.layoutX,
          layoutY: table.layoutY,
          layoutWidth: table.layoutWidth,
          layoutHeight: table.layoutHeight,
          layoutRotation: table.layoutRotation,
          layoutShape: table.layoutShape,
          active: true,
          archivedAt: null,
          archiveReason: null
        },
        create: {
          locationId,
          code: table.code,
          seats: table.seats,
          zoneId: table.zoneName ? zoneMap.get(table.zoneName) || null : null,
          zone: table.zoneName,
          layoutX: table.layoutX,
          layoutY: table.layoutY,
          layoutWidth: table.layoutWidth,
          layoutHeight: table.layoutHeight,
          layoutRotation: table.layoutRotation,
          layoutShape: table.layoutShape,
          active: true
        }
      });
    }

    await tx.menu.updateMany({
      where: {
        locationId,
        archivedAt: null
      },
      data: {
        archivedAt: new Date(),
        archiveReason: `Sostituito da restore ${snapshot.id}`
      }
    });

    for (const menu of payload.menus || []) {
      await tx.menu.create({
        data: {
          locationId,
          name: menu.name,
          description: menu.description,
          isActive: menu.isActive,
          deliveryEnabled: menu.deliveryEnabled,
          appliesToAllLocations: menu.appliesToAllLocations,
          locationIds: menu.locationIds || [],
          sections: {
            create: (menu.sections || []).map((section) => ({
              name: section.name,
              sortOrder: section.sortOrder,
              items: {
                create: (section.items || []).map((item) => ({
                  name: item.name,
                  description: item.description,
                  imageUrl: item.imageUrl,
                  price: item.price,
                  allergens: item.allergens,
                  available: item.available,
                  sortOrder: item.sortOrder
                }))
              }
            }))
          }
        }
      });
    }
  });

  await createAuditLog({
    userId: user?.id || null,
    locationId,
    entityType: "backup_snapshot",
    entityId: snapshot.id,
    action: "BACKUP_RESTORED",
    summary: `Backup ripristinato: ${snapshot.name}`,
    metadata: {
      kind: snapshot.kind
    }
  });

  return snapshot;
}
