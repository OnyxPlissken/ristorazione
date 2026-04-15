"use client";

import Link from "next/link";
import { startTransition, useMemo, useState } from "react";

const currency = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR"
});

function groupBySeat(items, seats) {
  return seats.map((seat) => {
    const lines = items.filter((item) => item.seatId === seat.id);
    const subtotal = lines.reduce(
      (sum, line) => sum + line.quantity * line.price,
      0
    );

    return {
      ...seat,
      lines,
      subtotal
    };
  });
}

export default function TableOrdering({ table, menu }) {
  const [activeSeat, setActiveSeat] = useState(table.seats[0].id);
  const [cart, setCart] = useState([]);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentState, setPaymentState] = useState("idle");

  const cartBySeat = useMemo(
    () => groupBySeat(cart, table.seats),
    [cart, table.seats]
  );
  const total = cart.reduce((sum, line) => sum + line.quantity * line.price, 0);
  const service = total * 0.08;
  const grandTotal = total + service;

  function addItem(item) {
    setCart((current) => {
      const existing = current.find(
        (line) => line.itemId === item.id && line.seatId === activeSeat
      );

      if (existing) {
        return current.map((line) =>
          line.itemId === item.id && line.seatId === activeSeat
            ? { ...line, quantity: line.quantity + 1 }
            : line
        );
      }

      return [
        ...current,
        {
          seatId: activeSeat,
          itemId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1
        }
      ];
    });
  }

  function updateQuantity(seatId, itemId, delta) {
    setCart((current) =>
      current
        .map((line) => {
          if (line.seatId !== seatId || line.itemId !== itemId) {
            return line;
          }

          return {
            ...line,
            quantity: line.quantity + delta
          };
        })
        .filter((line) => line.quantity > 0)
    );
  }

  function payNow() {
    setIsPaying(true);
    setPaymentState("processing");

    startTransition(() => {
      window.setTimeout(() => {
        setPaymentState("paid");
        setIsPaying(false);
      }, 1200);
    });
  }

  return (
    <div className="table-shell">
      <section className="table-hero">
        <div>
          <div className="eyebrow">QR table session</div>
          <h1>
            {table.location} / Table {table.label}
          </h1>
          <p className="lead">
            Shared cart, seat-based split bill, and direct payment from the
            guest phone.
          </p>
        </div>
        <div className="table-badges">
          <span>{table.status}</span>
          <span>{table.seats.length} guests</span>
          <span>{table.server}</span>
        </div>
      </section>

      <section className="table-layout">
        <article className="menu-panel">
          <div className="card-header">
            <h2>Menu</h2>
            <span>Live table cart</span>
          </div>
          <div className="seat-switcher">
            {table.seats.map((seat) => (
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
            {menu.map((item) => (
              <article className="menu-card" key={item.id}>
                <div>
                  <span className="menu-tag">{item.category}</span>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                </div>
                <div className="menu-actions">
                  <strong>{currency.format(item.price)}</strong>
                  <button
                    className="button button-primary"
                    onClick={() => addItem(item)}
                    type="button"
                  >
                    Add for {table.seats.find((seat) => seat.id === activeSeat)?.label}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </article>

        <aside className="cart-panel">
          <div className="card-header">
            <h2>Shared cart</h2>
            <span>{cart.length} active lines</span>
          </div>
          <div className="seat-cart-list">
            {cartBySeat.map((seat) => (
              <section className="seat-cart" key={seat.id}>
                <div className="seat-cart-header">
                  <strong>{seat.label}</strong>
                  <span>{currency.format(seat.subtotal)}</span>
                </div>
                {seat.lines.length === 0 ? (
                  <p className="muted-copy">No items yet.</p>
                ) : (
                  seat.lines.map((line) => (
                    <div className="cart-row" key={`${line.seatId}-${line.itemId}`}>
                      <div>
                        <strong>{line.name}</strong>
                        <p>{currency.format(line.price)} each</p>
                      </div>
                      <div className="cart-controls">
                        <button
                          onClick={() => updateQuantity(line.seatId, line.itemId, -1)}
                          type="button"
                        >
                          -
                        </button>
                        <span>{line.quantity}</span>
                        <button
                          onClick={() => updateQuantity(line.seatId, line.itemId, 1)}
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
              <span>Food subtotal</span>
              <strong>{currency.format(total)}</strong>
            </div>
            <div>
              <span>Service</span>
              <strong>{currency.format(service)}</strong>
            </div>
            <div className="bill-total">
              <span>Grand total</span>
              <strong>{currency.format(grandTotal)}</strong>
            </div>
          </div>

          <button
            className="button button-primary button-full"
            disabled={total === 0 || isPaying}
            onClick={payNow}
            type="button"
          >
            {paymentState === "paid"
              ? "Payment completed"
              : isPaying
                ? "Processing payment..."
                : "Pay from table"}
          </button>

          <div className="micro-actions">
            <Link href="/ops">Back to Ops Hub</Link>
            <Link href="/">Home</Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
