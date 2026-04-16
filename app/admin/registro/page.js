import { requireUser } from "../../../lib/auth";
import { formatDateTime } from "../../../lib/format";
import { requirePageAccess } from "../../../lib/permissions";
import { getActivityLogPageData } from "../../../lib/queries";

export const dynamic = "force-dynamic";

export default async function RegistroPage() {
  const user = await requireUser();
  requirePageAccess(user, "reservations");
  const data = await getActivityLogPageData(user);

  return (
    <div className="page-stack">
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Registro operativo</h2>
            <p>Storico notifiche inviate e audit log delle azioni eseguite nel gestionale.</p>
          </div>
        </div>

        <div className="permission-role-strip">
          <div className="summary-chip">
            <strong>{data.stats.notificationsLast24h}</strong>
            <span>notifiche 24h</span>
          </div>
          <div className="summary-chip">
            <strong>{data.stats.failedNotificationsLast24h}</strong>
            <span>fallite 24h</span>
          </div>
          <div className="summary-chip">
            <strong>{data.stats.auditLast24h}</strong>
            <span>azioni tracciate 24h</span>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Notifiche recenti</h2>
            <p>SMS, email e canali futuri con esito, destinatario ed evento.</p>
          </div>
        </div>

        <div className="activity-log-list">
          {data.notificationLogs.map((item) => (
            <article className="activity-log-card" key={item.id}>
              <div className="activity-log-head">
                <div>
                  <strong>{item.event}</strong>
                  <p>{item.locationName}</p>
                </div>
                <span className={`table-status-chip ${String(item.status || "").toLowerCase()}`}>
                  {item.status}
                </span>
              </div>
              <div className="info-list">
                <div>
                  <strong>Canale</strong>
                  <span>{item.channel}</span>
                </div>
                <div>
                  <strong>Destinazione</strong>
                  <span>{item.destination || "Non disponibile"}</span>
                </div>
                <div>
                  <strong>Quando</strong>
                  <span>{formatDateTime(item.createdAt)}</span>
                </div>
              </div>
              {item.contentPreview ? (
                <div className="note-box">
                  <strong>Anteprima</strong>
                  <p>{item.contentPreview}</p>
                </div>
              ) : null}
              {item.errorMessage ? (
                <div className="form-error">{item.errorMessage}</div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Audit log</h2>
            <p>Chi ha fatto cosa, su quale entità e quando.</p>
          </div>
        </div>

        <div className="activity-log-list">
          {data.auditLogs.map((item) => (
            <article className="activity-log-card" key={item.id}>
              <div className="activity-log-head">
                <div>
                  <strong>{item.summary}</strong>
                  <p>
                    {item.locationName} - {item.entityType}
                  </p>
                </div>
                <span className="table-status-chip free">{item.action}</span>
              </div>
              <div className="info-list">
                <div>
                  <strong>Utente</strong>
                  <span>{item.user?.name || "Sistema"}</span>
                </div>
                <div>
                  <strong>Entità</strong>
                  <span>{item.entityId}</span>
                </div>
                <div>
                  <strong>Quando</strong>
                  <span>{formatDateTime(item.createdAt)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
