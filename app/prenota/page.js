import Link from "next/link";
import PublicReservationForm from "../../components/public-reservation-form";
import { getPublicReservationData } from "../../lib/queries";
import { weekdayLabel } from "../../lib/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Prenota | Coperto"
};

export default async function PrenotaPage() {
  const locations = await getPublicReservationData();

  return (
    <div className="booking-shell">
      <header className="public-header">
        <Link className="brand" href="/">
          Coperto
        </Link>
        <nav className="public-nav">
          <Link href="/login">Accedi</Link>
        </nav>
      </header>

      <main className="booking-main">
        <section className="booking-intro panel-card">
          <div className="eyebrow">Prenotazioni online</div>
          <h1>Prenota il tuo tavolo</h1>
          <p className="lead">
            Scegli la sede, consulta gli orari e invia la tua richiesta in pochi secondi.
          </p>
        </section>

        <section className="booking-grid">
          <PublicReservationForm locations={locations} />

          <div className="location-stack">
            {locations.map((location) => (
              <article className="panel-card" key={location.id}>
                <div className="panel-header">
                  <h2>{location.settings?.pageTitle || location.publicName || location.name}</h2>
                  <p>
                    {location.address}, {location.city}
                  </p>
                </div>
                <div className="info-list">
                  <div>
                    <strong>Coperti</strong>
                    <span>
                      {location.settings?.minGuests || 1} - {location.settings?.maxGuests || 8}
                    </span>
                  </div>
                  <div>
                    <strong>Anticipo minimo</strong>
                    <span>{location.settings?.leadTimeMinutes || 60} minuti</span>
                  </div>
                  <div>
                    <strong>Durata tavolo</strong>
                    <span>{location.settings?.durationMinutes || 120} minuti</span>
                  </div>
                </div>
                <div className="hours-list">
                  {location.openingHours.map((hour) => (
                    <div className="hours-row" key={`${location.id}-${hour.weekday}`}>
                      <span>{weekdayLabel(hour.weekday)}</span>
                      <strong>
                        {hour.isClosed ? "Chiuso" : `${hour.opensAt} - ${hour.closesAt}`}
                      </strong>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
