import "./globals.css";

export const metadata = {
  title: "Coperto | Gestionale per ristorazione",
  description:
    "Gestionale in italiano per sedi, tavoli, menu, prenotazioni, utenti e pannello amministrativo."
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
