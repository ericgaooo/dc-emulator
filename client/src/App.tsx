import { useEffect, useRef, useState } from "react";
import { setupDiscordSdk, type DiscordInfo } from "./discord";

type IframeContextMessage = {
  type: "DISCORD_CONTEXT";
  payload: {
    userId: string | null;
    guildId: string | null;
    channelId: string | null;
    instanceId: string | null;
    platform: string | null;
    sdkAvailable: boolean;
  };
};

export default function App() {
  const [discordInfo, setDiscordInfo] = useState<DiscordInfo | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [iframeReady, setIframeReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

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

  useEffect(() => {
    if (!iframeReady || !iframeRef.current) return;

    const payload: IframeContextMessage = {
      type: "DISCORD_CONTEXT",
      payload: {
        userId:
          // your DiscordInfo type should include this
          // if it doesn't yet, add it in setupDiscordSdk()
          (discordInfo as DiscordInfo & { userId?: string | null })?.userId ??
          null,
        guildId: discordInfo?.guildId ?? null,
        channelId: discordInfo?.channelId ?? null,
        instanceId: discordInfo?.instanceId ?? null,
        platform: discordInfo?.platform ?? null,
        sdkAvailable: discordInfo?.sdkAvailable ?? false,
      },
    };

    iframeRef.current.contentWindow?.postMessage(payload, window.location.origin);
  }, [iframeReady, discordInfo]);

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
            <strong>User:</strong>{" "}
            {(discordInfo as DiscordInfo & { userId?: string | null })?.userId ??
              "n/a"}
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
            The emulator UI below is served from <code>/emulatorjs/index.html</code>.
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
            ref={iframeRef}
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