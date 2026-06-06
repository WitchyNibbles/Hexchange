import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
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
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.26, ease: "easeOut" }}
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
          transition={{ duration: 0.38, ease: "easeOut" }}
        >
          <div className="sidebar-glow" aria-hidden="true" />
          <div className="sidebar-inner">
            <div className="brand-mark">
              {/* Jack O'Lantern as the app mascot / brand sigil */}
              <Lottie
                animationData={pumpkinData}
                loop
                style={{ width: 54, height: 54, flexShrink: 0 }}
              />
              <div>
                <p className="eyebrow">Witchy operator console</p>
                <h1>Hexchange</h1>
              </div>
            </div>
            <p className="sidebar-copy">
              A midnight observatory for validating and running autonomous trading strategies.
            </p>
            <nav className="nav-list">
              <NavLink to="/">
                <span className="nav-icon"><ObservatoryIcon size={15} /></span>
                Observatory
              </NavLink>
              <NavLink to="/strategies">
                <span className="nav-icon"><SpellbookIcon size={15} /></span>
                Spellbook
              </NavLink>
              <NavLink to="/trades">
                <span className="nav-icon"><LedgerIcon size={15} /></span>
                Ledger
              </NavLink>
            </nav>

            {/* Bat lives at the bottom of the sidebar — atmospheric mood-setter */}
            <div className="sidebar-decorations">
              <Lottie
                animationData={batData}
                loop
                style={{ width: 110, opacity: 0.82 }}
              />
            </div>
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
