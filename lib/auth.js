import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import {
  ROLE_LABELS,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_DAYS
} from "./constants";

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
  return session?.user || null;
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
  return ["ADMIN", "PROPRIETARIO"].includes(user.role);
}

export function canManageBusiness(user) {
  return ["ADMIN", "PROPRIETARIO", "STORE_MANAGER"].includes(user.role);
}

export function canViewAdmin(user) {
  return ["ADMIN", "PROPRIETARIO", "STORE_MANAGER", "STAFF"].includes(user.role);
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}
