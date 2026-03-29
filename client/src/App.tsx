import { useEffect, useState } from "react";
import { setupDiscordSdk, type DiscordInfo } from "./discord";

export default function App() {
  const [discordInfo, setDiscordInfo] = useState<DiscordInfo | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [iframeReady, setIframeReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    setupDiscordSdk()
      .then((info) => {
        if (!mounted) return;
        setDiscordInfo(info);
        setStatus(
          info.sdkAvailable
            ? "Discord Activity ready"
            : "Running in browser preview mode"
        );
      })
      .catch((err) => {
        console.error(err);
        if (!mounted) return;
        setStatus("Discord init failed, but shell is running");
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f1115",
        color: "white",
        padding: 20,
        fontFamily: "Inter, system-ui, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gap: 16,
        }}
      >
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: "#171a21",
            border: "1px solid #2a2f3a",
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 12 }}>
            Discord Activity GBA Shell
          </h1>

          <div>
            <strong>Status:</strong> {status}
          </div>
          <div>
            <strong>SDK available:</strong>{" "}
            {discordInfo?.sdkAvailable ? "yes" : "no"}
          </div>
          <div>
            <strong>Guild:</strong> {discordInfo?.guildId ?? "n/a"}
          </div>
          <div>
            <strong>Channel:</strong> {discordInfo?.channelId ?? "n/a"}
          </div>
          <div>
            <strong>Instance:</strong> {discordInfo?.instanceId ?? "n/a"}
          </div>
          <div>
            <strong>Platform:</strong> {discordInfo?.platform ?? "n/a"}
          </div>

          <p style={{ marginTop: 12, marginBottom: 0, color: "#c9ced6" }}>
            The emulator UI below is served from{" "}
            <code>/emulatorjs/index.html</code>.
          </p>
        </div>

        <div
          style={{
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid #2a2f3a",
            background: "#000",
            minHeight: "80vh",
            position: "relative",
          }}
        >
          {!iframeReady && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                background: "#111",
                color: "#ddd",
                zIndex: 1,
              }}
            >
              Loading emulator frontend...
            </div>
          )}

          <iframe
            title="GBA Emulator Frontend"
            src="/emulatorjs/index.html"
            onLoad={() => setIframeReady(true)}
            style={{
              width: "100%",
              height: "80vh",
              border: "none",
              display: "block",
              background: "#000",
            }}
            allow="fullscreen; gamepad; clipboard-read; clipboard-write"
          />
        </div>
      </div>
    </div>
  );
}