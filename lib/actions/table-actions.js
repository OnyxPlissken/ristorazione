"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";

async function loadSession(sessionId) {
  return db.tableSession.findUnique({
    where: {
      id: sessionId
    },
    include: {
      table: true,
      location: {
        include: {
          technicalSettings: true
        }
      }
    }
  });
}

function revalidateTableSession(session) {
  revalidatePath(`/table/${session.tableId}`);
  revalidatePath("/table/[tableId]", "page");
  revalidatePath("/admin/tavoli");
}

export async function addTableSessionItemAction(payload) {
  const sessionId = String(payload.get("sessionId") || "");
  const seatId = String(payload.get("seatId") || "");
  const menuItemId = String(payload.get("menuItemId") || "");

  if (!sessionId || !seatId || !menuItemId) {
    return;
  }

  const [session, seat, menuItem] = await Promise.all([
    loadSession(sessionId),
    db.tableSessionSeat.findUnique({
      where: {
        id: seatId
      }
    }),
    db.menuItem.findUnique({
      where: {
        id: menuItemId
      },
      include: {
        section: {
          include: {
            menu: true
          }
        }
      }
    })
  ]);

  if (
    !session ||
    !seat ||
    !menuItem ||
    session.status !== "OPEN" ||
    seat.sessionId !== session.id ||
    menuItem.section.menu.locationId !== session.locationId ||
    !session.location.technicalSettings?.qrEnabled
  ) {
    return;
  }

  const existing = await db.tableSessionItem.findFirst({
    where: {
      sessionId,
      seatId,
      menuItemId,
      note: null
    }
  });

  if (existing) {
    await db.tableSessionItem.update({
      where: {
        id: existing.id
      },
      data: {
        quantity: {
          increment: 1
        }
      }
    });
  } else {
    await db.tableSessionItem.create({
      data: {
        sessionId,
        seatId,
        menuItemId,
        name: menuItem.name,
        unitPrice: menuItem.price,
        quantity: 1
      }
    });
  }

  revalidateTableSession(session);
}

export async function updateTableSessionItemQuantityAction(payload) {
  const itemId = String(payload.get("itemId") || "");
  const delta = Number(payload.get("delta") || 0);

  if (!itemId || !Number.isFinite(delta) || delta === 0) {
    return;
  }

  const item = await db.tableSessionItem.findUnique({
    where: {
      id: itemId
    },
    include: {
      session: {
        include: {
          table: true,
          location: {
            include: {
              technicalSettings: true
            }
          }
        }
      }
    }
  });

  if (
    !item ||
    item.session.status !== "OPEN" ||
    !item.session.location.technicalSettings?.qrEnabled
  ) {
    return;
  }

  const nextQuantity = item.quantity + delta;

  if (nextQuantity <= 0) {
    await db.tableSessionItem.delete({
      where: {
        id: itemId
      }
    });
  } else {
    await db.tableSessionItem.update({
      where: {
        id: itemId
      },
      data: {
        quantity: nextQuantity
      }
    });
  }

  revalidateTableSession(item.session);
}

export async function requestTablePaymentAction(payload) {
  const sessionId = String(payload.get("sessionId") || "");

  if (!sessionId) {
    return;
  }

  const session = await loadSession(sessionId);

  if (!session) {
    return;
  }

  const itemsCount = await db.tableSessionItem.count({
    where: {
      sessionId
    }
  });

  if (itemsCount === 0) {
    return;
  }

  await db.tableSession.update({
    where: {
      id: sessionId
    },
    data: {
      status: "PAYMENT_REQUESTED",
      paymentRequestedAt: new Date()
    }
  });

  revalidateTableSession(session);
}
