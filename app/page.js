import Link from "next/link";

const funzionalita = [
  "Gestione sedi e multisede con pannello centralizzato",
  "Ruoli utente: Admin, Proprietario, Store Manager e Staff",
  "Configurazione tavoli, capienza, zone e stato operativo",
  "Menu, sezioni, piatti, prezzi e disponibilita'",
  "Orari di apertura e impostazioni pagina prenotazione",
  "Prenotazioni pubbliche e gestione interna del servizio"
];

export default function HomePage() {
  return (
    <div className="marketing-shell">
      <header className="public-header">
        <Link className="brand" href="/">
          Coperto
        </Link>
        <nav className="public-nav">
          <Link href="/prenota">Prenota</Link>
          <Link href="/login">Accedi</Link>
        </nav>
      </header>

      <main className="marketing-main">
        <section className="hero-panel">
          <div className="eyebrow">Gestionale per ristorazione</div>
          <h1>Tutto il ristorante in un unico pannello, rigorosamente in italiano.</h1>
          <p className="lead">
            Coperto nasce per gestire sedi, tavoli, menu, orari, utenti e
            prenotazioni con un backoffice unico e una pagina pubblica di booking.
          </p>
          <div className="cta-row">
            <Link className="button button-primary" href="/login">
              Apri il pannello
            </Link>
            <Link className="button button-secondary" href="/prenota">
              Vai alla prenotazione
            </Link>
          </div>
        </section>

        <section className="feature-grid">
          {funzionalita.map((item) => (
            <article className="feature-card" key={item}>
              <h2>{item}</h2>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
