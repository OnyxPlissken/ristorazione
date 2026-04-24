"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { formatDateTime } from "../lib/format";

const tabs = [
  { value: "notifications", label: "Notifiche" },
  { value: "queue", label: "Queue" },
  { value: "audit", label: "Audit" }
];

function matchesQuery(item, query) {
  if (!query) {
    return true;
  }

  return [
    item.event,
    item.action,
    item.summary,
    item.destination,
    item.subject,
    item.locationName,
    item.errorMessage,
    item.lastError
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export default function AdminActivityLogPanel({ data }) {
  const [activeTab, setActiveTab] = useState("notifications");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const notificationRows = useMemo(
    () =>
      data.notificationLogs.filter((item) => {
        const matchesStatus = statusFilter === "ALL" ? true : item.status === statusFilter;
        return matchesStatus && matchesQuery(item, normalizedQuery);
      }),
    [data.notificationLogs, normalizedQuery, statusFilter]
  );
  const queueRows = useMemo(
    () =>
      data.notificationJobs.filter((item) => {
        const matchesStatus = statusFilter === "ALL" ? true : item.status === statusFilter;
        return matchesStatus && matchesQuery(item, normalizedQuery);
      }),
    [data.notificationJobs, normalizedQuery, statusFilter]
  );
  const auditRows = useMemo(
    () =>
      data.auditLogs.filter((item) => {
        const matchesStatus = statusFilter === "ALL" ? true : item.action === statusFilter;
        return matchesStatus && matchesQuery(item, normalizedQuery);
      }),
    [data.auditLogs, normalizedQuery, statusFilter]
  );

  const currentRows =
    activeTab === "notifications"
      ? notificationRows
      : activeTab === "queue"
        ? queueRows
        : auditRows;

  return (
    <div className="page-stack">
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Registro operativo</h2>
            <p>Storico invii, queue con retry e audit leggibile con filtro veloce.</p>
          </div>
          <div className="row-meta">
            <span>{currentRows.length} righe</span>
            <span>{data.stats.queuedNotifications} job pendenti</span>
          </div>
        </div>

        <div className="permission-role-strip">
          <div className="summary-chip">
            <strong>{data.stats.notificationsLast24h}</strong>
            <span>notifiche 24h</span>
          </div>
          <div className="summary-chip">
            <strong>{data.stats.failedNotificationsLast24h}</strong>
            <span>fallite 24h</span>
          </div>
          <div className="summary-chip">
            <strong>{data.stats.auditLast24h}</strong>
            <span>azioni tracciate 24h</span>
          </div>
          <div className="summary-chip">
            <strong>{data.stats.queuedNotifications}</strong>
            <span>queue pendente</span>
          </div>
        </div>

        <div className="reservation-toolbar">
          <label className="search-input-shell">
            <span className="sr-only">Cerca nel registro</span>
            <input
              onChange={(event) => {
                const value = event.target.value;
                startTransition(() => setQuery(value));
              }}
              placeholder="Cerca evento, destinazione, errore o entita"
              type="search"
              value={query}
            />
          </label>

          <div className="admin-section-tabs">
            {tabs.map((tab) => (
              <button
                className={activeTab === tab.value ? "admin-section-tab active" : "admin-section-tab"}
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                type="button"
              >
                <strong>{tab.label}</strong>
              </button>
            ))}
          </div>

          <div className="micro-actions">
            <a className="button button-muted" href="/api/admin/exports/notifications">
              CSV notifiche
            </a>
            <a className="button button-muted" href="/api/admin/exports/audit">
              CSV audit
            </a>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="activity-log-list">
          {activeTab === "notifications"
            ? notificationRows.map((item) => (
                <article className="activity-log-card" key={item.id}>
                  <div className="activity-log-head">
                    <div>
                      <strong>{item.event}</strong>
                      <p>{item.locationName}</p>
                    </div>
                    <span className={`table-status-chip ${String(item.status || "").toLowerCase()}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="info-list">
                    <div>
                      <strong>Canale</strong>
                      <span>{item.channel}</span>
                    </div>
                    <div>
                      <strong>Destinazione</strong>
                      <span>{item.destination || "Non disponibile"}</span>
                    </div>
                    <div>
                      <strong>Quando</strong>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </div>
                  </div>
                  {item.contentPreview ? (
                    <div className="note-box">
                      <strong>Anteprima</strong>
                      <p>{item.contentPreview}</p>
                    </div>
                  ) : null}
                  {item.errorMessage ? <div className="form-error">{item.errorMessage}</div> : null}
                </article>
              ))
            : null}

          {activeTab === "queue"
            ? queueRows.map((item) => (
                <article className="activity-log-card" key={item.id}>
                  <div className="activity-log-head">
                    <div>
                      <strong>{item.event}</strong>
                      <p>{item.locationName}</p>
                    </div>
                    <span className="table-status-chip scheduled">{item.status}</span>
                  </div>
                  <div className="info-list">
                    <div>
                      <strong>Canale</strong>
                      <span>{item.channel}</span>
                    </div>
                    <div>
                      <strong>Tentativi</strong>
                      <span>
                        {item.attempts}/{item.maxAttempts}
                      </span>
                    </div>
                    <div>
                      <strong>Prossimo tentativo</strong>
                      <span>{formatDateTime(item.nextAttemptAt)}</span>
                    </div>
                  </div>
                  {item.content ? (
                    <div className="note-box">
                      <strong>Payload</strong>
                      <p>{String(item.content).slice(0, 240)}</p>
                    </div>
                  ) : null}
                  {item.lastError ? <div className="form-error">{item.lastError}</div> : null}
                </article>
              ))
            : null}

          {activeTab === "audit"
            ? auditRows.map((item) => (
                <article className="activity-log-card" key={item.id}>
                  <div className="activity-log-head">
                    <div>
                      <strong>{item.summary}</strong>
                      <p>
                        {item.locationName} / {item.entityType}
                      </p>
                    </div>
                    <span className="table-status-chip free">{item.action}</span>
                  </div>
                  <div className="info-list">
                    <div>
                      <strong>Utente</strong>
                      <span>{item.user?.name || "Sistema"}</span>
                    </div>
                    <div>
                      <strong>Entita</strong>
                      <span>{item.entityId}</span>
                    </div>
                    <div>
                      <strong>Quando</strong>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </div>
                  </div>
                </article>
              ))
            : null}

          {currentRows.length === 0 ? (
            <div className="empty-state-card">
              <strong>Nessuna riga nel registro</strong>
              <p>Prova a cambiare tab o ricerca. Qui compariranno invii, retry e azioni tracciate.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
