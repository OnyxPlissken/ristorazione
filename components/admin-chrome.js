"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { logoutAction } from "../lib/actions/auth-actions";
import AdminSidebarNav from "./admin-sidebar-nav";

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 4a4 4 0 0 0-4 4v2.2c0 .9-.3 1.8-.8 2.5L5.8 15a1 1 0 0 0 .8 1.6h10.8a1 1 0 0 0 .8-1.6l-1.4-2.3a4.6 4.6 0 0 1-.8-2.5V8a4 4 0 0 0-4-4Zm0 16a2.6 2.6 0 0 0 2.4-1.6h-4.8A2.6 2.6 0 0 0 12 20Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SidebarToggleIcon({ hidden }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d={hidden ? "M8.5 8.5l3 3-3 3" : "M11.5 8.5l-3 3 3 3"}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d={hidden ? "M6.5 7v10" : "M17.5 7v10"}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function formatNotificationTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function AdminChrome({
  children,
  initialReservationSummary,
  items,
  showPermissions,
  userName,
  userRoleLabel
}) {
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(initialReservationSummary?.pendingCount || 0);
  const [pendingReservations, setPendingReservations] = useState(
    initialReservationSummary?.pendingReservations ||
      initialReservationSummary?.recentReservations ||
      []
  );
  const bellShellRef = useRef(null);
  const canWatchReservations = items.some((item) => item.page === "reservations");

  useEffect(() => {
    const storedValue = window.localStorage.getItem("coperto-admin-sidebar-hidden");
    setSidebarHidden(storedValue === "1");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("coperto-admin-sidebar-hidden", sidebarHidden ? "1" : "0");
  }, [sidebarHidden]);

  const syncSummary = useEffectEvent((summary) => {
    if (!summary) {
      return;
    }

    setPendingCount(summary.pendingCount || 0);
    setPendingReservations(summary.pendingReservations || summary.recentReservations || []);
  });

  useEffect(() => {
    if (!canWatchReservations) {
      return undefined;
    }

    let active = true;

    const poll = async () => {
      try {
        const response = await fetch("/api/admin/reservations/live", {
          cache: "no-store"
        });

        if (!response.ok) {
          return;
        }

        const summary = await response.json();

        if (active) {
          syncSummary(summary);
        }
      } catch {
        // Ignore transient polling errors.
      }
    };

    void poll();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    }, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [canWatchReservations, syncSummary]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setBellOpen(false);
      }
    }

    function handleClick(event) {
      if (
        bellOpen &&
        bellShellRef.current &&
        !bellShellRef.current.contains(event.target)
      ) {
        setBellOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [bellOpen]);

  return (
    <div className={sidebarHidden ? "admin-shell sidebar-hidden" : "admin-shell"}>
      <div className="admin-sidebar-wrap">
        <aside className="admin-sidebar" id="admin-menu">
          <div className="admin-sidebar-header">
            <div>
              <Link className="brand" href="/admin">
                Coperto
              </Link>
              <p className="sidebar-copy">Gestionale ristorazione in italiano.</p>
            </div>
          </div>

          <AdminSidebarNav
            items={items}
            pendingCount={pendingCount}
            showPermissions={showPermissions}
          />

          <div className="sidebar-user">
            <strong>{userName}</strong>
            <span>{userRoleLabel}</span>
          </div>

          <form action={logoutAction}>
            <button className="button button-secondary button-full" type="submit">
              Esci
            </button>
          </form>
        </aside>
      </div>

      <div className="admin-content">
        <header className="admin-topbar">
          <div className="admin-toolbar-left">
            <button
              aria-controls="admin-menu"
              aria-expanded={sidebarHidden ? "false" : "true"}
              aria-label={sidebarHidden ? "Mostra menu laterale" : "Nascondi menu laterale"}
              className="icon-button panel-toggle-button"
              onClick={() => setSidebarHidden((current) => !current)}
              type="button"
            >
              <SidebarToggleIcon hidden={sidebarHidden} />
            </button>

            <div className="admin-topbar-copy">
              <div className="eyebrow">Backoffice tecnico</div>
              <h1>Amministrazione Coperto</h1>
              <p>Gestione operativa, configurazione e controllo sedi.</p>
            </div>
          </div>

          <div className="admin-toolbar-actions">
            {canWatchReservations ? (
              <div className="notification-shell" ref={bellShellRef}>
                <button
                  aria-expanded={bellOpen ? "true" : "false"}
                  aria-label="Apri prenotazioni da gestire"
                  className={
                    bellOpen
                      ? "icon-button notification-button active"
                      : "icon-button notification-button"
                  }
                  onClick={() => setBellOpen((current) => !current)}
                  type="button"
                >
                  <BellIcon />
                  <span
                    className={pendingCount > 0 ? "notification-badge" : "notification-badge zero"}
                  >
                    {pendingCount}
                  </span>
                </button>

                {bellOpen ? (
                  <div className="notification-panel" role="dialog">
                    <div className="notification-panel-header">
                      <div>
                        <strong>Prenotazioni da gestire</strong>
                        <p>{pendingCount} prenotazioni in attesa di gestione</p>
                      </div>
                      <Link href="/admin/prenotazioni" onClick={() => setBellOpen(false)}>
                        Apri lista
                      </Link>
                    </div>

                    <div className="notification-list">
                      {pendingReservations.map((reservation) => (
                        <Link
                          className="notification-item pending"
                          href="/admin/prenotazioni"
                          key={reservation.id}
                          onClick={() => setBellOpen(false)}
                        >
                          <div className="notification-item-head">
                            <strong>{reservation.guestName}</strong>
                            <span className="notification-pill">In attesa</span>
                          </div>
                          <p>
                            {reservation.locationName} - {reservation.guests} ospiti
                          </p>
                          <div className="notification-meta">
                            <span>Arrivo {formatNotificationTime(reservation.dateTime)}</span>
                            <span>Ricevuta {formatNotificationTime(reservation.createdAt)}</span>
                          </div>
                        </Link>
                      ))}

                      {pendingReservations.length === 0 ? (
                        <div className="notification-empty">
                          <strong>Nessuna prenotazione da gestire</strong>
                          <p>Quando arriva una nuova richiesta in attesa la vedrai qui subito.</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <Link className="button button-muted" href="/prenota">
              Pagina prenotazione
            </Link>
          </div>
        </header>

        <main className="admin-page-main">{children}</main>
      </div>
    </div>
  );
}
