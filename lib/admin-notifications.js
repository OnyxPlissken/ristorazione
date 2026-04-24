import { db } from "./db";
import { getAccessibleLocationIds } from "./permissions";

function buildAudienceWhereClause(user) {
  return {
    OR: [{ targetRoles: { isEmpty: true } }, { targetRoles: { has: user.role } }]
  };
}

function buildLocationWhereClause(user, locationId = "") {
  if (locationId) {
    return {
      OR: [{ locationId: null }, { locationId }]
    };
  }

  const locationIds = getAccessibleLocationIds(user);

  if (locationIds === null) {
    return {};
  }

  return {
    OR: [{ locationId: null }, { locationId: { in: locationIds } }]
  };
}

function buildNotificationWhere(user, locationId = "") {
  return {
    AND: [buildAudienceWhereClause(user), buildLocationWhereClause(user, locationId)]
  };
}

function normalizeNotification(item, userId) {
  const readRecord = item.reads?.find((read) => read.userId === userId) || null;

  return {
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    href: item.href || "/admin",
    createdAt: item.createdAt,
    locationId: item.locationId,
    locationName: item.location?.technicalSettings?.displayName || item.location?.name || "Sistema",
    unread: !readRecord,
    readAt: readRecord?.readAt || null
  };
}

export async function createAdminNotification({
  locationId = null,
  reservationId = null,
  waitlistEntryId = null,
  sessionId = null,
  type,
  title,
  body,
  href = null,
  targetRoles = [],
  metadata = null
}) {
  if (!type || !title || !body) {
    return null;
  }

  return db.adminNotification.create({
    data: {
      locationId,
      reservationId,
      waitlistEntryId,
      sessionId,
      type,
      title,
      body,
      href,
      targetRoles,
      metadata
    }
  });
}

export async function getAdminNotificationSummary(user, options = {}) {
  const limit = Number(options.limit || 10);
  const baseWhere = buildNotificationWhere(user, options.locationId || "");

  const [unreadCount, recentNotifications] = await Promise.all([
    db.adminNotification.count({
      where: {
        ...baseWhere,
        reads: {
          none: {
            userId: user.id
          }
        }
      }
    }),
    db.adminNotification.findMany({
      where: baseWhere,
      include: {
        location: {
          include: {
            technicalSettings: true
          }
        },
        reads: {
          where: {
            userId: user.id
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: limit
    })
  ]);

  return {
    unreadCount,
    recentNotifications: recentNotifications.map((item) =>
      normalizeNotification(item, user.id)
    )
  };
}

export async function markAdminNotificationRead(user, notificationId) {
  if (!notificationId) {
    return null;
  }

  const notification = await db.adminNotification.findFirst({
    where: {
      id: notificationId,
      ...buildNotificationWhere(user)
    }
  });

  if (!notification) {
    return null;
  }

  return db.adminNotificationRead.upsert({
    where: {
      notificationId_userId: {
        notificationId,
        userId: user.id
      }
    },
    update: {
      readAt: new Date()
    },
    create: {
      notificationId,
      userId: user.id
    }
  });
}

export async function markAllAdminNotificationsRead(user) {
  const notifications = await db.adminNotification.findMany({
    where: {
      ...buildNotificationWhere(user),
      reads: {
        none: {
          userId: user.id
        }
      }
    },
    select: {
      id: true
    },
    take: 200
  });

  if (notifications.length === 0) {
    return 0;
  }

  await db.adminNotificationRead.createMany({
    data: notifications.map((notification) => ({
      notificationId: notification.id,
      userId: user.id
    })),
    skipDuplicates: true
  });

  return notifications.length;
}
