import { canViewAdmin, getCurrentUser } from "../../../../lib/auth";
import {
  deleteSavedFilter,
  getSavedFiltersForPage,
  saveSavedFilter
} from "../../../../lib/saved-filters";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  if (!canViewAdmin(user)) {
    return Response.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const pageKey = searchParams.get("pageKey") || "";

  if (!pageKey) {
    return Response.json({ error: "pageKey mancante" }, { status: 400 });
  }

  const filters = await getSavedFiltersForPage(user, pageKey);
  return Response.json({
    filters
  });
}

export async function POST(request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  if (!canViewAdmin(user)) {
    return Response.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const payload = await request.json().catch(() => ({}));

  if (!payload?.pageKey || !payload?.name) {
    return Response.json({ error: "Dati filtro incompleti" }, { status: 400 });
  }

  const filter = await saveSavedFilter({
    user,
    pageKey: String(payload.pageKey),
    name: String(payload.name),
    filters: payload.filters || {},
    locationId: payload.locationId ? String(payload.locationId) : null,
    isDefault: Boolean(payload.isDefault)
  });

  return Response.json({ ok: true, filter });
}

export async function DELETE(request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  if (!canViewAdmin(user)) {
    return Response.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filterId = searchParams.get("filterId") || "";

  if (!filterId) {
    return Response.json({ error: "filterId mancante" }, { status: 400 });
  }

  const deleted = await deleteSavedFilter(user, filterId);
  return Response.json({ ok: true, deleted });
}
