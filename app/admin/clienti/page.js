import Link from "next/link";
import AdminCustomerCrmPanel from "../../../components/admin-customer-crm-panel";
import { requireUser } from "../../../lib/auth";
import { summarizeLocationModules } from "../../../lib/location-modules";
import { requirePageAccess } from "../../../lib/permissions";
import {
  getAccessibleLocationModules,
  getCustomerCrmPageData
} from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function ClientiCrmPage({ searchParams }) {
  const user = await requireUser();
  requirePageAccess(user, "reservations");
  const moduleSummary = summarizeLocationModules(await getAccessibleLocationModules(user));

  if (!moduleSummary.has("customerScoring")) {
    return (
      <div className="page-stack">
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2>Modulo CRM scoring disattivo</h2>
              <p>
                Il CRM clienti/prospect richiede il modulo scoring attivo almeno su una sede accessibile.
                Riattivalo da Console Admin per vedere segmenti, priorita e affidabilita in lista.
              </p>
            </div>
            <Link className="button button-primary" href="/admin/console">
              Apri Console Admin
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const data = await getCustomerCrmPageData(user);
  const params = await searchParams;
  const customerId = String(params?.customerId || "");

  return (
    <AdminCustomerCrmPanel
      initialSelectedProfileId={customerId}
      profiles={data.profiles}
      stats={data.stats}
    />
  );
}
