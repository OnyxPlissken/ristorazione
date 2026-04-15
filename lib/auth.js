import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import {
  ROLE_LABELS,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_DAYS
} from "./constants";
import { canAccessPage, getRolePermission } from "./permissions";

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET non configurato");
  }

  return secret;
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, existing] = storedHash.split(":");

  if (!salt || !existing) {
    return false;
  }

  const incoming = scryptSync(password, salt, 64);
  const existingBuffer = Buffer.from(existing, "hex");

  if (incoming.length !== existingBuffer.length) {
    return false;
  }

  return timingSafeEqual(incoming, existingBuffer);
}

function hashToken(token) {
  return createHash("sha256")
    .update(`${token}:${getSessionSecret()}`)
    .digest("hex");
}

export async function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  );

  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await db.session.deleteMany({
      where: {
        tokenHash: hashToken(token)
      }
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await db.session.findUnique({
    where: {
      tokenHash: hashToken(token)
    },
    include: {
      user: {
        include: {
          locationAccess: {
            include: {
              location: true
            }
          }
        }
      }
    }
  });

  if (!session || session.expiresAt < new Date() || !session.user.active) {
    cookieStore.delete(SESSION_COOKIE_NAME);

    if (session) {
      await db.session.delete({
        where: {
          id: session.id
        }
      });
    }

    return null;
  }

  return session;
}

export async function getCurrentUser() {
  const session = await getCurrentSession();

  if (!session?.user) {
    return null;
  }

  return {
    ...session.user,
    rolePermission: await getRolePermission(session.user.role)
  };
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireRoles(roles) {
  const user = await requireUser();

  if (!roles.includes(user.role)) {
    redirect("/admin");
  }

  return user;
}

export function canManageUsers(user) {
  return canAccessPage(user, "users", "manage");
}

export function canManageBusiness(user) {
  return (
    canAccessPage(user, "locations", "manage") ||
    canAccessPage(user, "tables", "manage") ||
    canAccessPage(user, "menus", "manage") ||
    canAccessPage(user, "hours", "manage") ||
    canAccessPage(user, "reservations", "manage")
  );
}

export function canViewAdmin(user) {
  return (
    canAccessPage(user, "dashboard") ||
    canAccessPage(user, "locations") ||
    canAccessPage(user, "tables") ||
    canAccessPage(user, "menus") ||
    canAccessPage(user, "hours") ||
    canAccessPage(user, "reservations") ||
    canAccessPage(user, "users") ||
    canAccessPage(user, "console")
  );
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}
