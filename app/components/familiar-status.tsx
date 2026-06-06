import { useEffect, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import Lottie from "lottie-react";
import catData from "../assets/lottie/cat.json";
import type { SystemStatus } from "../../src/shared/contracts";

export function FamiliarStatus({ status }: { status: SystemStatus }) {
  const catControls = useAnimation();
  const prevProfitRef = useRef(status.totalProfitUsd);

  const message = status.killSwitchEngaged
    ? "All rituals are halted. The kill switch is engaged until you explicitly reset the system."
    : status.mode === "live"
      ? "Live capital is armed in tiny size. Watch drift, fills, and venue health closely."
      : status.mode === "paper"
        ? "Paper mode is active. Hexchange is collecting forward evidence before risking capital."
        : "The observatory is calm. Review strategy evidence before starting paper sessions.";

  useEffect(() => {
    if (status.killSwitchEngaged) {
      // Alarmed shake
      catControls.start({
        rotate: [-4, 4, -4, 4, -2, 2, 0],
        transition: { duration: 0.6, ease: "easeOut" }
      });
    } else if (status.mode === "live") {
      // Subtle excited pulse
      catControls.start({
        scale: [1, 1.04, 1],
        transition: { duration: 1.2, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }
      });
    } else {
      catControls.start({ rotate: 0, scale: 1 });
    }
  }, [status.killSwitchEngaged, status.mode, catControls]);

  // Profit milestone jump — triggers when profit crosses from <=0 to >0
  useEffect(() => {
    const prev = prevProfitRef.current;
    prevProfitRef.current = status.totalProfitUsd;
    if (prev <= 0 && status.totalProfitUsd > 0) {
      catControls.start({
        y: [0, -18, 0],
        transition: { type: "spring", stiffness: 320, damping: 12 }
      });
    }
  }, [status.totalProfitUsd, catControls]);

  return (
    <section className="glass-panel familiar-panel">
      <div className="panel-header">
        <p className="panel-kicker">Familiar View</p>
      </div>

      {/* Cat is the familiar — it gets its own featured spot, watching over the status */}
      <div className="familiar-character">
        <motion.div animate={catControls} style={{ width: 130, height: 130, flexShrink: 0 }}>
          <Lottie animationData={catData} loop style={{ width: "100%", height: "100%" }} />
        </motion.div>
        <div className="familiar-text">
          <h3>What the platform is doing now</h3>
          <p className={status.killSwitchEngaged ? "stat-loss" : ""}>{message}</p>
          <ul className="warning-list">
            {status.activeWarnings.length > 0 ? (
              status.activeWarnings.map((warning) => <li key={warning}>{warning}</li>)
            ) : (
              <li>No active warnings — market data is {status.dataFreshness}.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
