"use client";

import { useEffect, useRef, useState } from "react";
import { saveTableLayoutAction } from "../lib/actions/admin-actions";
import {
  FLOOR_PLAN_STAGE_HEIGHT,
  FLOOR_PLAN_STAGE_WIDTH,
  buildFloorPlanZones,
  resolveTableLayout
} from "../lib/floor-plan";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeTables(location) {
  const groups = buildFloorPlanZones(location);
  const byId = new Map();

  for (const group of groups) {
    group.tables.forEach((table, index) => {
      byId.set(table.id, {
        ...table,
        zoneGroupId: group.id,
        layout: resolveTableLayout(table, index)
      });
    });
  }

  return {
    groups,
    byId
  };
}

export default function AdminFloorLayoutEditor({ canManageTables, location }) {
  const normalized = normalizeTables(location);
  const [activeZoneId, setActiveZoneId] = useState(normalized.groups[0]?.id || "");
  const [selectedTableId, setSelectedTableId] = useState(normalized.groups[0]?.tables[0]?.id || "");
  const [layouts, setLayouts] = useState(() =>
    Object.fromEntries(
      [...normalized.byId.values()].map((table) => [table.id, table.layout])
    )
  );
  const dragStateRef = useRef(null);
  const stageRef = useRef(null);

  useEffect(() => {
    setActiveZoneId(normalized.groups[0]?.id || "");
    setSelectedTableId(normalized.groups[0]?.tables[0]?.id || "");
    setLayouts(
      Object.fromEntries(
        [...normalized.byId.values()].map((table) => [table.id, table.layout])
      )
    );
  }, [location]);

  useEffect(() => {
    const group = normalized.groups.find((item) => item.id === activeZoneId);

    if (group?.tables.some((table) => table.id === selectedTableId)) {
      return;
    }

    setSelectedTableId(group?.tables[0]?.id || "");
  }, [activeZoneId, location, selectedTableId]);

  useEffect(() => {
    function handlePointerMove(event) {
      if (!dragStateRef.current) {
        return;
      }

      const { tableId, offsetX, offsetY, stageLeft, stageTop } = dragStateRef.current;
      setLayouts((current) => {
        const nextLayout = current[tableId];

        if (!nextLayout) {
          return current;
        }

        const x = clamp(
          Math.round(event.clientX - stageLeft - offsetX),
          0,
          FLOOR_PLAN_STAGE_WIDTH - nextLayout.width
        );
        const y = clamp(
          Math.round(event.clientY - stageTop - offsetY),
          0,
          FLOOR_PLAN_STAGE_HEIGHT - nextLayout.height
        );

        return {
          ...current,
          [tableId]: {
            ...nextLayout,
            x,
            y
          }
        };
      });
    }

    function handlePointerUp() {
      dragStateRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const activeZone = normalized.groups.find((group) => group.id === activeZoneId) || normalized.groups[0] || null;
  const selectedTable = normalized.byId.get(selectedTableId) || null;
  const selectedLayout = selectedTable ? layouts[selectedTable.id] : null;

  function updateSelectedLayout(field, rawValue) {
    if (!selectedTable) {
      return;
    }

    setLayouts((current) => {
      const previous = current[selectedTable.id];
      const nextValue =
        field === "shape"
          ? rawValue
          : Number.isNaN(Number(rawValue))
            ? previous[field]
            : Number(rawValue);

      const nextLayout = {
        ...previous,
        [field]: nextValue
      };

      if (field === "width" || field === "height") {
        nextLayout.width = clamp(nextLayout.width, 56, 180);
        nextLayout.height = clamp(nextLayout.height, 48, 180);
      }

      nextLayout.x = clamp(nextLayout.x, 0, FLOOR_PLAN_STAGE_WIDTH - nextLayout.width);
      nextLayout.y = clamp(nextLayout.y, 0, FLOOR_PLAN_STAGE_HEIGHT - nextLayout.height);

      return {
        ...current,
        [selectedTable.id]: nextLayout
      };
    });
  }

  return (
    <div className="admin-floor-layout-shell">
      <div className="panel-header">
        <div>
          <h2>Planimetria tavoli</h2>
          <p>Disponi i tavoli per zona e abilita la scelta cliente dalla prenotazione.</p>
        </div>
      </div>

      <div className="admin-floor-layout">
        <div className="admin-floor-rail">
          <div className="admin-floor-zone-tabs">
            {normalized.groups.map((group) => (
              <button
                className={group.id === activeZone?.id ? "location-pill active" : "location-pill"}
                key={group.id}
                onClick={() => setActiveZoneId(group.id)}
                type="button"
              >
                <strong>{group.name}</strong>
                <span>{group.tables.length} tavoli</span>
              </button>
            ))}
          </div>

          <div className="admin-floor-table-list">
            {activeZone?.tables.map((table) => (
              <button
                className={table.id === selectedTableId ? "admin-floor-table-row active" : "admin-floor-table-row"}
                key={table.id}
                onClick={() => setSelectedTableId(table.id)}
                type="button"
              >
                <strong>{table.code}</strong>
                <span>{table.seats} coperti</span>
              </button>
            ))}
          </div>
        </div>

        <div className="admin-floor-stage-wrap">
          <div
            className="admin-floor-stage"
            ref={stageRef}
            style={{
              width: `${FLOOR_PLAN_STAGE_WIDTH}px`,
              height: `${FLOOR_PLAN_STAGE_HEIGHT}px`
            }}
          >
            {activeZone?.tables.map((table) => {
              const layout = layouts[table.id];

              if (!layout) {
                return null;
              }

              return (
                <button
                  className={table.id === selectedTableId ? "admin-floor-node active" : "admin-floor-node"}
                  key={table.id}
                  onClick={() => setSelectedTableId(table.id)}
                  onPointerDown={(event) => {
                    if (!canManageTables) {
                      return;
                    }

                    const stageRect = stageRef.current?.getBoundingClientRect();
                    const rect = event.currentTarget.getBoundingClientRect();

                    if (!stageRect) {
                      return;
                    }

                    dragStateRef.current = {
                      tableId: table.id,
                      stageLeft: stageRect.left,
                      stageTop: stageRect.top,
                      offsetX: event.clientX - rect.left,
                      offsetY: event.clientY - rect.top
                    };
                  }}
                  style={{
                    left: `${layout.x}px`,
                    top: `${layout.y}px`,
                    width: `${layout.width}px`,
                    height: `${layout.height}px`,
                    transform: `rotate(${layout.rotation || 0}deg)`,
                    borderRadius: layout.shape === "ROUND" ? "999px" : "14px"
                  }}
                  type="button"
                >
                  <strong>{table.code}</strong>
                  <span>{table.seats}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="admin-floor-inspector">
          {selectedTable && selectedLayout ? (
            <form action={saveTableLayoutAction} className="entity-form">
              <input name="tableId" type="hidden" value={selectedTable.id} />
              <input name="locationId" type="hidden" value={location.id} />
              <input name="layoutX" type="hidden" value={String(selectedLayout.x)} />
              <input name="layoutY" type="hidden" value={String(selectedLayout.y)} />
              <input name="layoutWidth" type="hidden" value={String(selectedLayout.width)} />
              <input name="layoutHeight" type="hidden" value={String(selectedLayout.height)} />
              <input name="layoutRotation" type="hidden" value={String(selectedLayout.rotation)} />
              <input name="layoutShape" type="hidden" value={selectedLayout.shape} />

              <div className="panel-header">
                <div>
                  <h2>{selectedTable.code}</h2>
                  <p>{selectedTable.seats} coperti - editor posizione</p>
                </div>
              </div>

              <label>
                <span>Zona</span>
                <select defaultValue={selectedTable.zoneId || ""} name="zoneId">
                  <option value="">Senza zona</option>
                  {location.zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-grid">
                <label>
                  <span>X</span>
                  <input
                    onChange={(event) => updateSelectedLayout("x", event.target.value)}
                    type="number"
                    value={selectedLayout.x}
                  />
                </label>
                <label>
                  <span>Y</span>
                  <input
                    onChange={(event) => updateSelectedLayout("y", event.target.value)}
                    type="number"
                    value={selectedLayout.y}
                  />
                </label>
                <label>
                  <span>Larghezza</span>
                  <input
                    onChange={(event) => updateSelectedLayout("width", event.target.value)}
                    type="number"
                    value={selectedLayout.width}
                  />
                </label>
                <label>
                  <span>Altezza</span>
                  <input
                    onChange={(event) => updateSelectedLayout("height", event.target.value)}
                    type="number"
                    value={selectedLayout.height}
                  />
                </label>
                <label>
                  <span>Rotazione</span>
                  <input
                    onChange={(event) => updateSelectedLayout("rotation", event.target.value)}
                    type="number"
                    value={selectedLayout.rotation}
                  />
                </label>
                <label>
                  <span>Forma</span>
                  <select
                    onChange={(event) => updateSelectedLayout("shape", event.target.value)}
                    value={selectedLayout.shape}
                  >
                    <option value="RECT">Rettangolare</option>
                    <option value="ROUND">Rotondo</option>
                  </select>
                </label>
              </div>

              <div className="entity-footer">
                <span>
                  {canManageTables
                    ? "Puoi trascinare il tavolo nella planimetria o rifinire i valori qui."
                    : "Accesso in sola lettura."}
                </span>
                {canManageTables ? (
                  <button className="button button-primary" type="submit">
                    Salva planimetria
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <div className="note-box">
              <strong>Nessun tavolo selezionato</strong>
              <p>Scegli un tavolo dalla lista o dalla planimetria per modificarne la posizione.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
