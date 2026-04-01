import "dotenv/config";
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

const PORT = process.env.PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "emulator-saves";
const API_SHARED_SECRET = process.env.API_SHARED_SECRET;

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !API_SHARED_SECRET) {
  throw new Error("Missing required Supabase/API environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function requireApiKey(req, res, next) {
  const key = req.header("x-api-key");
  if (!key || key !== API_SHARED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function buildStoragePath({ userId, romHash, saveType, slot }) {
  if (saveType === "battery") {
    return `${userId}/${romHash}/battery/0.sav`;
  }
  return `${userId}/${romHash}/state/${slot}.state`;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/token", async (req, res) => {
  try {
    const { code } = req.body ?? {};

    if (!code) {
      return res.status(400).json({ error: "Missing code" });
    }

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI) {
      return res
        .status(500)
        .json({ error: "Missing Discord OAuth environment variables" });
    }

    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: DISCORD_REDIRECT_URI,
    });

    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Discord token exchange failed:", data);
      return res.status(response.status).json(data);
    }

    return res.json({
      access_token: data.access_token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Token exchange failed" });
  }
});

app.get("/api/save/latest", requireApiKey, async (req, res) => {
  try {
    const { userId, romHash, saveType, slot } = req.query;

    if (!userId || !romHash || !saveType) {
      return res.status(400).json({ error: "Missing required query params" });
    }

    const parsedSlot = Number(slot ?? 0);

    const { data, error } = await supabase
      .from("emulator_saves")
      .select("*")
      .eq("user_id", userId)
      .eq("rom_hash", romHash)
      .eq("save_type", saveType)
      .eq("slot", parsedSlot)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.json({ found: false });
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(data.storage_path, 60 * 10);

    if (signedError) {
      throw signedError;
    }

    return res.json({
      found: true,
      save: {
        userId: data.user_id,
        romHash: data.rom_hash,
        romName: data.rom_name,
        saveType: data.save_type,
        slot: data.slot,
        updatedAt: data.updated_at,
        storagePath: data.storage_path,
        downloadUrl: signed.signedUrl,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch latest save" });
  }
});

app.post("/api/save", requireApiKey, async (req, res) => {
  try {
    const {
      userId,
      romHash,
      romName,
      saveType,
      slot = 0,
      dataBase64,
      mimeType = "application/octet-stream",
      metadata = {},
    } = req.body ?? {};

    if (!userId || !romHash || !saveType || !dataBase64) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const parsedSlot = Number(slot);
    const storagePath = buildStoragePath({
      userId,
      romHash,
      saveType,
      slot: parsedSlot,
    });

    const buffer = Buffer.from(dataBase64, "base64");

    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(storagePath, buffer, {
        upsert: true,
        contentType: mimeType,
      });

    if (uploadError) {
      throw uploadError;
    }

    const payload = {
      user_id: userId,
      rom_hash: romHash,
      rom_name: romName ?? null,
      save_type: saveType,
      slot: parsedSlot,
      storage_path: storagePath,
      file_size: buffer.length,
      metadata,
      updated_at: new Date().toISOString(),
    };

    const { data, error: dbError } = await supabase
      .from("emulator_saves")
      .upsert(payload, {
        onConflict: "user_id,rom_hash,save_type,slot",
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    res.json({
      ok: true,
      save: data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save blob" });
  }
});

app.listen(PORT, () => {
  console.log(`Save API listening on port ${PORT}`);
});