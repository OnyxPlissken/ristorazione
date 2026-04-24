"use server";

import { redirect } from "next/navigation";
import {
  clearActiveLocationId,
  getAccessibleLocationsForLogin,
  setActiveLocationId
} from "../active-location";
import { createSession, clearSession, getCurrentUser, verifyPassword } from "../auth";
import { db } from "../db";
import { canAccessLocation } from "../permissions";

export async function loginAction(_, formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const requestedLocationId = String(formData.get("locationId") || "").trim();

  if (!email || !password) {
    return {
      error: "Inserisci email e password.",
      email,
      locationId: requestedLocationId
    };
  }

  const user = await db.user.findUnique({
    where: {
      email
    },
    include: {
      locationAccess: {
        include: {
          location: {
            include: {
              technicalSettings: {
                select: {
                  displayName: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    return {
      error: "Credenziali non valide.",
      email,
      locationId: requestedLocationId
    };
  }

  const accessibleLocations = await getAccessibleLocationsForLogin(user);
  const selectedLocation =
    accessibleLocations.length === 1
      ? accessibleLocations[0]
      : accessibleLocations.find((location) => location.id === requestedLocationId) || null;

  if (accessibleLocations.length > 1 && !requestedLocationId) {
    return {
      error: "Seleziona la sede operativa da usare dopo l'accesso.",
      email,
      locationId: ""
    };
  }

  if (requestedLocationId && !canAccessLocation(user, requestedLocationId)) {
    return {
      error: "La sede selezionata non e assegnata a questo profilo.",
      email,
      locationId: requestedLocationId
    };
  }

  if (accessibleLocations.length > 0 && !selectedLocation) {
    return {
      error: "La sede selezionata non e piu disponibile.",
      email,
      locationId: requestedLocationId
    };
  }

  await createSession(user.id);

  if (selectedLocation?.id) {
    await setActiveLocationId(selectedLocation.id);
  } else {
    await clearActiveLocationId();
  }

  redirect("/admin");
}

export async function switchActiveLocationAction(formData) {
  const locationId = String(formData.get("locationId") || "").trim();
  const nextPath = String(formData.get("nextPath") || "/admin").trim() || "/admin";
  const currentUser = await getCurrentUser();

  if (!locationId) {
    redirect(nextPath);
  }

  if (!currentUser || !canAccessLocation(currentUser, locationId)) {
    redirect(nextPath);
  }

  const accessibleLocations = await getAccessibleLocationsForLogin(currentUser);

  if (!accessibleLocations.some((location) => location.id === locationId)) {
    redirect(nextPath);
  }

  await setActiveLocationId(locationId);
  redirect(nextPath);
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
