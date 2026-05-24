import type { SystemStatus } from "../../src/shared/contracts";

export function FamiliarStatus({ status }: { status: SystemStatus }) {
  const message = status.killSwitchEngaged
    ? "All rituals are halted. The kill switch is engaged until you explicitly reset the system."
    : status.mode === "live"
      ? "Live capital is armed in tiny size. Watch drift, fills, and venue health closely."
      : status.mode === "paper"
        ? "Paper mode is active. Hexchange is collecting forward evidence before risking capital."
        : "The observatory is calm. Review strategy evidence before starting paper sessions.";

  return (
    <section className="glass-panel familiar-panel">
      <div className="panel-header">
        <p className="panel-kicker">Familiar View</p>
      </div>
      <h3>What the platform is doing now</h3>
      <p>{message}</p>
      <ul className="warning-list">
        {status.activeWarnings.length > 0 ? (
          status.activeWarnings.map((warning) => <li key={warning}>{warning}</li>)
        ) : (
          <li>No active warnings. Market data is {status.dataFreshness}.</li>
        )}
      </ul>
    </section>
  );
}
