import Link from "next/link";
import { notFound } from "next/navigation";
import TableOrdering from "../../../components/table-ordering";
import { getTableSessionPageData } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function TablePage({ params }) {
  const { tableId } = await params;
  const data = await getTableSessionPageData(tableId);

  if (!data) {
    notFound();
  }

  if (!data.qrEnabled) {
    return (
      <div className="empty-state">
        <div>
          <div className="eyebrow">QR non attivo</div>
          <h1>Il menu tavolo non e' disponibile per questa sede.</h1>
          <p>
            La funzionalita' QR deve essere abilitata dalla Console Admin prima di
            poter usare carrello condiviso e pagamento dal tavolo.
          </p>
          <Link className="button button-primary" href="/prenota">
            Vai alle prenotazioni
          </Link>
        </div>
      </div>
    );
  }

  return (
    <TableOrdering
      location={data.location}
      menuItems={data.menuItems}
      session={data.session}
      table={data.table}
      technicalSettings={data.location.technicalSettings}
    />
  );
}
