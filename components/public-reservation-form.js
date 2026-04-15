"use client";

import { useActionState } from "react";
import { createPublicReservationAction } from "../lib/actions/public-actions";

const initialState = {
  error: "",
  success: ""
};

export default function PublicReservationForm({ locations }) {
  const [state, action, pending] = useActionState(
    createPublicReservationAction,
    initialState
  );

  return (
    <form action={action} className="panel-card form-panel">
      <div className="panel-header">
        <h2>Richiedi una prenotazione</h2>
        <p>Scegli sede, data e numero di coperti.</p>
      </div>

      <div className="form-grid">
        <label>
          <span>Sede</span>
          <select name="locationId" required>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} - {location.city}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Data e ora</span>
          <input name="dateTime" required type="datetime-local" />
        </label>
        <label>
          <span>Numero ospiti</span>
          <input defaultValue="2" max="12" min="1" name="guests" type="number" />
        </label>
        <label>
          <span>Nome e cognome</span>
          <input name="guestName" required type="text" />
        </label>
        <label>
          <span>Email</span>
          <input name="guestEmail" type="email" />
        </label>
        <label>
          <span>Telefono</span>
          <input name="guestPhone" type="text" />
        </label>
      </div>

      <label>
        <span>Note</span>
        <textarea name="notes" placeholder="Allergie, seggiolone, richieste speciali..." rows="4" />
      </label>

      {state?.error ? <p className="form-error">{state.error}</p> : null}
      {state?.success ? <p className="form-success">{state.success}</p> : null}

      <button className="button button-primary" disabled={pending} type="submit">
        {pending ? "Invio in corso..." : "Invia richiesta"}
      </button>
    </form>
  );
}
