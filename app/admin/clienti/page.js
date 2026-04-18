import AdminCustomerCrmPanel from "../../../components/admin-customer-crm-panel";
import { requireUser } from "../../../lib/auth";
import { requirePageAccess } from "../../../lib/permissions";
import { getCustomerCrmPageData } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function ClientiCrmPage() {
  const user = await requireUser();
  requirePageAccess(user, "reservations");
  const data = await getCustomerCrmPageData(user);

  return <AdminCustomerCrmPanel profiles={data.profiles} stats={data.stats} />;
}
