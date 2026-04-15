import { notFound } from "next/navigation";
import { getTableSession, qrMenu } from "../../../lib/demo-data";
import TableOrdering from "../../../components/table-ordering";

export async function generateMetadata({ params }) {
  const { tableId } = await params;
  const table = getTableSession(tableId);

  if (!table) {
    return {
      title: "Table not found | Coperto"
    };
  }

  return {
    title: `Table ${table.label} | Coperto`
  };
}

export default async function TablePage({ params }) {
  const { tableId } = await params;
  const table = getTableSession(tableId);

  if (!table) {
    notFound();
  }

  return <TableOrdering table={table} menu={qrMenu} />;
}
