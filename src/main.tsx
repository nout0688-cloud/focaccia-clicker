import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import DuelApp from "./duel/DuelApp";

// ?duel=<id> — отдельный экран дуэли (тот же мини-апп, отдельная страница)
const duelId = new URLSearchParams(window.location.search).get("duel");

// На дуэльной странице показываем ЛЮБУЮ ошибку прямо на экране (диагностика)
if (duelId) {
  const showErr = (msg: string) => {
    try {
      const d = document.createElement("pre");
      d.style.cssText =
        "position:fixed;inset:auto 0 0 0;background:#3a0d0d;color:#ffb4b4;padding:10px;font:10px monospace;white-space:pre-wrap;z-index:99999;max-height:50vh;overflow:auto";
      d.textContent = "ОШИБКА: " + msg;
      document.body.appendChild(d);
    } catch { /* */ }
  };
  window.addEventListener("error", (e) => showErr(e.message));
  window.addEventListener("unhandledrejection", (e) => showErr(String(e.reason)));
}

class DuelBoundary extends React.Component<{ duelId: string }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { err: String((e as Error)?.message || e) };
  }
  render() {
    if (this.state.err) {
      return (
        <div className="h-screen bg-[#0d0a04] flex items-center justify-center p-6">
          <div className="text-center">
            <div className="text-5xl mb-3">⚠️</div>
            <p className="text-red-300 font-bold mb-2">Ошибка дуэли:</p>
            <pre className="text-[10px] text-amber-300/70 whitespace-pre-wrap">{this.state.err}</pre>
            <button
              onClick={() => { window.location.href = window.location.pathname + '?v=' + Date.now() + '&duel=' + this.props.duelId; }}
              className="mt-4 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-bold rounded-xl text-xs active:scale-95 cursor-pointer shadow-lg"
            >
              🔄 Оновити версію
            </button>
          </div>
        </div>
      );
    }
    return <DuelApp duelId={this.props.duelId} />;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {duelId ? <DuelBoundary duelId={duelId} /> : <App />}
  </StrictMode>
);
