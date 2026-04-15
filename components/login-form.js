"use client";

import { useActionState } from "react";
import { loginAction } from "../lib/actions/auth-actions";

const initialState = {
  error: ""
};

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="auth-form">
      <label>
        <span>Email</span>
        <input name="email" placeholder="admin@ristorazione.it" type="email" />
      </label>
      <label>
        <span>Password</span>
        <input name="password" placeholder="Inserisci la password" type="password" />
      </label>
      {state?.error ? <p className="form-error">{state.error}</p> : null}
      <button className="button button-primary button-full" disabled={pending} type="submit">
        {pending ? "Accesso in corso..." : "Accedi"}
      </button>
    </form>
  );
}
