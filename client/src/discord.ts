import { DiscordSDK } from "@discord/embedded-app-sdk";

export type DiscordInfo = {
  userId: string | null;
  channelId: string | null;
  guildId: string | null;
  instanceId: string | null;
  platform: string | null;
  sdkAvailable: boolean;
};

let discordSdk: DiscordSDK | null = null;

function hasDiscordFrameParams() {
  const params = new URLSearchParams(window.location.search);
  return params.has("frame_id");
}

export function getDiscordSdk() {
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;

  if (!clientId) return null;
  if (!hasDiscordFrameParams()) return null;

  if (!discordSdk) {
    discordSdk = new DiscordSDK(clientId);
  }

  return discordSdk;
}

export async function setupDiscordSdk(): Promise<DiscordInfo> {
  const sdk = getDiscordSdk();

  if (!sdk) {
    console.log("[discord] SDK unavailable: missing client id or frame_id");
    return {
      userId: null,
      channelId: null,
      guildId: null,
      instanceId: null,
      platform: null,
      sdkAvailable: false,
    };
  }

  const baseInfo = {
    channelId: sdk.channelId ?? null,
    guildId: sdk.guildId ?? null,
    instanceId: sdk.instanceId ?? null,
    platform: sdk.platform ?? null,
  };

  try {
    await sdk.ready();
    console.log("[discord] ready()", baseInfo);

    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;
    const tokenExchangeUrl = import.meta.env.VITE_DISCORD_TOKEN_EXCHANGE_URL as
      | string
      | undefined;
    const redirectUri = import.meta.env.VITE_DISCORD_REDIRECT_URI as
      | string
      | undefined;

    if (!clientId) throw new Error("Missing VITE_DISCORD_CLIENT_ID");
    if (!tokenExchangeUrl) throw new Error("Missing VITE_DISCORD_TOKEN_EXCHANGE_URL");
    if (!redirectUri) throw new Error("Missing VITE_DISCORD_REDIRECT_URI");

    const authz = await sdk.commands.authorize({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: ["identify"],
      prompt: "none",
      state: crypto.randomUUID(),
    });

    console.log("[discord] authorize() ok");

    const tokenRes = await fetch(tokenExchangeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: authz.code,
      }),
    });

    const tokenText = await tokenRes.text();
    console.log("[discord] token exchange status", tokenRes.status);

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status} ${tokenText}`);
    }

    const tokenJson = JSON.parse(tokenText);
    const accessToken = tokenJson.access_token;

    if (!accessToken) {
      throw new Error("Token exchange response missing access_token");
    }

    const auth = await sdk.commands.authenticate({
      access_token: accessToken,
    });

    console.log("[discord] authenticate() result", auth);

    return {
      userId: auth?.user?.id ?? null,
      ...baseInfo,
      sdkAvailable: true,
    };
  } catch (err) {
    console.error("[discord] auth flow failed", err);
    return {
      userId: null,
      ...baseInfo,
      sdkAvailable: true,
    };
  }
}