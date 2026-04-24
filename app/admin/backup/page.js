import Link from "next/link";
import { createBackupSnapshotAction, restoreBackupSnapshotAction } from "../../../lib/actions/system-actions";
import { requireUser } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { requirePageAccess } from "../../../lib/permissions";
import { getAccessibleLocationIds } from "../../../lib/permissions";

export const dynamic = "force-dynamic";

function formatDateTime(value) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function BackupPage() {
  const user = await requireUser();
  requirePageAccess(user, "console");
  const locationIds = getAccessibleLocationIds(user);
  const locationWhere = locationIds === null ? { archivedAt: null } : { archivedAt: null, id: { in: locationIds } };
  const [locations, backups] = await Promise.all([
    db.location.findMany({
      where: locationWhere,
      orderBy: {
        name: "asc"
      }
    }),
    db.backupSnapshot.findMany({
      where:
        locationIds === null
          ? {}
          : {
              OR: [{ locationId: null }, { locationId: { in: locationIds } }]
            },
      include: {
        location: true,
        createdBy: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 40
    })
  ]);

  return (
    <div className="page-stack">
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Backup e restore</h2>
            <p>Snapshot configurazione sede, ripristino rapido ed export CSV delle aree critiche.</p>
          </div>
          <div className="row-meta">
            <span>{backups.length} snapshot recenti</span>
            <span>{locations.length} sedi</span>
          </div>
        </div>

        <div className="console-block-grid console-block-grid-split">
          <form action={createBackupSnapshotAction} className="section-card entity-form">
            <div className="panel-header">
              <div>
                <h3>Crea snapshot</h3>
                <p>Salva configurazione sede, orari, tavoli, layout e menu in un backup ripristinabile.</p>
              </div>
            </div>

            <div className="form-grid">
              <label>
                <span>Sede</span>
                <select name="locationId" required>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Nome snapshot</span>
                <input name="name" placeholder="Prima di aggiornare menu estivo" type="text" />
              </label>
            </div>

            <div className="entity-footer">
              <span>Il backup viene salvato nel database ed e' disponibile per restore immediato.</span>
              <button className="button button-primary" type="submit">
                Crea backup
              </button>
            </div>
          </form>

          <section className="section-card">
            <div className="panel-header">
              <div>
                <h3>Export CSV</h3>
                <p>Esporta dati pronti per audit, analisi esterne e import manuali.</p>
              </div>
            </div>

            <div className="console-table-list">
              <Link className="button button-muted" href="/api/admin/exports/reservations">
                Esporta prenotazioni
              </Link>
              <Link className="button button-muted" href="/api/admin/exports/customers">
                Esporta clienti CRM
              </Link>
              <Link className="button button-muted" href="/api/admin/exports/audit">
                Esporta audit log
              </Link>
              <Link className="button button-muted" href="/api/admin/exports/notifications">
                Esporta notifiche
              </Link>
              <Link className="button button-muted" href="/api/admin/exports/payments">
                Esporta pagamenti
              </Link>
            </div>
          </section>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Snapshot recenti</h2>
            <p>Il restore sovrascrive la configurazione corrente della sede con il contenuto del backup.</p>
          </div>
        </div>

        <div className="activity-log-list">
          {backups.map((snapshot) => (
            <article className="activity-log-card" key={snapshot.id}>
              <div className="activity-log-head">
                <div>
                  <strong>{snapshot.name}</strong>
                  <p>{snapshot.location?.name || "Sistema"} / {snapshot.kind}</p>
                </div>
                <span className="table-status-chip scheduled">{formatDateTime(snapshot.createdAt)}</span>
              </div>
              <div className="info-list">
                <div>
                  <strong>Creato da</strong>
                  <span>{snapshot.createdBy?.name || "Sistema"}</span>
                </div>
                <div>
                  <strong>Restore</strong>
                  <span>Configurazione sede, tavoli, menu e orari</span>
                </div>
              </div>
              <form action={restoreBackupSnapshotAction}>
                <input name="snapshotId" type="hidden" value={snapshot.id} />
                <button className="button button-primary" type="submit">
                  Ripristina snapshot
                </button>
              </form>
            </article>
          ))}

          {backups.length === 0 ? (
            <p className="empty-copy">Nessun backup disponibile. Crea il primo snapshot prima di fare modifiche pesanti.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
