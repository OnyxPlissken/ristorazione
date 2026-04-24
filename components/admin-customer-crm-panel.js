"use client";

import { startTransition, useDeferredValue, useEffect, useState, useTransition } from "react";
import {
  CUSTOMER_SCORE_BAND_LABELS,
  CUSTOMER_SCORE_BAND_SUMMARY_LABELS,
  customerBandTone
} from "../lib/constants";
import { euro, formatDateTime } from "../lib/format";

const typeFilters = ["ALL", "CLIENTE", "PROSPECT"];
const bandFilters = ["ALL", "A", "B", "C", "D"];

function matchesSearch(profile, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    profile.displayName,
    profile.normalizedEmail,
    profile.normalizedPhone,
    ...(profile.locations || []).map((location) => location.name),
    ...(profile.tags || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function applySavedFilterConfig(savedFilter, setters) {
  const filters = savedFilter?.filters || {};
  setters.setQuery(String(filters.query || ""));
  setters.setTypeFilter(String(filters.typeFilter || "ALL"));
  setters.setBandFilter(String(filters.bandFilter || "ALL"));
}

function CrmListRow({ active, checked, onSelect, onToggle, profile }) {
  return (
    <button
      className={active ? "crm-list-row active" : "crm-list-row"}
      onClick={onSelect}
      type="button"
    >
      <div className="crm-cell crm-checkbox-cell">
        <input
          checked={checked}
          onChange={(event) => onToggle(event.target.checked)}
          onClick={(event) => event.stopPropagation()}
          type="checkbox"
        />
      </div>
      <div className="crm-cell crm-primary">
        <strong>{profile.displayName}</strong>
        <small>{profile.normalizedEmail || profile.normalizedPhone || "Contatto non disponibile"}</small>
      </div>
      <div className="crm-cell">
        <span className={`customer-band-chip ${customerBandTone(profile.band)}`}>
          {CUSTOMER_SCORE_BAND_LABELS[profile.band] || profile.band}
        </span>
        <small>{profile.vip ? "VIP" : profile.type}</small>
      </div>
      <div className="crm-cell">
        <strong>{profile.priorityScore}</strong>
        <small>affid. {profile.reliabilityScore}/100</small>
      </div>
      <div className="crm-cell">
        <strong>{profile.completedReservations}</strong>
        <small>{profile.noShowCount} no-show</small>
      </div>
      <div className="crm-cell">
        <strong>{profile.averageSpend ? euro(profile.averageSpend) : "n.d."}</strong>
        <small>{profile.openWaitlistCount} in coda</small>
      </div>
      <div className="crm-cell">
        <strong>{formatDateTime(profile.lastTouchAt)}</strong>
        <small>{profile.locations[0]?.name || "Nessuna sede"}</small>
      </div>
    </button>
  );
}

function CrmDetail({ profile }) {
  if (!profile) {
    return (
      <section className="section-card crm-detail-empty">
        <strong>Nessun contatto selezionato</strong>
        <p>Scegli un cliente o prospect dalla lista per vedere storico, scoring e note CRM.</p>
      </section>
    );
  }

  return (
    <section className="section-card crm-detail-panel">
      <div className="panel-header">
        <div>
          <h2>{profile.displayName}</h2>
          <p>{profile.normalizedEmail || profile.normalizedPhone || "Contatto non disponibile"}</p>
        </div>
        <div className="reservation-header-badges">
          <span className={`customer-band-chip ${customerBandTone(profile.band)}`}>
            {CUSTOMER_SCORE_BAND_LABELS[profile.band] || profile.band}
          </span>
          <span className="location-chip highlighted">{profile.vip ? "VIP" : profile.type}</span>
        </div>
      </div>

      <div className="customer-profile-summary">
        <div>
          <span>Priority</span>
          <strong>{profile.priorityScore}</strong>
        </div>
        <div>
          <span>Affidabilita</span>
          <strong>{profile.reliabilityScore}/100</strong>
        </div>
        <div>
          <span>Frequenza</span>
          <strong>{profile.frequencyScore}/100</strong>
        </div>
        <div>
          <span>Valore</span>
          <strong>{profile.valueScore}/100</strong>
        </div>
      </div>

      <div className="reservation-detail-grid">
        <div className="reservation-detail-cell">
          <span>Visite</span>
          <strong>{profile.visitCount}</strong>
        </div>
        <div className="reservation-detail-cell">
          <span>Completate</span>
          <strong>{profile.completedReservations}</strong>
        </div>
        <div className="reservation-detail-cell">
          <span>Cancellate</span>
          <strong>{profile.cancelledReservations}</strong>
        </div>
        <div className="reservation-detail-cell">
          <span>No-show</span>
          <strong>{profile.noShowCount}</strong>
        </div>
        <div className="reservation-detail-cell">
          <span>Spesa media</span>
          <strong>{profile.averageSpend ? euro(profile.averageSpend) : "n.d."}</strong>
        </div>
        <div className="reservation-detail-cell">
          <span>Valore totale</span>
          <strong>{profile.totalSpend ? euro(profile.totalSpend) : "n.d."}</strong>
        </div>
      </div>

      <div className="crm-location-strip">
        {profile.vip ? <span className="location-chip highlighted">VIP</span> : null}
        {(profile.locations || []).map((location) => (
          <span className="location-chip" key={`${profile.id}-${location.id}`}>
            {location.name}
          </span>
        ))}
      </div>

      {profile.notes ? (
        <div className="note-box">
          <strong>Note CRM</strong>
          <p>{profile.notes}</p>
        </div>
      ) : null}

      <div className="crm-activity-grid">
        <section className="crm-activity-card">
          <div className="panel-header">
            <div>
              <h3>Prenotazioni recenti</h3>
              <p>Ultimi movimenti utili per il team di sala e booking.</p>
            </div>
          </div>

          <div className="crm-mini-list">
            {profile.reservations.map((reservation) => (
              <article className="crm-mini-row" key={reservation.id}>
                <div>
                  <strong>{formatDateTime(reservation.dateTime)}</strong>
                  <small>{reservation.locationName}</small>
                </div>
                <div className="row-meta">
                  <span>{reservation.guests} coperti</span>
                  <small>{reservation.status}</small>
                </div>
              </article>
            ))}
            {profile.reservations.length === 0 ? (
              <p className="empty-copy">Nessuna prenotazione registrata per questo profilo.</p>
            ) : null}
          </div>
        </section>

        <section className="crm-activity-card">
          <div className="panel-header">
            <div>
              <h3>Coda e prospect</h3>
              <p>Richieste in attesa e tracce prospect associate al profilo.</p>
            </div>
          </div>

          <div className="crm-mini-list">
            {profile.waitlistEntries.map((entry) => (
              <article className="crm-mini-row" key={entry.id}>
                <div>
                  <strong>{formatDateTime(entry.preferredDateTime)}</strong>
                  <small>{entry.locationName}</small>
                </div>
                <div className="row-meta">
                  <span>{entry.guests} coperti</span>
                  <small>
                    {entry.status} / p. {entry.priorityScore}
                  </small>
                </div>
              </article>
            ))}
            {profile.waitlistEntries.length === 0 ? (
              <p className="empty-copy">Nessuna richiesta in coda per questo profilo.</p>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}

export default function AdminCustomerCrmPanel({
  profiles,
  stats,
  initialSelectedProfileId = ""
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [bandFilter, setBandFilter] = useState("ALL");
  const [selectedProfileId, setSelectedProfileId] = useState(
    initialSelectedProfileId || profiles[0]?.id || ""
  );
  const [selectedProfileIds, setSelectedProfileIds] = useState([]);
  const [savedFilters, setSavedFilters] = useState([]);
  const [savedFilterId, setSavedFilterId] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [isPending, startBulkTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredProfiles = profiles.filter((profile) => {
    const typeMatch = typeFilter === "ALL" ? true : profile.type === typeFilter;
    const bandMatch = bandFilter === "ALL" ? true : profile.band === bandFilter;
    return typeMatch && bandMatch && matchesSearch(profile, normalizedQuery);
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSavedFilters() {
      try {
        const response = await fetch("/api/admin/filters?pageKey=crm", {
          cache: "no-store"
        });
        const payload = await response.json();

        if (!cancelled && response.ok) {
          setSavedFilters(payload.filters || []);
          const defaultFilter = (payload.filters || []).find((item) => item.isDefault);

          if (defaultFilter) {
            setSavedFilterId(defaultFilter.id);
            applySavedFilterConfig(defaultFilter, {
              setQuery,
              setTypeFilter,
              setBandFilter
            });
          }
        }
      } catch {
        // Ignore bootstrap failures.
      }
    }

    void loadSavedFilters();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialSelectedProfileId && profiles.some((profile) => profile.id === initialSelectedProfileId)) {
      setSelectedProfileId(initialSelectedProfileId);
    }
  }, [initialSelectedProfileId, profiles]);

  useEffect(() => {
    if (!filteredProfiles.length) {
      setSelectedProfileId("");
      return;
    }

    if (!filteredProfiles.some((profile) => profile.id === selectedProfileId)) {
      setSelectedProfileId(filteredProfiles[0].id);
    }
  }, [filteredProfiles, selectedProfileId]);

  const selectedProfile =
    filteredProfiles.find((profile) => profile.id === selectedProfileId) || null;
  const visibleIds = filteredProfiles.map((profile) => profile.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedProfileIds.includes(id));

  async function reloadSavedFilters() {
    const response = await fetch("/api/admin/filters?pageKey=crm", {
      cache: "no-store"
    });
    const payload = await response.json();

    if (response.ok) {
      setSavedFilters(payload.filters || []);
    }
  }

  function toggleProfileSelection(profileId, checked) {
    setSelectedProfileIds((current) =>
      checked ? [...new Set([...current, profileId])] : current.filter((id) => id !== profileId)
    );
  }

  function toggleAllVisible(checked) {
    setSelectedProfileIds((current) => {
      if (checked) {
        return [...new Set([...current, ...visibleIds])];
      }

      return current.filter((id) => !visibleIds.includes(id));
    });
  }

  function runBulkAction(action) {
    if (!selectedProfileIds.length) {
      return;
    }

    startBulkTransition(async () => {
      setBulkMessage("");

      try {
        const response = await fetch("/api/admin/customers/bulk", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            action,
            customerIds: selectedProfileIds
          })
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Bulk action CRM fallita.");
        }

        setBulkMessage(`Azione ${action} applicata a ${payload.updated} profili.`);
        setSelectedProfileIds([]);
        window.location.reload();
      } catch (error) {
        setBulkMessage(error.message || "Bulk action CRM fallita.");
      }
    });
  }

  async function saveCurrentFilter() {
    const name = window.prompt("Nome del filtro CRM da salvare");

    if (!name) {
      return;
    }

    const response = await fetch("/api/admin/filters", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        pageKey: "crm",
        name,
        filters: {
          query,
          typeFilter,
          bandFilter
        }
      })
    });
    const payload = await response.json();

    if (response.ok) {
      setSavedFilterId(payload.filter.id);
      await reloadSavedFilters();
    }
  }

  async function deleteCurrentSavedFilter() {
    if (!savedFilterId) {
      return;
    }

    await fetch(`/api/admin/filters?filterId=${encodeURIComponent(savedFilterId)}`, {
      method: "DELETE"
    });
    setSavedFilterId("");
    await reloadSavedFilters();
  }

  return (
    <div className="page-stack">
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>CRM clienti e prospect</h2>
            <p>Lista operativa, scoring leggibile, filtri salvati e azioni bulk su profili.</p>
          </div>
          <div className="row-meta">
            <span>{filteredProfiles.length} visibili</span>
            <span>{stats.total} profili totali</span>
          </div>
        </div>

        <div className="crm-stats-grid">
          <article className="summary-chip">
            <strong>{stats.clienti}</strong>
            <span>clienti</span>
          </article>
          <article className="summary-chip">
            <strong>{stats.prospect}</strong>
            <span>prospect</span>
          </article>
          <article className="summary-chip">
            <strong>{stats.highValue}</strong>
            <span>{CUSTOMER_SCORE_BAND_SUMMARY_LABELS.A}</span>
          </article>
          <article className="summary-chip">
            <strong>{stats.risk}</strong>
            <span>{CUSTOMER_SCORE_BAND_SUMMARY_LABELS.D}</span>
          </article>
        </div>
      </section>

      <section className="panel-card">
        <div className="crm-toolbar">
          <label className="search-input-shell">
            <span className="sr-only">Cerca cliente</span>
            <input
              onChange={(event) => {
                const value = event.target.value;
                startTransition(() => {
                  setQuery(value);
                });
              }}
              placeholder="Cerca per nome, email, telefono, sede o tag"
              type="search"
              value={query}
            />
          </label>

          <div className="crm-filter-group">
            {typeFilters.map((value) => (
              <button
                className={typeFilter === value ? "status-filter-button active" : "status-filter-button"}
                key={value}
                onClick={() => {
                  startTransition(() => {
                    setTypeFilter(value);
                  });
                }}
                type="button"
              >
                <strong>{value === "ALL" ? "Tutti" : value === "CLIENTE" ? "Clienti" : "Prospect"}</strong>
              </button>
            ))}
          </div>

          <div className="crm-filter-group">
            {bandFilters.map((value) => (
              <button
                className={bandFilter === value ? "status-filter-button active" : "status-filter-button"}
                key={value}
                onClick={() => {
                  startTransition(() => {
                    setBandFilter(value);
                  });
                }}
                type="button"
              >
                <strong>
                  {value === "ALL"
                    ? "Tutti i segmenti"
                    : CUSTOMER_SCORE_BAND_LABELS[value] || value}
                </strong>
              </button>
            ))}
          </div>

          <div className="menu-filter-grid">
            <label>
              <span className="sr-only">Filtro CRM salvato</span>
              <select
                onChange={(event) => {
                  const nextId = event.target.value;
                  setSavedFilterId(nextId);
                  const savedFilter = savedFilters.find((item) => item.id === nextId);

                  if (savedFilter) {
                    applySavedFilterConfig(savedFilter, {
                      setQuery,
                      setTypeFilter,
                      setBandFilter
                    });
                  }
                }}
                value={savedFilterId}
              >
                <option value="">Filtri salvati</option>
                {savedFilters.map((filter) => (
                  <option key={filter.id} value={filter.id}>
                    {filter.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="micro-actions">
            <button className="button button-muted" onClick={saveCurrentFilter} type="button">
              Salva filtro
            </button>
            {savedFilterId ? (
              <button className="button button-muted" onClick={deleteCurrentSavedFilter} type="button">
                Elimina filtro
              </button>
            ) : null}
          </div>
        </div>

        {selectedProfileIds.length > 0 ? (
          <div className="reservation-bulk-bar">
            <strong>{selectedProfileIds.length} profili selezionati</strong>
            <div className="micro-actions">
              <button className="button button-muted" onClick={() => runBulkAction("MARK_VIP")} type="button">
                Segna VIP
              </button>
              <button className="button button-muted" onClick={() => runBulkAction("UNMARK_VIP")} type="button">
                Rimuovi VIP
              </button>
              <button className="button button-muted" onClick={() => runBulkAction("ARCHIVE")} type="button">
                Archivia
              </button>
              <button className="button button-muted" onClick={() => runBulkAction("RESTORE")} type="button">
                Ripristina
              </button>
            </div>
            {isPending ? <span className="helper-copy">Applico azione CRM...</span> : null}
          </div>
        ) : null}

        {bulkMessage ? (
          <p className={bulkMessage.includes("fallita") ? "form-error" : "form-success"}>
            {bulkMessage}
          </p>
        ) : null}

        <div className="crm-workspace">
          <div className="crm-list-shell">
            <div className="crm-list-head">
              <span>
                <input
                  checked={allVisibleSelected}
                  onChange={(event) => toggleAllVisible(event.target.checked)}
                  type="checkbox"
                />
              </span>
              <span>Contatto</span>
              <span>Tipo</span>
              <span>Priority</span>
              <span>Storico</span>
              <span>Valore</span>
              <span>Ultimo touch</span>
            </div>

            <div className="crm-list">
              {filteredProfiles.map((profile) => (
                <CrmListRow
                  active={profile.id === selectedProfileId}
                  checked={selectedProfileIds.includes(profile.id)}
                  key={profile.id}
                  onSelect={() => setSelectedProfileId(profile.id)}
                  onToggle={(checked) => toggleProfileSelection(profile.id, checked)}
                  profile={profile}
                />
              ))}

              {filteredProfiles.length === 0 ? (
                <div className="empty-state-card">
                  <strong>Nessun profilo nei filtri correnti</strong>
                  <p>Prova a cambiare segmento o ricerca. I filtri CRM possono essere salvati per ruolo e riutilizzati dal team.</p>
                </div>
              ) : null}
            </div>
          </div>

          <CrmDetail profile={selectedProfile} />
        </div>
      </section>
    </div>
  );
}
