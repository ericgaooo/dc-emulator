import { DiscordSDK } from "@discord/embedded-app-sdk";

export type DiscordInfo = {
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
      channelId: null,
      guildId: null,
      instanceId: null,
      platform: null,
      sdkAvailable: false,
    };
  }

  try {
    await sdk.ready();

    return {
      channelId: sdk.channelId ?? null,
      guildId: sdk.guildId ?? null,
      instanceId: sdk.instanceId ?? null,
      platform: sdk.platform ?? null,
      sdkAvailable: true,
    };
  } catch (err) {
    console.error("Discord SDK ready() failed:", err);
    return {
      channelId: null,
      guildId: null,
      instanceId: null,
      platform: null,
      sdkAvailable: false,
    };
  }
}