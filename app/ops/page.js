import {
  demoLocations,
  demoKitchenQueue,
  demoReservations,
  demoDeliveryOrders
} from "../../lib/demo-data";

export const metadata = {
  title: "Ops Hub | Coperto"
};

function StatCard({ label, value, tone }) {
  return (
    <article className={`stat-card ${tone || ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default function OpsPage() {
  return (
    <div className="page-stack">
      <section className="ops-heading">
        <div>
          <div className="eyebrow">Operations cockpit</div>
          <h1>Control service, kitchen, and delivery across locations.</h1>
        </div>
        <div className="ops-status">
          <span className="status-dot" />
          Live demo data
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Locations online" value={demoLocations.length} />
        <StatCard label="Pending kitchen tickets" value={demoKitchenQueue.length} />
        <StatCard label="Reservations today" value={demoReservations.length} />
        <StatCard
          label="Delivery orders in flight"
          value={demoDeliveryOrders.length}
          tone="accent"
        />
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-card dashboard-card-wide">
          <div className="card-header">
            <h2>Location pulse</h2>
            <span>Multi-branch view</span>
          </div>
          <div className="location-list">
            {demoLocations.map((location) => (
              <div className="location-row" key={location.slug}>
                <div>
                  <strong>{location.name}</strong>
                  <p>{location.city}</p>
                </div>
                <div className="location-metrics">
                  <span>{location.metrics.covers} covers</span>
                  <span>{location.metrics.openTables} free tables</span>
                  <span>{location.metrics.revenue} EUR revenue</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card">
          <div className="card-header">
            <h2>Next reservations</h2>
            <span>Host stand</span>
          </div>
          <div className="queue-list">
            {demoReservations.map((reservation) => (
              <div className="queue-row" key={reservation.id}>
                <div>
                  <strong>{reservation.guest}</strong>
                  <p>
                    {reservation.location} / Table {reservation.table}
                  </p>
                </div>
                <span>{reservation.time}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card">
          <div className="card-header">
            <h2>Kitchen queue</h2>
            <span>Expo board</span>
          </div>
          <div className="queue-list">
            {demoKitchenQueue.map((ticket) => (
              <div className="queue-row" key={ticket.id}>
                <div>
                  <strong>{ticket.table}</strong>
                  <p>{ticket.items.join(", ")}</p>
                </div>
                <span>{ticket.status}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card">
          <div className="card-header">
            <h2>Delivery merge lane</h2>
            <span>External channels</span>
          </div>
          <div className="queue-list">
            {demoDeliveryOrders.map((order) => (
              <div className="queue-row" key={order.id}>
                <div>
                  <strong>{order.platform}</strong>
                  <p>
                    {order.location} / {order.customer}
                  </p>
                </div>
                <span>{order.status}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
