"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";

function formatToastTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function AdminSidebarNav({
  items,
  showPermissions,
  initialPendingCount = 0,
  initialLatestReservation = null
}) {
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [notification, setNotification] = useState(null);
  const latestReservationIdRef = useRef(initialLatestReservation?.id || null);
  const latestReservationCreatedAtRef = useRef(initialLatestReservation?.createdAt || null);
  const canWatchReservations = items.some((item) => item.page === "reservations");

  const syncSummary = useEffectEvent((summary) => {
    if (!summary) {
      return;
    }

    setPendingCount(summary.pendingCount || 0);

    const latestReservation = summary.latestReservation;

    if (
      latestReservation &&
      latestReservationCreatedAtRef.current &&
      new Date(latestReservation.createdAt).getTime() >
        new Date(latestReservationCreatedAtRef.current).getTime() &&
      latestReservation.id !== latestReservationIdRef.current
    ) {
      setNotification(latestReservation);
    }

    if (latestReservation?.id) {
      latestReservationIdRef.current = latestReservation.id;
    }

    if (latestReservation?.createdAt) {
      latestReservationCreatedAtRef.current = latestReservation.createdAt;
    }
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

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    };

    const intervalId = window.setInterval(handleVisibility, 15000);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [canWatchReservations, syncSummary]);

  useEffect(() => {
    if (!notification) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotification(null);
    }, 7000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notification]);

  return (
    <>
      <nav className="sidebar-nav">
        {items.map((item) => {
          const isReservations = item.page === "reservations";

          return (
            <Link className="sidebar-link" href={item.href} key={item.href}>
              <span className="nav-label">{item.label}</span>
              {isReservations && pendingCount > 0 ? (
                <span className="nav-badge">{pendingCount}</span>
              ) : null}
            </Link>
          );
        })}
        {showPermissions ? (
          <Link className="sidebar-link" href="/admin/permessi">
            <span className="nav-label">Permessi</span>
          </Link>
        ) : null}
      </nav>

      {notification ? (
        <div className="realtime-toast" role="status">
          <div>
            <strong>Nuova prenotazione</strong>
            <p>
              {notification.guestName} - {notification.locationName}
            </p>
            <span>{formatToastTime(notification.dateTime)}</span>
          </div>
          <button
            className="toast-dismiss"
            onClick={() => setNotification(null)}
            type="button"
          >
            Chiudi
          </button>
        </div>
      ) : null}
    </>
  );
}
