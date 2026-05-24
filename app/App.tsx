import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { DashboardRoute } from "./routes/dashboard";
import { StrategiesRoute } from "./routes/strategies";
import { TradesRoute } from "./routes/trades";

export function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand-mark">
            <span className="brand-sigil">☾</span>
            <div>
              <p className="eyebrow">Witchy operator console</p>
              <h1>Hexchange</h1>
            </div>
          </div>
          <p className="sidebar-copy">
            A calm midnight observatory for validating and operating autonomous trading strategies.
          </p>
          <nav className="nav-list">
            <NavLink to="/">Observatory</NavLink>
            <NavLink to="/strategies">Spellbook</NavLink>
            <NavLink to="/trades">Ledger</NavLink>
          </nav>
        </aside>
        <main className="main-panel">
          <Routes>
            <Route path="/" element={<DashboardRoute />} />
            <Route path="/strategies" element={<StrategiesRoute />} />
            <Route path="/trades" element={<TradesRoute />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
