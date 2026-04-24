import Link from "next/link";
import { getPaymentRequestByToken } from "../../../lib/payments";

export const dynamic = "force-dynamic";

function formatAmount(value, currency = "EUR") {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency
  }).format(Number(value || 0));
}

export async function generateMetadata({ params }) {
  const resolved = await params;
  const paymentRequest = await getPaymentRequestByToken(resolved?.token);

  return {
    title: paymentRequest
      ? `Pagamento deposito | ${paymentRequest.location?.name || "Coperto"}`
      : "Pagamento non trovato | Coperto"
  };
}

export default async function PaymentRequestPage({ params }) {
  const resolved = await params;
  const paymentRequest = await getPaymentRequestByToken(resolved?.token);

  return (
    <div className="booking-shell">
      <header className="public-header">
        <Link className="brand" href="/">
          Coperto
        </Link>
        <nav className="public-nav">
          <Link href="/prenota">Prenota</Link>
        </nav>
      </header>

      <main className="booking-main">
        {!paymentRequest ? (
          <section className="panel-card">
            <div className="panel-header">
              <h1>Pagamento non trovato</h1>
              <p>Il link potrebbe essere scaduto o non piu' valido.</p>
            </div>
          </section>
        ) : (
          <section className="panel-card form-panel">
            <div className="panel-header">
              <div>
                <h1>Deposito prenotazione</h1>
                <p>
                  {paymentRequest.location?.technicalSettings?.displayName ||
                    paymentRequest.location?.name}{" "}
                  / {paymentRequest.reservation?.guestName || "Cliente"}
                </p>
              </div>
              <span className="location-chip highlighted">{paymentRequest.status}</span>
            </div>

            <div className="reservation-detail-grid">
              <div className="reservation-detail-cell">
                <span>Importo</span>
                <strong>{formatAmount(paymentRequest.amount, paymentRequest.currency)}</strong>
              </div>
              <div className="reservation-detail-cell">
                <span>Provider</span>
                <strong>{paymentRequest.provider || "Custom"}</strong>
              </div>
              <div className="reservation-detail-cell">
                <span>Riferimento</span>
                <strong>{paymentRequest.externalReference || paymentRequest.id}</strong>
              </div>
              <div className="reservation-detail-cell">
                <span>Prenotazione</span>
                <strong>{paymentRequest.reservation?.guestName || "Non collegata"}</strong>
              </div>
            </div>

            {paymentRequest.status === "PAID" ? (
              <p className="form-success">
                Il deposito risulta pagato. Torna al link della prenotazione per eventuali modifiche.
              </p>
            ) : paymentRequest.checkoutUrl ? (
              <div className="page-stack">
                <p className="helper-copy">
                  Usa il checkout del provider per completare il pagamento. Questa pagina si
                  aggiorna quando il provider richiama il webhook di conferma.
                </p>
                <a className="button button-primary" href={paymentRequest.checkoutUrl}>
                  Vai al checkout
                </a>
              </div>
            ) : (
              <p className="form-warning">
                Checkout esterno non configurato. Completa il saldo tramite il canale indicato dal
                ristorante e attendi la conferma.
              </p>
            )}

            {paymentRequest.reservation?.manageToken ? (
              <Link
                className="button button-muted"
                href={`/prenotazione/${paymentRequest.reservation.manageToken}`}
              >
                Torna alla prenotazione
              </Link>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}
