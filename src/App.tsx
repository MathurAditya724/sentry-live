import { useState } from "react";
import { CobeGlobe } from "./components/cobe-globe";
import { useEventStream } from "./hooks/use-event-stream";

function formatCoordinate(
  value: number,
  positive: string,
  negative: string,
): string {
  return `${Math.abs(value).toFixed(1)}${value >= 0 ? positive : negative}`;
}

function App() {
  const { sampledLabel, feed, markers, isConnected } = useEventStream();
  const [collapsed, setCollapsed] = useState(false);
  const currentYear = new Date().getFullYear();

  return (
    <div className="app-shell">
      <div className="orbital-glow" />
      <div className="globe-wrap">
        <CobeGlobe markers={markers} />
      </div>

      <main className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <header className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-gradient-to-b from-[#0b0914]/65 to-[#0b0914]/45 px-4 py-2.5 backdrop-blur-xl max-md:flex-col max-md:items-start max-md:gap-2.5">
          <div className="flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="Sentry"
              className="h-auto w-[clamp(76px,10vw,116px)] opacity-95"
            />
            <span className="h-6 w-px bg-white/20" aria-hidden="true" />
            <div className="flex items-center gap-1.5">
              <h1 className="m-0 text-base font-medium tracking-[0.01em]">
                Live Orbital
              </h1>
              {isConnected ? (
                <span
                  className="relative inline-flex h-2.5 w-2.5"
                  title="Connected"
                  aria-label="Connected"
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(110,231,183,0.2)]" />
                </span>
              ) : (
                <span
                  className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_0_3px_rgba(252,211,77,0.2)]"
                  title="Reconnecting"
                  aria-label="Reconnecting"
                />
              )}
            </div>
          </div>

          <div className="max-md:w-full max-md:text-left md:text-right">
            <p className="m-0 text-[1.04rem] leading-tight font-semibold">
                {sampledLabel}
            </p>
            <p className="m-0 text-[0.61rem] tracking-[0.08em] text-[#e6e0f4]/65 uppercase">
              events sampled
            </p>
          </div>
        </header>

        <aside className="pointer-events-auto w-full overflow-hidden rounded-xl border border-[#9e75ff]/30 bg-[#0a0813]/70 backdrop-blur-xl md:max-w-[350px] md:self-end">
          <button
            type="button"
            className="flex w-full cursor-pointer justify-between bg-white/5 px-3.5 py-2.5 text-xs tracking-[0.09em] text-[#f4f2fa] uppercase"
            onClick={() => setCollapsed((value) => !value)}
          >
            <span>Live events</span>
            <span>{collapsed ? "+" : "-"}</span>
          </button>
          {!collapsed && (
            <ul className="m-0 max-h-[270px] list-none overflow-auto p-0">
              {feed.map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between gap-2.5 border-t border-white/10 px-3.5 py-2.5 text-[0.86rem]"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: `rgb(${Math.round(item.color[0] * 255)} ${Math.round(item.color[1] * 255)} ${Math.round(item.color[2] * 255)})`,
                      }}
                    />
                    <strong className="capitalize">{item.platform}</strong>
                  </div>
                  <span className="text-[#c8c0dc] [font-variant-numeric:tabular-nums]">
                    {formatCoordinate(item.lat, "N", "S")}{" "}
                    {formatCoordinate(item.lng, "E", "W")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[0.7rem] tracking-[0.08em] text-white/55">
          {`\u00A9 ${currentYear} Sentry`}
        </p>
      </main>
    </div>
  );
}

export default App;
