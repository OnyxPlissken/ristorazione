function escapeCsvCell(value) {
  const text = value == null ? "" : String(value);

  if (/[",\n;]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function toCsv(rows, columns) {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(";");
  const body = rows.map((row) =>
    columns
      .map((column) =>
        escapeCsvCell(
          typeof column.value === "function" ? column.value(row) : row[column.value]
        )
      )
      .join(";")
  );

  return [header, ...body].join("\n");
}

export function csvResponse(filename, content) {
  return new Response(content, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`
    }
  });
}
