"use client";

import { useActionState } from "react";
import { loginAction } from "../lib/actions/auth-actions";

const initialState = {
  error: "",
  email: "",
  locationId: ""
};

export default function LoginForm({ locations = [] }) {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="auth-form">
      <label>
        <span>Email</span>
        <input
          defaultValue={state?.email || ""}
          name="email"
          placeholder="admin@ristorazione.it"
          type="email"
        />
      </label>
      {locations.length > 0 ? (
        <label>
          <span>Sede operativa</span>
          <select defaultValue={state?.locationId || ""} name="locationId">
            <option value="">
              {locations.length > 1 ? "Seleziona la sede da usare" : "Usa la sede configurata"}
            </option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.publicName}
                {location.city ? ` / ${location.city}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
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
