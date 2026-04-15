"use server";

import { redirect } from "next/navigation";
import { createSession, clearSession, verifyPassword } from "../auth";
import { db } from "../db";

export async function loginAction(_, formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Inserisci email e password." };
  }

  const user = await db.user.findUnique({
    where: {
      email
    }
  });

  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    return { error: "Credenziali non valide." };
  }

  await createSession(user.id);
  redirect("/admin");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
