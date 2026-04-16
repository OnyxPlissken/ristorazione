import { db } from "../../../../lib/db";
import { getSlotAvailability } from "../../../../lib/reservations";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId") || "";
  const date = searchParams.get("date") || "";
  const guests = Number(searchParams.get("guests") || 2);
  const reservationToken = searchParams.get("reservationToken") || "";

  if (!locationId || !date || Number.isNaN(guests)) {
    return Response.json(
      {
        error: "Parametri non validi."
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
        openingHours: true,
        openingExceptions: true
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

  const slots = await getSlotAvailability({
    location,
    dateText: date,
    guests,
    excludeReservationId:
      reservation && reservation.locationId === locationId ? reservation.id : null
  });

  return Response.json({
    useTimeSlots: location.settings?.useTimeSlots ?? true,
    slots
  });
}
