import { Brush, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LopakaApiClient } from "../api/client";
import { CreatorScreen } from "../create/CreatorScreen";
import { PlayScreen } from "../play/PlayScreen";
import { BrowserSessionStore } from "../platform/browser-session-store";
import { defaultRoute, type AppRoute } from "./routes";

type SessionStatus = "checking" | "ready" | "offline";

export function App() {
  const [route, setRoute] = useState<AppRoute>(defaultRoute);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const sessionStore = useMemo(() => new BrowserSessionStore(), []);
  const apiClient = useMemo(
    () =>
      new LopakaApiClient({
        baseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
        sessionStore,
      }),
    [sessionStore],
  );

  useEffect(() => {
    let isMounted = true;

    apiClient
      .ensureSession()
      .then(() => {
        if (isMounted) {
          setSessionStatus("ready");
        }
      })
      .catch(() => {
        if (isMounted) {
          setSessionStatus("offline");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [apiClient]);

  return (
    <main className="app-shell">
      <header className="app-toolbar">
        <div className="app-brand" aria-label="Lopaka Chameleon">
          <span className="app-brand__mark">LC</span>
          <span className="app-brand__name">Lopaka Chameleon</span>
        </div>

        <nav className="route-tabs" aria-label="Mode">
          <button
            className="route-tabs__button"
            data-active={route === "create"}
            type="button"
            aria-pressed={route === "create"}
            onClick={() => setRoute("create")}
          >
            <Brush size={18} aria-hidden="true" />
            <span>Create</span>
          </button>
          <button
            className="route-tabs__button"
            data-active={route === "play"}
            type="button"
            aria-pressed={route === "play"}
            onClick={() => setRoute("play")}
          >
            <Play size={18} aria-hidden="true" />
            <span>Play</span>
          </button>
        </nav>

        <span className="session-pill" data-status={sessionStatus}>
          {sessionLabel[sessionStatus]}
        </span>
      </header>

      <section className="app-surface" aria-live="polite">
        {route === "create" ? <CreatorScreen /> : <PlayScreen />}
      </section>
    </main>
  );
}

const sessionLabel: Record<SessionStatus, string> = {
  checking: "Syncing",
  ready: "Ready",
  offline: "Offline",
};
