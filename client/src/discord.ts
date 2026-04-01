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
    return {
      userId: null,
      channelId: null,
      guildId: null,
      instanceId: null,
      platform: null,
      sdkAvailable: false,
    };
  }

  try {
    await sdk.ready();

    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;
    const tokenExchangeUrl = import.meta.env.VITE_DISCORD_TOKEN_EXCHANGE_URL as
      | string
      | undefined;

    if (!clientId) {
      throw new Error("Missing VITE_DISCORD_CLIENT_ID");
    }

    if (!tokenExchangeUrl) {
      throw new Error("Missing VITE_DISCORD_TOKEN_EXCHANGE_URL");
    }

    const { code } = await sdk.commands.authorize({
      client_id: clientId,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify"],
    });

    const tokenRes = await fetch(tokenExchangeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Token exchange failed: ${tokenRes.status} ${text}`);
    }

    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson.access_token;

    if (!accessToken) {
      throw new Error("Token exchange response missing access_token");
    }

    const auth = await sdk.commands.authenticate({
      access_token: accessToken,
    });

    const userId = auth?.user?.id ?? null;

    return {
      userId,
      channelId: sdk.channelId ?? null,
      guildId: sdk.guildId ?? null,
      instanceId: sdk.instanceId ?? null,
      platform: sdk.platform ?? null,
      sdkAvailable: true,
    };
  } catch (err) {
    console.error("Discord SDK auth failed:", err);
    return {
      userId: null,
      channelId: null,
      guildId: null,
      instanceId: null,
      platform: null,
      sdkAvailable: false,
    };
  }
}