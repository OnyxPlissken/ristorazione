"use client";

import { useMemo, useState } from "react";

function toInitialSelectedIds(defaultSelectedIds, preferredLocationId) {
  if (defaultSelectedIds?.length) {
    return [...new Set(defaultSelectedIds)];
  }

  return preferredLocationId ? [preferredLocationId] : [];
}

export default function MenuLocationPicker({
  allowAll = true,
  locations,
  defaultSelectedIds = [],
  defaultAll = false,
  preferredLocationId = ""
}) {
  const [appliesToAll, setAppliesToAll] = useState(defaultAll);
  const [selectedIds, setSelectedIds] = useState(() =>
    toInitialSelectedIds(defaultSelectedIds, preferredLocationId)
  );
  const allLocationIds = useMemo(() => locations.map((location) => location.id), [locations]);

  function toggleLocation(locationId) {
    setSelectedIds((current) =>
      current.includes(locationId)
        ? current.filter((value) => value !== locationId)
        : [...current, locationId]
    );
  }

  function selectOnlyPreferred() {
    if (!preferredLocationId) {
      return;
    }

    setAppliesToAll(false);
    setSelectedIds([preferredLocationId]);
  }

  function clearSelection() {
    setAppliesToAll(false);
    setSelectedIds([]);
  }

  function selectAllLocations() {
    setAppliesToAll(true);
    setSelectedIds(allLocationIds);
  }

  return (
    <div className="menu-location-picker">
      <input name="appliesToAllLocations" type="hidden" value={appliesToAll ? "true" : "false"} />

      {!appliesToAll
        ? selectedIds.map((locationId) => (
            <input key={locationId} name="locationIds" type="hidden" value={locationId} />
          ))
        : null}

      <div className="menu-location-picker-head">
        <div>
          <strong>Sedi valide per il menu</strong>
          <p>Scegli sedi specifiche oppure applica il menu a tutte le sedi disponibili.</p>
        </div>

        <div className="menu-location-picker-actions">
          <button className="button button-muted" disabled={!allowAll} onClick={selectAllLocations} type="button">
            Tutte le sedi
          </button>
          <button className="button button-muted" onClick={selectOnlyPreferred} type="button">
            Solo sede principale
          </button>
          <button className="button button-muted" onClick={clearSelection} type="button">
            Azzera
          </button>
        </div>
      </div>

      <label className={appliesToAll ? "menu-scope-toggle active" : "menu-scope-toggle"}>
        <input
          disabled={!allowAll}
          checked={appliesToAll}
          onChange={(event) => setAppliesToAll(event.target.checked)}
          type="checkbox"
        />
        <span>Valido per tutte le sedi</span>
      </label>

      {!allowAll ? (
        <p className="helper-copy">Solo amministratore o proprietario possono assegnare un menu a tutte le sedi.</p>
      ) : null}

      {!appliesToAll ? (
        <div className="menu-location-grid">
          {locations.map((location) => {
            const checked = selectedIds.includes(location.id);

            return (
              <label className={checked ? "menu-location-option active" : "menu-location-option"} key={location.id}>
                <input
                  checked={checked}
                  onChange={() => toggleLocation(location.id)}
                  type="checkbox"
                />
                <div>
                  <strong>{location.name}</strong>
                  <span>{location.city || "Sede"}</span>
                </div>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="helper-copy">Questo menu sara&apos; disponibile in tutte le sedi visibili a questo profilo.</p>
      )}
    </div>
  );
}
