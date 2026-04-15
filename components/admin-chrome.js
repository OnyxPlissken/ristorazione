"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { logoutAction } from "../lib/actions/auth-actions";
import AdminSidebarNav from "./admin-sidebar-nav";

function BurgerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

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

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(initialReservationSummary?.pendingCount || 0);
  const [recentReservations, setRecentReservations] = useState(
    initialReservationSummary?.recentReservations || []
  );
  const [unseenIds, setUnseenIds] = useState([]);
  const knownIdsRef = useRef(new Set((initialReservationSummary?.recentReservations || []).map((item) => item.id)));
  const bellShellRef = useRef(null);
  const drawerRef = useRef(null);
  const canWatchReservations = items.some((item) => item.page === "reservations");

  const syncSummary = useEffectEvent((summary) => {
    if (!summary) {
      return;
    }

    setPendingCount(summary.pendingCount || 0);

    const nextReservations = summary.recentReservations || [];
    const newIds = nextReservations
      .filter((reservation) => !knownIdsRef.current.has(reservation.id))
      .map((reservation) => reservation.id);

    if (newIds.length > 0 && !bellOpen) {
      setUnseenIds((current) => [...new Set([...newIds, ...current])].slice(0, 12));
    }

    const nextKnownIds = new Set(knownIdsRef.current);
    nextReservations.forEach((reservation) => {
      nextKnownIds.add(reservation.id);
    });
    knownIdsRef.current = nextKnownIds;

    setRecentReservations(nextReservations);
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
    if (!bellOpen) {
      return;
    }

    setUnseenIds([]);
  }, [bellOpen]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setBellOpen(false);
        setDrawerOpen(false);
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
  }, [bellOpen, drawerOpen]);

  const notificationItems = useMemo(
    () =>
      recentReservations.map((reservation) => ({
        ...reservation,
        isUnseen: unseenIds.includes(reservation.id)
      })),
    [recentReservations, unseenIds]
  );

  return (
    <div className="admin-shell">
      <div
        aria-hidden={drawerOpen ? "false" : "true"}
        className={drawerOpen ? "admin-overlay active" : "admin-overlay"}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setDrawerOpen(false);
          }
        }}
      >
        <aside
          className={drawerOpen ? "admin-sidebar is-open" : "admin-sidebar"}
          id="admin-menu"
          ref={drawerRef}
        >
          <div className="admin-sidebar-header">
            <div>
              <Link className="brand" href="/admin" onClick={() => setDrawerOpen(false)}>
                Coperto
              </Link>
              <p className="sidebar-copy">Gestionale ristorazione in italiano.</p>
            </div>

            <button
              aria-label="Chiudi menu"
              className="icon-button icon-button-ghost"
              onClick={() => setDrawerOpen(false)}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>

          <AdminSidebarNav
            items={items}
            onNavigate={() => setDrawerOpen(false)}
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
              aria-expanded={drawerOpen ? "true" : "false"}
              aria-label="Apri menu"
              className="icon-button burger-button"
              onClick={() => setDrawerOpen((current) => !current)}
              type="button"
            >
              <BurgerIcon />
            </button>

            <div>
              <div className="eyebrow">Pannello amministrativo</div>
              <h1>Gestione operativa</h1>
            </div>
          </div>

          <div className="admin-toolbar-actions">
            {canWatchReservations ? (
              <div className="notification-shell" ref={bellShellRef}>
                <button
                  aria-expanded={bellOpen ? "true" : "false"}
                  aria-label="Apri notifiche prenotazioni"
                  className={bellOpen ? "icon-button notification-button active" : "icon-button notification-button"}
                  onClick={() => setBellOpen((current) => !current)}
                  type="button"
                >
                  <BellIcon />
                  {unseenIds.length > 0 ? (
                    <span className="notification-badge">{unseenIds.length}</span>
                  ) : null}
                </button>

                {bellOpen ? (
                  <div className="notification-panel" role="dialog">
                    <div className="notification-panel-header">
                      <div>
                        <strong>Notifiche prenotazioni</strong>
                        <p>{pendingCount} prenotazioni in attesa di gestione</p>
                      </div>
                      <Link href="/admin/prenotazioni" onClick={() => setBellOpen(false)}>
                        Apri lista
                      </Link>
                    </div>

                    <div className="notification-list">
                      {notificationItems.map((reservation) => (
                        <Link
                          className={
                            reservation.isUnseen
                              ? "notification-item unread"
                              : "notification-item"
                          }
                          href="/admin/prenotazioni"
                          key={reservation.id}
                          onClick={() => setBellOpen(false)}
                        >
                          <div className="notification-item-head">
                            <strong>{reservation.guestName}</strong>
                            {reservation.isUnseen ? <span className="notification-pill">Nuova</span> : null}
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

                      {notificationItems.length === 0 ? (
                        <div className="notification-empty">
                          <strong>Nessuna notifica recente</strong>
                          <p>Le nuove prenotazioni appariranno qui in tempo reale.</p>
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

        {children}
      </div>
    </div>
  );
}
