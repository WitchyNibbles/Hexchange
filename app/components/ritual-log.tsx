import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { EventSummary } from "../../src/shared/contracts";

const PAGE_SIZE = 5;

const kindGlyph: Record<string, string> = {
  signal: "◈",
  paper_session: "✦",
  order: "⟡",
  fill: "◉",
  risk: "△",
  live_arm: "⚡",
  kill_switch: "⊘",
  system: "◎",
};

export function RitualLog({ events }: { events: EventSummary[] }) {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const visibleEvents = events.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (page > 0 && start >= events.length) {
      setPage(0);
    }
  }, [events.length, page, start]);

  return (
    <section className="glass-panel ritual-log">
      <div className="panel-header">
        <div className="ritual-log-header" style={{ flex: 1 }}>
          <p className="panel-kicker" style={{ margin: 0 }}>Ritual Log</p>
          {events.length > 0 && (
            <span className="page-counter">
              {start + 1}–{Math.min(start + PAGE_SIZE, events.length)} of {events.length}
            </span>
          )}
        </div>
      </div>
      <h3>Transparent event trail</h3>
      <div className="event-list">
        {events.length === 0 ? <p>No events yet.</p> : null}
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{ display: "contents" }}
          >
            {visibleEvents.map((event, i) => (
              <motion.article
                className={`event-card severity-${event.severity}`}
                key={event.id}
                initial={{ opacity: 0, scale: 0.93, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 22, delay: i * 0.05 }}
              >
                <div className="event-meta">
                  <span>
                    {kindGlyph[event.kind] ?? "◈"} {event.kind.replace(/_/g, " ")}
                  </span>
                  <time>{new Date(event.createdAt).toLocaleString()}</time>
                </div>
                <strong>{event.title}</strong>
                <p>{event.body}</p>
              </motion.article>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            className="secondary"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
          >
            ← Prev
          </button>
          <span className="pagination-label">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="secondary"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
