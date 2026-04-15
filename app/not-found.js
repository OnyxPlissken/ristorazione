import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty-state">
      <div className="eyebrow">404</div>
      <h1>Pagina non trovata.</h1>
      <p>La risorsa richiesta non esiste o non e' piu' disponibile.</p>
      <Link className="button button-primary" href="/">
        Torna alla home
      </Link>
    </div>
  );
}
