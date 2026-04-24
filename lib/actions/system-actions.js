"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../auth";
import { createLocationConfigSnapshot, restoreLocationConfigSnapshot } from "../backups";
import { assertLocationAccess, assertPageAccess } from "../permissions";

export async function createBackupSnapshotAction(formData) {
  const user = await requireUser();
  assertPageAccess(user, "console", "manage");

  const locationId = String(formData.get("locationId") || "");
  const name = String(formData.get("name") || "").trim();

  if (!locationId) {
    return;
  }

  assertLocationAccess(user, locationId);
  await createLocationConfigSnapshot(user, locationId, name);
  revalidatePath("/admin/backup");
}

export async function restoreBackupSnapshotAction(formData) {
  const user = await requireUser();
  assertPageAccess(user, "console", "manage");

  const snapshotId = String(formData.get("snapshotId") || "");

  if (!snapshotId) {
    return;
  }

  const snapshot = await restoreLocationConfigSnapshot(user, snapshotId);

  if (snapshot?.locationId) {
    revalidatePath("/admin/backup");
    revalidatePath("/admin/console");
    revalidatePath("/admin/tavoli");
    revalidatePath("/admin/menu");
    revalidatePath("/admin/orari");
    revalidatePath("/prenota");
  }
}
