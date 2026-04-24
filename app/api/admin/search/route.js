import { canViewAdmin, getCurrentUser } from "../../../../lib/auth";
import { runAdminGlobalSearch } from "../../../../lib/search";

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
  const query = searchParams.get("q") || "";
  const results = await runAdminGlobalSearch(user, query);

  return Response.json(results);
}
