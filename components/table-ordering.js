"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  addTableSessionItemAction,
  requestTablePaymentAction,
  updateTableSessionItemQuantityAction
} from "../lib/actions/table-actions";
import { TABLE_SESSION_STATUS_LABELS } from "../lib/constants";

const currency = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR"
});

function buildSeats(session) {
  return session.seats.map((seat) => {
    const lines = session.items.filter((item) => item.seatId === seat.id);
    const subtotal = lines.reduce(
      (sum, line) => sum + line.quantity * Number(line.unitPrice),
      0
    );

    return {
      ...seat,
      lines,
      subtotal
    };
  });
}

export default function TableOrdering({
  session,
  table,
  location,
  menuItems,
  technicalSettings
}) {
  const router = useRouter();
  const [activeSeat, setActiveSeat] = useState(session.seats[0]?.id || "");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setInterval(() => {
      router.refresh();
    }, 4000);

    return () => window.clearInterval(timer);
  }, [router]);

  const seats = buildSeats(session);
  const total = session.items.reduce(
    (sum, line) => sum + line.quantity * Number(line.unitPrice),
    0
  );

  const paymentUrl = technicalSettings?.paymentCheckoutBaseUrl
    ? `${technicalSettings.paymentCheckoutBaseUrl}?sessionId=${encodeURIComponent(
        session.id
      )}&tableId=${encodeURIComponent(table.id)}&locationId=${encodeURIComponent(
        location.id
      )}&amount=${encodeURIComponent(total.toFixed(2))}`
    : null;

  function addItem(item) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("sessionId", session.id);
      formData.set("seatId", activeSeat);
      formData.set("menuItemId", item.id);
      await addTableSessionItemAction(formData);
      router.refresh();
    });
  }

  function updateQuantity(itemId, delta) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("itemId", itemId);
      formData.set("delta", String(delta));
      await updateTableSessionItemQuantityAction(formData);
      router.refresh();
    });
  }

  function requestPayment() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("sessionId", session.id);
      await requestTablePaymentAction(formData);
      router.refresh();
    });
  }

  return (
    <div className="table-shell">
      <section className="table-hero">
        <div>
          <div className="eyebrow">QR tavolo</div>
          <h1>
            {location.publicName} / Tavolo {table.code}
          </h1>
          <p className="lead">
            Menu digitale, carrello condiviso tra i posti e aggiornamento live ogni
            pochi secondi.
          </p>
        </div>
        <div className="table-badges">
          <span>{TABLE_SESSION_STATUS_LABELS[session.status]}</span>
          <span>{table.seats} coperti</span>
          <span>{technicalSettings?.paymentsEnabled ? "Pagamento attivo" : "Solo carrello"}</span>
        </div>
      </section>

      <section className="table-layout">
        <article className="menu-panel">
          <div className="card-header">
            <div>
              <h2>Menu del tavolo</h2>
              <span>Seleziona un posto e aggiungi articoli al carrello condiviso.</span>
            </div>
          </div>

          <div className="seat-switcher">
            {session.seats.map((seat) => (
              <button
                className={seat.id === activeSeat ? "seat-button active" : "seat-button"}
                key={seat.id}
                onClick={() => setActiveSeat(seat.id)}
                type="button"
              >
                {seat.label}
              </button>
            ))}
          </div>

          <div className="menu-grid">
            {menuItems.map((item) => (
              <article className="menu-card" key={item.id}>
                {item.imageUrl ? (
                  <img
                    alt={item.name}
                    className="menu-card-media"
                    loading="lazy"
                    src={item.imageUrl}
                  />
                ) : null}
                <div className="menu-card-body">
                  <span className="menu-tag">{item.category}</span>
                  <h3>{item.name}</h3>
                  <p>{item.description || "Piatti e varianti configurati dal ristorante."}</p>
                  {item.allergens ? <span className="menu-allergens">{item.allergens}</span> : null}
                </div>
                <div className="menu-actions">
                  <strong>{currency.format(item.price)}</strong>
                  <button
                    className="button button-primary"
                    disabled={!activeSeat || isPending || session.status !== "OPEN"}
                    onClick={() => addItem(item)}
                    type="button"
                  >
                    {isPending ? "Aggiorno..." : "Aggiungi al posto selezionato"}
                  </button>
                </div>
              </article>
            ))}
            {menuItems.length === 0 ? (
              <p className="empty-copy">Nessun piatto disponibile per questa sede.</p>
            ) : null}
          </div>
        </article>

        <aside className="cart-panel">
          <div className="card-header">
            <div>
              <h2>Carrello condiviso</h2>
              <span>{session.items.length} righe attive</span>
            </div>
          </div>

          {session.status === "PAYMENT_REQUESTED" ? (
            <p className="form-success">Pagamento richiesto dal tavolo.</p>
          ) : null}

          <div className="seat-cart-list">
            {seats.map((seat) => (
              <section className="seat-cart" key={seat.id}>
                <div className="seat-cart-header">
                  <strong>{seat.label}</strong>
                  <span>{currency.format(seat.subtotal)}</span>
                </div>
                {seat.lines.length === 0 ? (
                  <p className="muted-copy">Nessun articolo per questo posto.</p>
                ) : (
                  seat.lines.map((line) => (
                    <div className="cart-row" key={line.id}>
                      <div>
                        <strong>{line.name}</strong>
                        <p>{currency.format(Number(line.unitPrice))} cad.</p>
                      </div>
                      <div className="cart-controls">
                        <button
                          disabled={isPending || session.status !== "OPEN"}
                          onClick={() => updateQuantity(line.id, -1)}
                          type="button"
                        >
                          -
                        </button>
                        <span>{line.quantity}</span>
                        <button
                          disabled={isPending || session.status !== "OPEN"}
                          onClick={() => updateQuantity(line.id, 1)}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </section>
            ))}
          </div>

          <div className="bill-summary">
            <div>
              <span>Totale tavolo</span>
              <strong>{currency.format(total)}</strong>
            </div>
          </div>

          {technicalSettings?.paymentsEnabled && paymentUrl ? (
            <a className="button button-primary button-full" href={paymentUrl}>
              Vai al pagamento
            </a>
          ) : technicalSettings?.paymentsEnabled ? (
            <button
              className="button button-primary button-full"
              disabled={isPending || total === 0}
              onClick={requestPayment}
              type="button"
            >
              {isPending ? "Invio richiesta..." : "Richiedi pagamento al tavolo"}
            </button>
          ) : (
            <button className="button button-secondary button-full" disabled type="button">
              Pagamento tavolo non configurato
            </button>
          )}

          <div className="micro-actions">
            <Link href="/">Home</Link>
            <Link href="/prenota">Prenotazioni</Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
