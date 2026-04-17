import {
  markAdminNotificationRead,
  markAllAdminNotificationsRead
} from "../../../../../lib/admin-notifications";
import { canViewAdmin, getCurrentUser } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  if (!canViewAdmin(user)) {
    return Response.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json().catch(() => ({}));

  if (payload?.all) {
    const updated = await markAllAdminNotificationsRead(user);
    return Response.json({ ok: true, updated });
  }

  if (!payload?.notificationId) {
    return Response.json({ error: "Notification id mancante" }, { status: 400 });
  }

  await markAdminNotificationRead(user, String(payload.notificationId));
  return Response.json({ ok: true });
}
