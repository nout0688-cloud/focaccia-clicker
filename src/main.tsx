import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import DuelApp from "./duel/DuelApp";

// ?duel=<id> — отдельный экран дуэли (тот же мини-апп, отдельная страница)
const duelId = new URLSearchParams(window.location.search).get("duel");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {duelId ? <DuelApp duelId={duelId} /> : <App />}
  </StrictMode>
);
