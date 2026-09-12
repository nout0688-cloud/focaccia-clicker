import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import DuelApp from "./duel/DuelApp";
import TradeApp from "./trade/TradeApp";

// ?duel=<id> — окремий екран дуелі, ?trade=<id> — окремий екран трейду
const searchParams = new URLSearchParams(window.location.search);
let duelId = searchParams.get("duel");
let tradeId = searchParams.get("trade");

const tgStartParam =
  searchParams.get("tgWebAppStartParam") ||
  ((window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { start_param?: string } } } })?.Telegram?.WebApp?.initDataUnsafe?.start_param) ||
  "";

if (!duelId && !tradeId && tgStartParam) {
  if (tgStartParam.startsWith("duel_") || tgStartParam.startsWith("d_") || tgStartParam === "duel" || tgStartParam === "duel_lobby") {
    duelId = (tgStartParam === "duel" || tgStartParam === "duel_lobby") ? "lobby" : tgStartParam.replace(/^duel_/, "");
  } else if (tgStartParam.startsWith("trade_") || tgStartParam.startsWith("tr_") || tgStartParam === "trade") {
    tradeId = tgStartParam.replace(/^trade_/, "");
  }
}

class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { err: String((e as Error)?.stack || (e as Error)?.message || e) };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Critical render error caught:", error, info);
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "#0d0b07",
          color: "#fef3c7",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          zIndex: 999999,
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "8px" }}>⚠️</div>
          <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "#f87171", margin: "0 0 6px 0" }}>
            Помилка відображення
          </h2>
          <p style={{ fontSize: "12px", opacity: 0.8, margin: "0 0 12px 0", maxWidth: "300px" }}>
            Сталася помилка або застарів кеш Telegram. Натисніть кнопку нижче:
          </p>
          <pre style={{
            fontSize: "10px",
            color: "#fca5a5",
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "10px",
            padding: "10px",
            maxWidth: "340px",
            maxHeight: "120px",
            overflow: "auto",
            textAlign: "left",
            margin: "0 0 16px 0",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}>
            {this.state.err}
          </pre>
          <button
            type="button"
            onClick={() => {
              window.location.href = window.location.pathname + "?v=" + Date.now() + (duelId ? "&duel=" + duelId : "");
            }}
            style={{
              background: "linear-gradient(to right, #f59e0b, #ea580c)",
              color: "#451a03",
              fontWeight: "900",
              fontSize: "14px",
              border: "none",
              borderRadius: "14px",
              padding: "12px 24px",
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(245, 158, 11, 0.4)",
            }}
          >
            🔄 Перезавантажити з оновленням
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      {duelId ? <DuelApp duelId={duelId} /> : tradeId ? <TradeApp tradeId={tradeId} /> : <App />}
    </GlobalErrorBoundary>
  </StrictMode>
);
