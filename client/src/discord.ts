import { DiscordSDK } from "@discord/embedded-app-sdk";

export type DiscordInfo = {
  userId: string | null;
  channelId: string | null;
  guildId: string | null;
  instanceId: string | null;
  platform: string | null;
  sdkAvailable: boolean;
  authError: string | null;
};

let discordSdk: DiscordSDK | null = null;

function stringifyUnknownError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }

  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
}

export function getDiscordSdk() {
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;

  if (!clientId) {
    return null;
  }

  if (!discordSdk) {
    discordSdk = new DiscordSDK(clientId);
  }

  return discordSdk;
}

export async function setupDiscordSdk(): Promise<DiscordInfo> {
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;
  const tokenExchangeUrl = import.meta.env.VITE_DISCORD_TOKEN_EXCHANGE_URL as
    | string
    | undefined;
  const redirectUri = import.meta.env.VITE_DISCORD_REDIRECT_URI as
    | string
    | undefined;

  if (!clientId) {
    return {
      userId: null,
      channelId: null,
      guildId: null,
      instanceId: null,
      platform: null,
      sdkAvailable: false,
      authError: "Missing VITE_DISCORD_CLIENT_ID",
    };
  }

  if (!tokenExchangeUrl) {
    return {
      userId: null,
      channelId: null,
      guildId: null,
      instanceId: null,
      platform: null,
      sdkAvailable: false,
      authError: "Missing VITE_DISCORD_TOKEN_EXCHANGE_URL",
    };
  }

  if (!redirectUri) {
    return {
      userId: null,
      channelId: null,
      guildId: null,
      instanceId: null,
      platform: null,
      sdkAvailable: false,
      authError: "Missing VITE_DISCORD_REDIRECT_URI",
    };
  }

  const sdk = getDiscordSdk();

  if (!sdk) {
    return {
      userId: null,
      channelId: null,
      guildId: null,
      instanceId: null,
      platform: null,
      sdkAvailable: false,
      authError: "Failed to create Discord SDK",
    };
  }

  const baseInfo = {
    channelId: sdk.channelId ?? null,
    guildId: sdk.guildId ?? null,
    instanceId: sdk.instanceId ?? null,
    platform: sdk.platform ?? null,
  };

  try {
    console.log("[discord] location.search", window.location.search);
    console.log("[discord] token exchange url", tokenExchangeUrl);
    console.log("[discord] redirect uri", redirectUri);

    await sdk.ready();

    console.log("[discord] ready()", {
      channelId: sdk.channelId,
      guildId: sdk.guildId,
      instanceId: sdk.instanceId,
      platform: sdk.platform,
    });

    const authz = await sdk.commands.authorize({
      client_id: clientId,
      response_type: "code",
      scope: ["identify"],
      prompt: "none",
      state: crypto.randomUUID(),
      redirect_uri: redirectUri,
    } as any);

    console.log("[discord] authorize() ok", authz);

    const tokenRes = await fetch(tokenExchangeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: authz.code }),
    });

    const tokenText = await tokenRes.text();
    console.log("[discord] token exchange raw", tokenRes.status, tokenText);

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status} ${tokenText}`);
    }

    const tokenJson = JSON.parse(tokenText);
    const accessToken = tokenJson.access_token;

    if (!accessToken) {
      throw new Error(`Token exchange response missing access_token: ${tokenText}`);
    }

    const auth = await sdk.commands.authenticate({
      access_token: accessToken,
    });

    console.log("[discord] authenticate() result", auth);

    return {
      userId: auth?.user?.id ?? null,
      channelId: sdk.channelId ?? null,
      guildId: sdk.guildId ?? null,
      instanceId: sdk.instanceId ?? null,
      platform: sdk.platform ?? null,
      sdkAvailable: true,
      authError: null,
    };
  } catch (err) {
    const pretty = stringifyUnknownError(err);
    console.error("[discord] auth flow failed", err);

    return {
      userId: null,
      ...baseInfo,
      sdkAvailable: true,
      authError: pretty,
    };
  }
}