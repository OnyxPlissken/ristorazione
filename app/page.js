import Link from "next/link";
import { demoLocations, demoSignals, demoModules } from "../lib/demo-data";

export default function HomePage() {
  const heroLocation = demoLocations[0];

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="eyebrow">Unified restaurant operations</div>
        <div className="hero-grid">
          <div className="hero-copy">
            <h1>
              Reservations, tables, kitchen, QR ordering, payments, and delivery
              in one operating system.
            </h1>
            <p className="lead">
              Coperto is a Vercel-ready prototype for modern restaurants with
              multi-location control, live table sessions, kitchen visibility,
              and guest retention workflows.
            </p>
            <div className="cta-row">
              <Link className="button button-primary" href="/ops">
                Open Ops Hub
              </Link>
              <Link className="button button-secondary" href="/table/milano-12">
                Open QR Table
              </Link>
            </div>
          </div>
          <div className="hero-stats">
            <div className="glass-card">
              <span className="metric-label">Active location</span>
              <strong>{heroLocation.name}</strong>
              <p>{heroLocation.city}</p>
              <div className="metric-strip">
                <div>
                  <span className="metric-value">
                    {heroLocation.metrics.covers}
                  </span>
                  <span className="metric-caption">covers tonight</span>
                </div>
                <div>
                  <span className="metric-value">
                    {heroLocation.metrics.qrConversion}%
                  </span>
                  <span className="metric-caption">QR conversion</span>
                </div>
                <div>
                  <span className="metric-value">
                    {heroLocation.metrics.avgTicket} EUR
                  </span>
                  <span className="metric-caption">avg ticket</span>
                </div>
              </div>
            </div>
            <div className="signal-list">
              {demoSignals.map((signal) => (
                <article className="signal-card" key={signal.title}>
                  <span className="signal-kicker">{signal.kicker}</span>
                  <h3>{signal.title}</h3>
                  <p>{signal.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section-grid">
        {demoModules.map((module) => (
          <article className="module-card" key={module.title}>
            <div className="module-chip">{module.kicker}</div>
            <h2>{module.title}</h2>
            <p>{module.body}</p>
            <ul className="feature-list">
              {module.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="split-panel">
        <div className="split-copy">
          <div className="eyebrow">Built for real floor operations</div>
          <h2>Ship the first usable version before the platform becomes a maze.</h2>
          <p>
            The first release should already handle table sessions, menu browsing,
            live cart, kitchen queue, and pay-at-table. Delivery adapters and CRM
            automation can layer on top once the operational core is stable.
          </p>
        </div>
        <div className="timeline-card" id="roadmap">
          <div className="timeline-step">
            <strong>Phase 1</strong>
            <span>Menu, table sessions, QR flow, kitchen queue</span>
          </div>
          <div className="timeline-step">
            <strong>Phase 2</strong>
            <span>Reservations, floor map, table assignment engine</span>
          </div>
          <div className="timeline-step">
            <strong>Phase 3</strong>
            <span>Delivery adapters, omnichannel orders, analytics</span>
          </div>
        </div>
      </section>
    </div>
  );
}
