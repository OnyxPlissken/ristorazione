import { canViewAdmin, getCurrentUser } from "../../../../lib/auth";
import {
  processDueNotificationJobs,
  queueCustomerBirthdayNotifications
} from "../../../../lib/notifications";
import { expireStalePaymentRequests } from "../../../../lib/payments";

export const dynamic = "force-dynamic";

function isAuthorized(request, user) {
  const configuredSecret = process.env.CRON_SECRET || "";

  if (configuredSecret) {
    const incoming =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    return incoming === configuredSecret;
  }

  return Boolean(user && canViewAdmin(user));
}

export async function GET(request) {
  const user = await getCurrentUser();

  if (!isAuthorized(request, user)) {
    return Response.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const [notifications, birthdays, expiredPayments] = await Promise.all([
    processDueNotificationJobs(),
    queueCustomerBirthdayNotifications(),
    expireStalePaymentRequests()
  ]);

  return Response.json({
    ok: true,
    notifications,
    birthdays,
    expiredPayments
  });
}
