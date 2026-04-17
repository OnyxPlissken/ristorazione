import { getAdminNotificationSummary } from "../../../../../lib/admin-notifications";
import { canViewAdmin, getCurrentUser } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  if (!canViewAdmin(user)) {
    return Response.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const summary = await getAdminNotificationSummary(user);
  return Response.json(summary);
}
