"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";
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
    ...(profile.locations || []).map((location) => location.name)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function bandTone(band) {
  if (band === "A") {
    return "band-a";
  }

  if (band === "D") {
    return "band-d";
  }

  if (band === "C") {
    return "band-c";
  }

  return "band-b";
}

function CrmListRow({ active, onSelect, profile }) {
  return (
    <button
      className={active ? "crm-list-row active" : "crm-list-row"}
      onClick={onSelect}
      type="button"
    >
      <div className="crm-cell crm-primary">
        <strong>{profile.displayName}</strong>
        <small>{profile.normalizedEmail || profile.normalizedPhone || "Contatto non disponibile"}</small>
      </div>
      <div className="crm-cell">
        <span className={`customer-band-chip ${bandTone(profile.band)}`}>{profile.band}</span>
        <small>{profile.type}</small>
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
        <p>Scegli un cliente o prospect dalla lista per vedere storico e scoring.</p>
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
          <span className={`customer-band-chip ${bandTone(profile.band)}`}>Fascia {profile.band}</span>
          <span className="location-chip highlighted">{profile.type}</span>
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
        {(profile.locations || []).map((location) => (
          <span className="location-chip" key={`${profile.id}-${location.id}`}>
            {location.name}
          </span>
        ))}
      </div>

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

export default function AdminCustomerCrmPanel({ profiles, stats }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [bandFilter, setBandFilter] = useState("ALL");
  const [selectedProfileId, setSelectedProfileId] = useState(profiles[0]?.id || "");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredProfiles = profiles.filter((profile) => {
    const typeMatch = typeFilter === "ALL" ? true : profile.type === typeFilter;
    const bandMatch = bandFilter === "ALL" ? true : profile.band === bandFilter;
    return typeMatch && bandMatch && matchesSearch(profile, normalizedQuery);
  });

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

  return (
    <div className="page-stack">
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>CRM clienti e prospect</h2>
            <p>Una sola lista operativa per clienti acquisiti, prospect e scoring commerciale.</p>
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
            <span>fascia A</span>
          </article>
          <article className="summary-chip">
            <strong>{stats.risk}</strong>
            <span>fascia D</span>
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
              placeholder="Cerca per nome, email, telefono o sede"
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
                <strong>{value === "ALL" ? "Tutte le fasce" : `Fascia ${value}`}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="crm-workspace">
          <div className="crm-list-shell">
            <div className="crm-list-head">
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
                  key={profile.id}
                  onSelect={() => setSelectedProfileId(profile.id)}
                  profile={profile}
                />
              ))}

              {filteredProfiles.length === 0 ? (
                <p className="empty-copy">Nessun profilo corrisponde ai filtri correnti.</p>
              ) : null}
            </div>
          </div>

          <CrmDetail profile={selectedProfile} />
        </div>
      </section>
    </div>
  );
}
