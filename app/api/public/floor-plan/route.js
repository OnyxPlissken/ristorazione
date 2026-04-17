import { db } from "../../../../lib/db";
import { buildFloorPlanZones, resolveTableLayout } from "../../../../lib/floor-plan";
import { getFloorPlanAvailability } from "../../../../lib/reservations";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId") || "";
  const dateTimeText = searchParams.get("dateTime") || "";
  const guests = Number(searchParams.get("guests") || 2);
  const reservationToken = searchParams.get("reservationToken") || "";

  if (!locationId || !dateTimeText || Number.isNaN(guests)) {
    return Response.json(
      {
        error: "Parametri non validi."
      },
      { status: 400 }
    );
  }

  const dateTime = new Date(dateTimeText);

  if (Number.isNaN(dateTime.getTime())) {
    return Response.json(
      {
        error: "Data o orario non validi."
      },
      { status: 400 }
    );
  }

  const [location, reservation] = await Promise.all([
    db.location.findUnique({
      where: {
        id: locationId
      },
      include: {
        settings: true,
        technicalSettings: true,
        zones: {
          orderBy: {
            sortOrder: "asc"
          }
        },
        tables: {
          where: {
            active: true
          },
          include: {
            zoneRecord: true
          },
          orderBy: {
            code: "asc"
          }
        }
      }
    }),
    reservationToken
      ? db.reservation.findFirst({
          where: {
            manageToken: reservationToken
          },
          select: {
            id: true,
            locationId: true
          }
        })
      : null
  ]);

  if (!location) {
    return Response.json(
      {
        error: "Sede non trovata."
      },
      { status: 404 }
    );
  }

  const selectionEnabled = Boolean(
    location.technicalSettings?.customerTableSelectionEnabled
  );

  if (!selectionEnabled) {
    return Response.json({
      enabled: false,
      zones: []
    });
  }

  const availability = await getFloorPlanAvailability({
    location,
    guests,
    dateTime,
    excludeReservationId:
      reservation && reservation.locationId === locationId ? reservation.id : null
  });
  const tableMap = new Map(availability.tables.map((table) => [table.id, table]));
  const zones = buildFloorPlanZones({
    ...location,
    tables: availability.tables
  }).map((zone) => ({
    id: zone.id,
    name: zone.name,
    tables: zone.tables.map((table, index) => {
      const source = tableMap.get(table.id) || table;
      return {
        id: source.id,
        code: source.code,
        seats: source.seats,
        available: Boolean(source.available),
        selectable: Boolean(source.selectable),
        occupied: Boolean(source.occupied),
        ...resolveTableLayout(source, index)
      };
    })
  }));

  return Response.json({
    enabled: true,
    zones
  });
}
