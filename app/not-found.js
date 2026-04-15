import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty-state">
      <div className="eyebrow">404</div>
      <h1>Table session not found.</h1>
      <p>The QR code is invalid or the demo table session does not exist.</p>
      <Link className="button button-primary" href="/table/milano-12">
        Open demo table
      </Link>
    </div>
  );
}
