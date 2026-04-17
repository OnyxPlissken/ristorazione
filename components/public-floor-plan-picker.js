"use client";

import { useEffect, useState } from "react";
import {
  FLOOR_PLAN_STAGE_HEIGHT,
  FLOOR_PLAN_STAGE_WIDTH
} from "../lib/floor-plan";

function tableButtonClassName(table, selectedTableId) {
  if (table.id === selectedTableId) {
    return "public-floor-table selected";
  }

  if (table.selectable) {
    return "public-floor-table selectable";
  }

  if (table.available) {
    return "public-floor-table available";
  }

  return "public-floor-table unavailable";
}

export default function PublicFloorPlanPicker({
  enabled,
  error,
  loading,
  onSelect,
  selectedTableId,
  zones
}) {
  const [activeZoneId, setActiveZoneId] = useState(zones[0]?.id || "");

  useEffect(() => {
    const currentZoneStillExists = zones.some((zone) => zone.id === activeZoneId);

    if (!currentZoneStillExists) {
      setActiveZoneId(zones[0]?.id || "");
    }
  }, [activeZoneId, zones]);

  if (!enabled) {
    return null;
  }

  const activeZone = zones.find((zone) => zone.id === activeZoneId) || zones[0] || null;

  return (
    <section className="public-floor-plan-panel">
      <div className="panel-header">
        <div>
          <h2>Scelta tavolo opzionale</h2>
          <p>Puoi lasciare l&apos;assegnazione automatica oppure scegliere un tavolo disponibile.</p>
        </div>
      </div>

      <div className="public-floor-zone-tabs">
        {zones.map((zone) => (
          <button
            className={zone.id === activeZone?.id ? "location-chip highlighted" : "location-chip"}
            key={zone.id}
            onClick={() => setActiveZoneId(zone.id)}
            type="button"
          >
            {zone.name}
          </button>
        ))}
      </div>

      {loading ? <p className="helper-copy">Sto caricando la planimetria disponibile...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {activeZone ? (
        <div className="public-floor-stage-shell">
          <div
            className="public-floor-stage"
            style={{
              width: `${FLOOR_PLAN_STAGE_WIDTH}px`,
              height: `${FLOOR_PLAN_STAGE_HEIGHT}px`
            }}
          >
            {activeZone.tables.map((table) => (
              <button
                className={tableButtonClassName(table, selectedTableId)}
                key={table.id}
                onClick={() => {
                  if (!table.selectable) {
                    return;
                  }

                  onSelect(table.id === selectedTableId ? "" : table.id);
                }}
                style={{
                  left: `${table.x}px`,
                  top: `${table.y}px`,
                  width: `${table.width}px`,
                  height: `${table.height}px`,
                  transform: `rotate(${table.rotation || 0}deg)`,
                  borderRadius: table.shape === "ROUND" ? "999px" : "14px"
                }}
                type="button"
              >
                <strong>{table.code}</strong>
                <span>{table.seats} coperti</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="public-floor-legend">
        <span className="public-floor-legend-item selectable">Selezionabile</span>
        <span className="public-floor-legend-item available">Disponibile ma piccolo</span>
        <span className="public-floor-legend-item unavailable">Non disponibile</span>
      </div>

      <p className="helper-copy">
        {selectedTableId
          ? "Hai selezionato un tavolo specifico. Se non e' piu disponibile al salvataggio te lo segnalo."
          : "Nessun tavolo selezionato: in questo caso l'assegnazione resta automatica."}
      </p>
    </section>
  );
}
