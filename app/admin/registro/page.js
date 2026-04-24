import AdminActivityLogPanel from "../../../components/admin-activity-log-panel";
import { requireUser } from "../../../lib/auth";
import { requirePageAccess } from "../../../lib/permissions";
import { getActivityLogPageData } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function RegistroPage() {
  const user = await requireUser();
  requirePageAccess(user, "reservations");
  const data = await getActivityLogPageData(user);

  return <AdminActivityLogPanel data={data} />;
}
