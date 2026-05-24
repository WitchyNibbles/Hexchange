import type { EventSummary } from "../../src/shared/contracts";

export function RitualLog({ events }: { events: EventSummary[] }) {
  return (
    <section className="glass-panel ritual-log">
      <div className="panel-header">
        <p className="panel-kicker">Ritual Log</p>
      </div>
      <h3>Transparent event trail</h3>
      <div className="event-list">
        {events.length === 0 ? <p>No events yet.</p> : null}
        {events.map((event) => (
          <article className={`event-card severity-${event.severity}`} key={event.id}>
            <div className="event-meta">
              <span>{event.kind}</span>
              <time>{new Date(event.createdAt).toLocaleString()}</time>
            </div>
            <strong>{event.title}</strong>
            <p>{event.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
