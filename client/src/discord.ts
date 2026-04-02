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
    await sdk.ready();

    const authz = await sdk.commands.authorize({
      client_id: clientId,
      response_type: "code",
      scope: ["identify"],
      prompt: "none",
      state: crypto.randomUUID(),
    });

    const tokenRes = await fetch(tokenExchangeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: authz.code }),
    });

    const tokenText = await tokenRes.text();

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
    return {
      userId: null,
      ...baseInfo,
      sdkAvailable: true,
      authError: stringifyUnknownError(err),
    };
  }
}