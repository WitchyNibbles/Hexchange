import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getSystemStatus } from "../lib/api";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Observatory",
  "/strategies": "Spellbook",
  "/trades": "Ledger",
};

export function MainHeader() {
  const location = useLocation();
  const [time, setTime] = useState(() => new Date());
  const [mode, setMode] = useState("research");

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const status = await getSystemStatus();
        setMode(status.mode);
      } catch {
        // retain last known mode on network error
      }
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  const hh = String(time.getHours()).padStart(2, "0");
  const mm = String(time.getMinutes()).padStart(2, "0");
  const ss = String(time.getSeconds()).padStart(2, "0");
  const title = ROUTE_TITLES[location.pathname] ?? "Hexchange";

  return (
    <header className="main-header">
      <span className="main-header-route">{title}</span>
      <div className="main-header-right">
        <span className="main-header-clock">{hh}:{mm}:{ss}</span>
        <span className={`mode-pill mode-${mode}`}>{mode}</span>
      </div>
    </header>
  );
}
