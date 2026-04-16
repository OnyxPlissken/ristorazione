import Link from "next/link";
import PublicManageReservationForm from "../../../components/public-manage-reservation-form";
import { getPublicReservationManageData } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { token } = await params;
  const reservation = await getPublicReservationManageData(token);

  return {
    title: reservation
      ? `Gestisci prenotazione | ${reservation.locationName}`
      : "Prenotazione non trovata | Coperto"
  };
}

export default async function PublicManageReservationPage({ params }) {
  const { token } = await params;
  const reservation = await getPublicReservationManageData(token);

  return (
    <div className="booking-shell">
      <header className="public-header">
        <Link className="brand" href="/">
          Coperto
        </Link>
        <nav className="public-nav">
          <Link href="/prenota">Nuova prenotazione</Link>
        </nav>
      </header>

      <main className="booking-main">
        {reservation ? (
          <PublicManageReservationForm reservation={reservation} />
        ) : (
          <section className="panel-card">
            <div className="panel-header">
              <h1>Prenotazione non trovata</h1>
              <p>Il link potrebbe essere scaduto o non essere piu' valido.</p>
            </div>
            <Link className="button button-primary" href="/prenota">
              Vai alla pagina prenotazioni
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
