import Link from "next/link";
import { AdminDialog } from "../../../components/admin-dialog";
import AdminFloorLayoutEditor from "../../../components/admin-floor-layout-editor";
import {
  deleteTableAction,
  generateTablesAction,
  saveLocationZoneAction,
  saveTableAction
} from "../../../lib/actions/admin-actions";
import { requireUser } from "../../../lib/auth";
import { naturalCompare } from "../../../lib/format";
import { canAccessPage, requirePageAccess } from "../../../lib/permissions";
import { getAccessibleLocations } from "../../../lib/queries";

export const dynamic = "force-dynamic";

const tableViews = [
  {
    key: "zones",
    label: "Zone",
    description: "Organizza sala, dehors, piani e aree."
  },
  {
    key: "tables",
    label: "Tavoli",
    description: "Anagrafica tavoli e codici operativi."
  },
  {
    key: "combinations",
    label: "Combinazioni",
    description: "Definisci quali tavoli si possono unire."
  },
  {
    key: "layout",
    label: "Planimetria",
    description: "Disponi i tavoli su una mappa virtuale per admin e clienti."
  }
];

function getPublicLocationName(location) {
  return location.technicalSettings?.displayName || location.name;
}

function getZoneName(table) {
  return table.zoneRecord?.name || table.zone || "Senza zona";
}

function buildZoneGroups(location) {
  const groups = new Map();

  for (const zone of location.zones || []) {
    groups.set(zone.name, {
      id: zone.id,
      name: zone.name,
      sortOrder: zone.sortOrder ?? 0,
      active: zone.active !== false,
      tables: [],
      covers: 0
    });
  }

  for (const table of location.tables || []) {
    const name = getZoneName(table);

    if (!groups.has(name)) {
      groups.set(name, {
        id: table.zoneRecord?.id || name,
        name,
        sortOrder: Number.MAX_SAFE_INTEGER,
        active: table.zoneRecord?.active ?? true,
        tables: [],
        covers: 0
      });
    }

    const group = groups.get(name);
    group.tables.push(table);
    group.covers += table.seats;
  }

  for (const group of groups.values()) {
    group.tables.sort((left, right) => naturalCompare(left.code, right.code));
  }

  return [...groups.values()].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || naturalCompare(left.name, right.name)
  );
}

function sortLocations(locations) {
  return [...locations].sort(
    (left, right) =>
      naturalCompare(left.name, right.name) || naturalCompare(left.city || "", right.city || "")
  );
}

function sortZones(zones) {
  return [...zones].sort(
    (left, right) =>
      (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || naturalCompare(left.name, right.name)
  );
}

function getLocationHref(locationId, view = "tables") {
  return `/admin/tavoli?locationId=${locationId}&view=${view}`;
}

function getViewHref(locationId, view) {
  return `/admin/tavoli?locationId=${locationId}&view=${view}`;
}

function CombinableTableSelector({ currentTableId = "", tables, selectedIds = [] }) {
  const options = tables.filter((table) => table.id !== currentTableId);

  if (options.length === 0) {
    return <p className="helper-copy">Nessun altro tavolo disponibile per creare combinazioni.</p>;
  }

  return (
    <div className="table-combination-grid">
      {options.map((table) => (
        <label className="menu-location-option" key={`${currentTableId || "new"}-${table.id}`}>
          <input
            defaultChecked={selectedIds.includes(table.id)}
            name="combinableWithIds"
            type="checkbox"
            value={table.id}
          />
          <div>
            <strong>{table.code}</strong>
            <span>
              {table.seats} coperti - {getZoneName(table)}
            </span>
          </div>
        </label>
      ))}
    </div>
  );
}

function NewZoneDialog({ location, sortedZones }) {
  return (
    <AdminDialog
      buttonClassName="button button-primary"
      buttonLabel="Nuova zona"
      description="Crea prima le zone del locale, poi assegna i tavoli al contesto corretto."
      title="Crea una nuova zona"
    >
      <form action={saveLocationZoneAction} className="entity-form">
        <input name="locationId" type="hidden" value={location.id} />

        <div className="form-grid">
          <label>
            <span>Nome zona</span>
            <input name="name" placeholder="Sala interna" required type="text" />
          </label>
          <label>
            <span>Ordine</span>
            <input defaultValue={sortedZones.length + 1} min="0" name="sortOrder" type="number" />
          </label>
        </div>

        <label className="checkbox-item">
          <input defaultChecked name="active" type="checkbox" />
          <span>Zona attiva</span>
        </label>

        <button className="button button-primary" type="submit">
          Crea zona
        </button>
      </form>
    </AdminDialog>
  );
}

function TableCreationDialogs({ location, sortedZones }) {
  return (
    <>
      <AdminDialog
        buttonClassName="button button-muted"
        buttonLabel="Genera tavoli"
        description="Crea in blocco una sequenza di tavoli gia collegata a una zona."
        title="Generazione rapida tavoli"
      >
        <form action={generateTablesAction} className="entity-form">
          <input name="locationId" type="hidden" value={location.id} />

          <div className="form-grid">
            <label>
              <span>Prefisso</span>
              <input defaultValue="T" name="prefix" type="text" />
            </label>
            <label>
              <span>Coperti per tavolo</span>
              <input defaultValue="4" min="1" name="seats" type="number" />
            </label>
            <label>
              <span>Da numero</span>
              <input defaultValue="1" min="1" name="from" type="number" />
            </label>
            <label>
              <span>A numero</span>
              <input
                defaultValue={Math.max(location.tables.length + 1, 1)}
                min="1"
                name="to"
                type="number"
              />
            </label>
            <label>
              <span>Zona esistente</span>
              <select defaultValue="" name="zoneId">
                <option value="">Seleziona una zona</option>
                {sortedZones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                    {zone.active ? "" : " (inattiva)"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Oppure nuova zona</span>
              <input name="newZoneName" placeholder="Piano superiore" type="text" />
            </label>
          </div>

          <button className="button button-primary" type="submit">
            Genera tavoli
          </button>
        </form>
      </AdminDialog>

      <AdminDialog
        buttonClassName="button button-muted"
        buttonLabel="Nuovo tavolo"
        description="Crea un tavolo singolo con codice, coperti e zona di appartenenza."
        title="Aggiungi un tavolo"
      >
        <form action={saveTableAction} className="entity-form">
          <input name="locationId" type="hidden" value={location.id} />

          <div className="form-grid">
            <label>
              <span>Codice tavolo</span>
              <input defaultValue={`T${location.tables.length + 1}`} name="code" required type="text" />
            </label>
            <label>
              <span>Coperti</span>
              <input defaultValue="4" min="1" name="seats" required type="number" />
            </label>
            <label>
              <span>Zona esistente</span>
              <select defaultValue="" name="zoneId">
                <option value="">Seleziona una zona</option>
                {sortedZones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                    {zone.active ? "" : " (inattiva)"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Oppure nuova zona</span>
              <input name="newZoneName" placeholder="Giardino" type="text" />
            </label>
          </div>

          <label className="checkbox-item">
            <input defaultChecked name="active" type="checkbox" />
            <span>Tavolo attivo</span>
          </label>

          <div className="menu-location-picker">
            <div className="menu-location-picker-head">
              <div>
                <strong>Tavoli combinabili</strong>
                <p>Seleziona i tavoli che possono essere uniti a questo tavolo.</p>
              </div>
            </div>
            <CombinableTableSelector tables={location.tables} />
          </div>

          <button className="button button-primary" type="submit">
            Salva tavolo
          </button>
        </form>
      </AdminDialog>
    </>
  );
}

export default async function TavoliPage({ searchParams }) {
  const user = await requireUser();
  requirePageAccess(user, "tables");

  const params = await searchParams;
  const requestedLocationId = Array.isArray(params?.locationId)
    ? params.locationId[0]
    : params?.locationId;
  const requestedView = String(params?.view || "tables");
  const activeView = tableViews.find((view) => view.key === requestedView)?.key || "tables";
  const locations = sortLocations(await getAccessibleLocations(user));
  const selectedLocation =
    locations.find((location) => location.id === requestedLocationId) || null;

  if (!locations.length) {
    return (
      <div className="page-stack">
        <section className="panel-card">
          <div className="panel-header">
            <h2>Tavoli</h2>
            <p>Nessuna sede assegnata a questo utente. Assegna almeno una sede per gestire la sala.</p>
          </div>
        </section>
      </div>
    );
  }

  if (!selectedLocation) {
    return (
      <div className="page-stack">
        <section className="panel-card location-selector-stage">
          <div className="panel-header">
            <div>
              <h2>Scegli la sede da gestire</h2>
              <p>
                {requestedLocationId
                  ? "La sede selezionata non e piu disponibile per questo profilo. Scegli un altro locale."
                  : "Prima di modificare zone, tavoli o combinazioni scegli la sede corretta."}
              </p>
            </div>
            <div className="row-meta">
              <span>{locations.length} sedi accessibili</span>
            </div>
          </div>

          <div className="location-picker-grid">
            {locations.map((location) => (
              <Link className="location-pill" href={getLocationHref(location.id)} key={location.id}>
                <strong>{location.name}</strong>
                <span>{location.city}</span>
                <small>{location.address}</small>
              </Link>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const sortedZones = sortZones(selectedLocation.zones || []);
  const zoneGroups = buildZoneGroups({ ...selectedLocation, zones: sortedZones });
  const zoneLookup = new Map(zoneGroups.map((group) => [group.name, group]));
  const allTables = [...selectedLocation.tables].sort((left, right) =>
    naturalCompare(left.code, right.code)
  );
  const canManageTables = canAccessPage(user, "tables", "manage");
  const canDeleteTables = canAccessPage(user, "tables", "delete");
  const activeTables = selectedLocation.tables.filter((table) => table.active).length;
  const totalCovers = selectedLocation.tables.reduce((sum, table) => sum + table.seats, 0);

  return (
    <div className="page-stack">
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Gestione tavoli</h2>
            <p>Una sede alla volta, con viste distinte per zone, tavoli, combinazioni e planimetria.</p>
          </div>
          <div className="row-meta">
            <span>{selectedLocation.tables.length} tavoli in sede</span>
            <span>{locations.length} sedi accessibili</span>
          </div>
        </div>

        <div className="page-actions">
          <AdminDialog
            buttonClassName="button button-muted"
            buttonLabel="Cambia sede"
            description="Scegli il locale da gestire prima di intervenire sulla sala."
            title="Seleziona una sede"
          >
            <div className="location-picker-grid">
              {locations.map((location) => (
                <Link
                  className={
                    location.id === selectedLocation.id ? "location-pill active" : "location-pill"
                  }
                  href={getLocationHref(location.id, activeView)}
                  key={location.id}
                >
                  <strong>{location.name}</strong>
                  <span>{location.city}</span>
                  <small>{location.address}</small>
                </Link>
              ))}
            </div>
          </AdminDialog>

          <Link className="button button-muted" href={`/admin/sala?locationId=${selectedLocation.id}`}>
            Apri mappa sala
          </Link>

          {canManageTables ? (
            <>
              <NewZoneDialog location={selectedLocation} sortedZones={sortedZones} />
              <TableCreationDialogs location={selectedLocation} sortedZones={sortedZones} />
            </>
          ) : null}
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>{selectedLocation.name}</h2>
            <p>
              {selectedLocation.address}, {selectedLocation.city}
            </p>
          </div>
          <div className="row-meta">
            <span>Nome pubblico: {getPublicLocationName(selectedLocation)}</span>
            <span>
              {activeTables} attivi su {selectedLocation.tables.length}
            </span>
          </div>
        </div>

        <div className="zone-summary-grid">
          <article className="summary-chip">
            <strong>{selectedLocation.tables.length}</strong>
            <span>tavoli configurati</span>
            <small>{totalCovers} coperti complessivi</small>
          </article>
          <article className="summary-chip">
            <strong>{sortedZones.length}</strong>
            <span>zone</span>
            <small>{activeTables} tavoli attivi</small>
          </article>
          <article className="summary-chip">
            <strong>{allTables.filter((table) => table.combinableWithIds?.length).length}</strong>
            <span>tavoli combinabili</span>
            <small>relazioni attive in sala</small>
          </article>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Vista gestione</h2>
            <p>Cambia prospettiva senza perdere il contesto della sede selezionata.</p>
          </div>
        </div>

        <div className="admin-section-tabs">
          {tableViews.map((view) => (
            <Link
              className={
                activeView === view.key ? "admin-section-tab active" : "admin-section-tab"
              }
              href={getViewHref(selectedLocation.id, view.key)}
              key={view.key}
            >
              <strong>{view.label}</strong>
              <span>{view.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel-card" hidden={activeView !== "zones"}>
        <div className="panel-header">
          <div>
            <h2>Zone della sede</h2>
            <p>Configura le aree del locale prima di distribuire i tavoli.</p>
          </div>
          <div className="row-meta">
            <span>{sortedZones.length} zone salvate</span>
          </div>
        </div>

        {sortedZones.length > 0 ? (
          <div className="table-card-grid">
            {sortedZones.map((zone) => {
              const group = zoneLookup.get(zone.name);

              return (
                <article className="table-admin-card" key={zone.id}>
                  <div className="table-admin-card-head">
                    <div>
                      <strong>{zone.name}</strong>
                      <p>
                        {group?.tables.length || 0} tavoli - {group?.covers || 0} coperti
                      </p>
                    </div>
                    <div className="row-meta">
                      <span>Ordine {zone.sortOrder ?? 0}</span>
                      <span>{zone.active ? "Zona attiva" : "Zona inattiva"}</span>
                    </div>
                  </div>

                  {canManageTables ? (
                    <details className="inline-editor">
                      <summary>Modifica zona</summary>
                      <form action={saveLocationZoneAction} className="entity-form">
                        <input name="locationId" type="hidden" value={selectedLocation.id} />
                        <input name="zoneId" type="hidden" value={zone.id} />

                        <div className="form-grid">
                          <label>
                            <span>Nome zona</span>
                            <input defaultValue={zone.name} name="name" type="text" />
                          </label>
                          <label>
                            <span>Ordine</span>
                            <input
                              defaultValue={zone.sortOrder}
                              min="0"
                              name="sortOrder"
                              type="number"
                            />
                          </label>
                        </div>

                        <div className="entity-footer">
                          <label className="checkbox-item">
                            <input defaultChecked={zone.active} name="active" type="checkbox" />
                            <span>Zona visibile</span>
                          </label>
                          <button className="button button-primary" type="submit">
                            Aggiorna zona
                          </button>
                        </div>
                      </form>
                    </details>
                  ) : (
                    <div className="note-box">
                      <strong>Accesso in sola lettura</strong>
                      <p>Puoi consultare la configurazione delle zone ma non modificarla.</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="empty-copy">Nessuna zona creata. Parti da "Nuova zona".</p>
        )}
      </section>

      <section className="panel-card" hidden={activeView !== "tables"}>
        <div className="panel-header">
          <div>
            <h2>Tavoli per zona</h2>
            <p>Anagrafica tavoli organizzata per area del locale.</p>
          </div>
        </div>

        {zoneGroups.map((group) => (
          <section className="section-card" key={group.id}>
            <div className="panel-header">
              <div>
                <h2>{group.name}</h2>
                <p>
                  {group.tables.length} tavoli - {group.covers} coperti
                </p>
              </div>
              <div className="row-meta">
                <span>{group.active ? "Zona attiva" : "Zona inattiva"}</span>
              </div>
            </div>

            {group.tables.length > 0 ? (
              <div className="table-card-grid">
                {group.tables.map((table) => (
                  <article className="table-admin-card" key={table.id}>
                    <div className="table-admin-card-head">
                      <div>
                        <strong>{table.code}</strong>
                        <p>
                          {table.seats} coperti - {table.active ? "attivo" : "inattivo"}
                        </p>
                      </div>
                      <div className="row-meta">
                        <Link href={`/table/${table.id}`}>Apri QR tavolo</Link>
                        <span>/table/{table.id}</span>
                      </div>
                    </div>

                    {canManageTables ? (
                      <details className="inline-editor">
                        <summary>Modifica tavolo</summary>
                        <form action={saveTableAction} className="entity-form">
                          <input name="tableId" type="hidden" value={table.id} />
                          <input name="locationId" type="hidden" value={selectedLocation.id} />

                          <div className="form-grid">
                            <label>
                              <span>Codice tavolo</span>
                              <input defaultValue={table.code} name="code" required type="text" />
                            </label>
                            <label>
                              <span>Coperti</span>
                              <input
                                defaultValue={table.seats}
                                min="1"
                                name="seats"
                                required
                                type="number"
                              />
                            </label>
                            <label>
                              <span>Zona esistente</span>
                              <select defaultValue={table.zoneId || ""} name="zoneId">
                                <option value="">Senza zona</option>
                                {sortedZones.map((zone) => (
                                  <option key={zone.id} value={zone.id}>
                                    {zone.name}
                                    {zone.active ? "" : " (inattiva)"}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span>Oppure nuova zona</span>
                              <input
                                name="newZoneName"
                                placeholder="Compila solo per creare una nuova zona"
                                type="text"
                              />
                            </label>
                          </div>

                          <div className="entity-footer">
                            <label className="checkbox-item">
                              <input defaultChecked={table.active} name="active" type="checkbox" />
                              <span>Tavolo attivo</span>
                            </label>
                            <button className="button button-primary" type="submit">
                              Aggiorna tavolo
                            </button>
                          </div>
                        </form>
                      </details>
                    ) : (
                      <div className="note-box">
                        <strong>Dettaglio tavolo</strong>
                        <p>Zona: {group.name}. QR disponibile dal link sopra.</p>
                      </div>
                    )}

                    {canDeleteTables ? (
                      <form action={deleteTableAction} className="table-card-actions">
                        <input name="tableId" type="hidden" value={table.id} />
                        <button className="button button-danger" type="submit">
                          Elimina tavolo
                        </button>
                      </form>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-copy">Nessun tavolo assegnato a questa zona.</p>
            )}
          </section>
        ))}
      </section>

      <section className="panel-card" hidden={activeView !== "combinations"}>
        <div className="panel-header">
          <div>
            <h2>Combinazioni tavoli</h2>
            <p>Definisci le unioni tavoli in una vista dedicata e piu leggibile.</p>
          </div>
        </div>

        <div className="table-card-grid">
          {allTables.map((table) => {
            const combinableCodes = (table.combinableWithIds || [])
              .map((tableId) => allTables.find((item) => item.id === tableId)?.code)
              .filter(Boolean)
              .sort((left, right) => naturalCompare(left, right));

            return (
              <article className="table-admin-card" key={table.id}>
                <div className="table-admin-card-head">
                  <div>
                    <strong>{table.code}</strong>
                    <p>
                      {table.seats} coperti - {getZoneName(table)}
                    </p>
                  </div>
                  <div className="row-meta">
                    <span>{table.active ? "Tavolo attivo" : "Tavolo inattivo"}</span>
                  </div>
                </div>

                <div className="note-box">
                  <strong>Combinazioni attuali</strong>
                  <p>{combinableCodes.length ? combinableCodes.join(", ") : "Nessuna combinazione attiva."}</p>
                </div>

                {canManageTables ? (
                  <details className="inline-editor">
                    <summary>Gestisci combinazioni</summary>
                    <form action={saveTableAction} className="entity-form">
                      <input name="tableId" type="hidden" value={table.id} />
                      <input name="locationId" type="hidden" value={selectedLocation.id} />
                      <input name="code" type="hidden" value={table.code} />
                      <input name="seats" type="hidden" value={table.seats} />
                      <input name="zoneId" type="hidden" value={table.zoneId || ""} />
                      <input name="newZoneName" type="hidden" value="" />
                      <input name="active" type="hidden" value={table.active ? "true" : "false"} />

                      <CombinableTableSelector
                        currentTableId={table.id}
                        selectedIds={table.combinableWithIds || []}
                        tables={allTables}
                      />

                      <div className="entity-footer">
                        <span>Le relazioni si aggiornano anche sull'altro tavolo.</span>
                        <button className="button button-primary" type="submit">
                          Salva combinazioni
                        </button>
                      </div>
                    </form>
                  </details>
                ) : (
                  <div className="note-box">
                    <strong>Accesso in sola lettura</strong>
                    <p>Puoi vedere le combinazioni ma non modificarle.</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel-card" hidden={activeView !== "layout"}>
        <AdminFloorLayoutEditor
          canManageTables={canManageTables}
          location={selectedLocation}
        />
      </section>
    </div>
  );
}
