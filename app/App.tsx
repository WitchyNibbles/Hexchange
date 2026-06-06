import { BrowserRouter, NavLink, Route, Routes, useLocation, useMatch } from "react-router-dom";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Lottie from "lottie-react";
import { DashboardRoute } from "./routes/dashboard";
import { StrategiesRoute } from "./routes/strategies";
import { TradesRoute } from "./routes/trades";
import { StarField } from "./components/StarField";
import { MainHeader } from "./components/MainHeader";
import { ObservatoryIcon, SpellbookIcon, LedgerIcon } from "./components/icons/NavIcons";
import { ToastRail } from "./components/ToastRail";
import pumpkinData from "./assets/lottie/pumpkin.json";
import batData from "./assets/lottie/bat.json";

function NavItem({
  to,
  end,
  icon,
  label,
}: {
  to: string;
  end?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  const match = useMatch({ path: to, end: end ?? false });
  const isActive = Boolean(match);

  return (
    <NavLink to={to} end={end}>
      {isActive && (
        <motion.div
          layoutId="nav-pill"
          className="nav-active-pill"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <span className="nav-icon nav-icon-z">{icon}</span>
      <span className="nav-label-z">{label}</span>
    </NavLink>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  useEffect(() => {
    const page =
      location.pathname === "/strategies" ? "spellbook" :
      location.pathname === "/trades"     ? "ledger"    :
      "dashboard";
    document.body.dataset.page = page;
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.012 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
      >
        <Routes location={location}>
          <Route path="/" element={<DashboardRoute />} />
          <Route path="/strategies" element={<StrategiesRoute />} />
          <Route path="/trades" element={<TradesRoute />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <StarField />
      <div className="app-shell">
        <motion.aside
          className="sidebar"
          initial={{ x: -16, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          <div className="sidebar-glow" aria-hidden="true" />
          <div className="sidebar-inner">
            <div className="brand-mark">
              {/* Jack O'Lantern as the app mascot / brand sigil */}
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
                style={{ flexShrink: 0 }}
              >
                <Lottie animationData={pumpkinData} loop style={{ width: 54, height: 54 }} />
              </motion.div>
              <div>
                <p className="eyebrow">Witchy operator console</p>
                <h1>Hexchange</h1>
              </div>
            </div>
            <p className="sidebar-copy">
              A midnight observatory for validating and running autonomous trading strategies.
            </p>
            <nav className="nav-list">
              <NavItem to="/" end icon={<ObservatoryIcon size={15} />} label="Observatory" />
              <NavItem to="/strategies" icon={<SpellbookIcon size={15} />} label="Spellbook" />
              <NavItem to="/trades" icon={<LedgerIcon size={15} />} label="Ledger" />
            </nav>

            {/* Bat lives at the bottom of the sidebar — atmospheric mood-setter */}
            <motion.div
              className="sidebar-decorations"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 22, delay: 0.45 }}
            >
              <motion.div
                whileHover={{ scale: 1.15, rotate: [-6, 6, 0] }}
                transition={{ type: "spring", stiffness: 300, damping: 14 }}
                style={{ cursor: "default" }}
              >
                <Lottie animationData={batData} loop style={{ width: 110, opacity: 0.82 }} />
              </motion.div>
            </motion.div>
          </div>
        </motion.aside>
        <main className="main-panel">
          <MainHeader />
          <div className="main-content">
            <AnimatedRoutes />
          </div>
        </main>
      </div>
      <ToastRail />
    </BrowserRouter>
  );
}
