import { redirect } from "next/navigation";
import Link from "next/link";
import LoginForm from "../../components/login-form";
import { getCurrentUser } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/admin");
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="eyebrow">Accesso amministrativo</div>
        <h1>Entra nel gestionale.</h1>
        <p className="lead">
          Accedi per gestire utenti, sedi, tavoli, menu, orari e prenotazioni.
        </p>
        <LoginForm />
        <div className="auth-links">
          <Link href="/">Torna alla home</Link>
          <Link href="/prenota">Vai alla pagina prenotazioni</Link>
        </div>
      </div>
    </div>
  );
}
