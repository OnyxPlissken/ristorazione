import { getCurrentUser } from "../../../../../lib/auth";
import { canAccessPage } from "../../../../../lib/permissions";
import { getAdminReservationLiveSummary } from "../../../../../lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  if (!canAccessPage(user, "reservations")) {
    return Response.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const summary = await getAdminReservationLiveSummary(user, {
    locationId: user.activeLocationId || ""
  });

  return Response.json(summary);
}
