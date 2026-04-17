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
  handheldMode = false,
  initialNotificationSummary,
  initialReservationSummary,
  items,
  showPermissions,
  userName,
  userRoleLabel
}) {
  const [sidebarHidden, setSidebarHidden] = useState(true);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(initialReservationSummary?.pendingCount || 0);
  const [unreadCount, setUnreadCount] = useState(initialNotificationSummary?.unreadCount || 0);
  const [recentNotifications, setRecentNotifications] = useState(
    initialNotificationSummary?.recentNotifications || []
  );
  const [toastItems, setToastItems] = useState([]);
  const bellShellRef = useRef(null);
  const previousUnreadCountRef = useRef(initialNotificationSummary?.unreadCount || 0);
  const knownNotificationIdsRef = useRef(
    new Set((initialNotificationSummary?.recentNotifications || []).map((item) => item.id))
  );
  const canWatchReservations = items.some((item) => item.page === "reservations");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1180px)");
    const syncViewport = () => {
      const compact = mediaQuery.matches;
      setIsCompactViewport(compact);

      if (compact) {
        setSidebarHidden(true);
        return;
      }

      const storedValue = window.localStorage.getItem("coperto-admin-sidebar-hidden");
      setSidebarHidden(storedValue === "1");
    };

    syncViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => mediaQuery.removeEventListener("change", syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    if (isCompactViewport) {
      return;
    }

    window.localStorage.setItem("coperto-admin-sidebar-hidden", sidebarHidden ? "1" : "0");
  }, [isCompactViewport, sidebarHidden]);

  useEffect(() => {
    if (!isCompactViewport || sidebarHidden) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCompactViewport, sidebarHidden]);

  const syncSummary = useEffectEvent((summary) => {
    if (!summary) {
      return;
    }

    setPendingCount(summary.pendingCount || 0);
  });

  const syncNotifications = useEffectEvent((summary) => {
    if (!summary) {
      return;
    }

    const nextUnreadCount = summary.unreadCount || 0;
    const nextNotifications = summary.recentNotifications || [];
    const newUnreadNotifications = nextNotifications.filter(
      (item) => item.unread && !knownNotificationIdsRef.current.has(item.id)
    );

    nextNotifications.forEach((item) => knownNotificationIdsRef.current.add(item.id));
    setUnreadCount(nextUnreadCount);
    setRecentNotifications(nextNotifications);

    if (newUnreadNotifications.length > 0 && nextUnreadCount >= previousUnreadCountRef.current) {
      setToastItems((current) => [
        ...newUnreadNotifications.slice(0, 3).map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          href: item.href
        })),
        ...current
      ].slice(0, 4));

      if (document.visibilityState === "visible") {
        window.navigator.vibrate?.(80);
      }
    }

    previousUnreadCountRef.current = nextUnreadCount;
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
    let active = true;

    const poll = async () => {
      try {
        const response = await fetch("/api/admin/notifications/live", {
          cache: "no-store"
        });

        if (!response.ok) {
          return;
        }

        const summary = await response.json();

        if (active) {
          syncNotifications(summary);
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
    }, 10000);

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
  }, [syncNotifications]);

  useEffect(() => {
    if (toastItems.length === 0) {
      return undefined;
    }

    const timers = toastItems.map((toast) =>
      window.setTimeout(() => {
        setToastItems((current) => current.filter((item) => item.id !== toast.id));
      }, 5500)
    );

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [toastItems]);

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

  const shellClassName = [
    "admin-shell",
    sidebarHidden ? "sidebar-hidden" : "",
    isCompactViewport ? "compact-viewport" : "",
    handheldMode ? "handheld-mode" : ""
  ]
    .filter(Boolean)
    .join(" ");

  function handleNavigation() {
    if (isCompactViewport) {
      setSidebarHidden(true);
    }
  }

  async function markNotificationRead(notificationId) {
    if (!notificationId) {
      return;
    }

    setRecentNotifications((current) =>
      current.map((item) => (item.id === notificationId ? { ...item, unread: false } : item))
    );
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      await fetch("/api/admin/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          notificationId
        })
      });
    } catch {
      // Ignore best-effort read sync failures.
    }
  }

  async function markAllNotificationsRead() {
    setRecentNotifications((current) => current.map((item) => ({ ...item, unread: false })));
    setUnreadCount(0);

    try {
      await fetch("/api/admin/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          all: true
        })
      });
    } catch {
      // Ignore best-effort read sync failures.
    }
  }

  return (
    <div className={shellClassName}>
      {isCompactViewport && !sidebarHidden ? (
        <button
          aria-label="Chiudi menu laterale"
          className="admin-sidebar-backdrop"
          onClick={() => setSidebarHidden(true)}
          type="button"
        />
      ) : null}

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
            onNavigate={handleNavigation}
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
            <div className="notification-toast-stack" aria-live="polite">
              {toastItems.map((toast) => (
                <Link
                  className="notification-toast"
                  href={toast.href || "/admin"}
                  key={toast.id}
                  onClick={() => {
                    void markNotificationRead(toast.id);
                    setToastItems((current) => current.filter((item) => item.id !== toast.id));
                  }}
                >
                  <strong>{toast.title}</strong>
                  <span>{toast.body}</span>
                </Link>
              ))}
            </div>

            {canWatchReservations || recentNotifications.length > 0 ? (
              <div className="notification-shell" ref={bellShellRef}>
                <button
                  aria-expanded={bellOpen ? "true" : "false"}
                  aria-label="Apri centro notifiche"
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
                    className={unreadCount > 0 ? "notification-badge" : "notification-badge zero"}
                  >
                    {unreadCount}
                  </span>
                </button>

                {bellOpen ? (
                  <div className="notification-panel" role="dialog">
                    <div className="notification-panel-header">
                      <div>
                        <strong>Centro notifiche</strong>
                        <p>
                          {unreadCount} non lette / {pendingCount} prenotazioni in attesa
                        </p>
                      </div>
                      <div className="micro-actions">
                        <button
                          className="button button-muted"
                          onClick={() => void markAllNotificationsRead()}
                          type="button"
                        >
                          Segna tutte lette
                        </button>
                        <Link href="/admin/registro" onClick={() => setBellOpen(false)}>
                          Apri registro
                        </Link>
                      </div>
                    </div>

                    <div className="notification-list">
                      {recentNotifications.map((notification) => (
                        <Link
                          className={
                            notification.unread
                              ? "notification-item pending unread"
                              : "notification-item"
                          }
                          href={notification.href || "/admin"}
                          key={notification.id}
                          onClick={() => {
                            void markNotificationRead(notification.id);
                            setBellOpen(false);
                          }}
                        >
                          <div className="notification-item-head">
                            <strong>{notification.title}</strong>
                            <span className="notification-pill">
                              {notification.unread ? "Nuova" : "Letta"}
                            </span>
                          </div>
                          <p>{notification.body}</p>
                          <div className="notification-meta">
                            <span>{notification.locationName}</span>
                            <span>{formatNotificationTime(notification.createdAt)}</span>
                          </div>
                        </Link>
                      ))}

                      {recentNotifications.length === 0 ? (
                        <div className="notification-empty">
                          <strong>Nessuna notifica</strong>
                          <p>Le nuove prenotazioni, richieste tavolo e eventi di sala appariranno qui.</p>
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

        {handheldMode ? (
          <div className="admin-handheld-nav-wrap">
            <AdminSidebarNav
              items={items}
              onNavigate={handleNavigation}
              pendingCount={pendingCount}
              showPermissions={showPermissions}
              variant="handheld"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
