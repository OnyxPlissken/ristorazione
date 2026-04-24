"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function flattenResults(results) {
  return [
    ...(results.reservations || []).map((item) => ({ ...item, group: "Prenotazioni" })),
    ...(results.customers || []).map((item) => ({ ...item, group: "CRM" })),
    ...(results.locations || []).map((item) => ({ ...item, group: "Sedi" })),
    ...(results.menus || []).map((item) => ({ ...item, group: "Menu" })),
    ...(results.tables || []).map((item) => ({ ...item, group: "Tavoli" }))
  ];
}

export default function AdminGlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({
    reservations: [],
    customers: [],
    locations: [],
    menus: [],
    tables: []
  });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const shellRef = useRef(null);
  const flattened = flattenResults(results);

  useEffect(() => {
    if (!query.trim()) {
      setResults({
        reservations: [],
        customers: [],
        locations: [],
        menus: [],
        tables: []
      });
      return;
    }

    let cancelled = false;
    const timerId = window.setTimeout(async () => {
      setLoading(true);

      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, {
          cache: "no-store"
        });
        const payload = await response.json();

        if (!cancelled && response.ok) {
          setResults(payload);
          setOpen(true);
        }
      } catch {
        // Ignore transient search failures.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [query]);

  useEffect(() => {
    function handleClick(event) {
      if (shellRef.current && !shellRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="admin-global-search" ref={shellRef}>
      <label className="search-input-shell admin-global-search-input">
        <span className="sr-only">Ricerca globale</span>
        <input
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (flattened.length > 0) {
              setOpen(true);
            }
          }}
          placeholder="Ricerca globale: prenotazioni, clienti, sedi, menu, tavoli"
          type="search"
          value={query}
        />
      </label>

      {open ? (
        <div className="admin-search-panel">
          {loading ? <p className="empty-copy">Sto cercando nel backoffice...</p> : null}

          {!loading && flattened.length === 0 ? (
            <p className="empty-copy">
              {query.trim() ? "Nessun risultato." : "Inizia a digitare per cercare."}
            </p>
          ) : null}

          {!loading
            ? ["Prenotazioni", "CRM", "Sedi", "Menu", "Tavoli"].map((group) => {
                const items = flattened.filter((item) => item.group === group);

                if (!items.length) {
                  return null;
                }

                return (
                  <div className="admin-search-group" key={group}>
                    <strong>{group}</strong>
                    {items.map((item) => (
                      <Link
                        className="admin-search-result"
                        href={item.href}
                        key={`${group}-${item.id}`}
                        onClick={() => setOpen(false)}
                      >
                        <span>{item.title}</span>
                        <small>{item.subtitle}</small>
                      </Link>
                    ))}
                  </div>
                );
              })
            : null}
        </div>
      ) : null}
    </div>
  );
}
