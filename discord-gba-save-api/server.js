import "dotenv/config";
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
// maybe working save load?
const app = express();

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key"],
}));
app.options("*", cors());

app.use((req, _res, next) => {
  console.log("[http]", req.method, req.path, {
    origin: req.headers.origin,
    contentType: req.headers["content-type"],
    query: req.query,
  });
  next();
});

app.use(express.json({ limit: "25mb" }));

const PORT = process.env.PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "emulator-saves";
const API_SHARED_SECRET = process.env.API_SHARED_SECRET;

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !API_SHARED_SECRET) {
  throw new Error("Missing required Supabase/API environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function requireApiKey(req, res, next) {
  const key = req.header("x-api-key");
  if (!key || key !== API_SHARED_SECRET) {
    console.log("[auth] Unauthorized request", {
      path: req.path,
      hasKey: !!key,
    });
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

function buildProxyDownloadUrl(req, { userId, romHash, saveType, slot }) {
  const url = new URL(
    `${req.protocol}://${req.get("host")}/api/save/file`
  );
  url.searchParams.set("userId", userId);
  url.searchParams.set("romHash", romHash);
  url.searchParams.set("saveType", saveType);
  url.searchParams.set("slot", String(slot));
  return url.toString();
}

async function getSaveRecord({ userId, romHash, saveType, slot }) {
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

  return data;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/token", async (req, res) => {
  try {
    const { code } = req.body ?? {};

    console.log("[token] request received", {
      hasCode: !!code,
      clientIdPresent: !!DISCORD_CLIENT_ID,
      clientSecretPresent: !!DISCORD_CLIENT_SECRET,
    });

    if (!code) {
      return res.status(400).json({ error: "Missing code" });
    }

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
      return res
        .status(500)
        .json({ error: "Missing Discord OAuth environment variables" });
    }

    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    });

    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const text = await response.text();
    console.log("[token] discord oauth response", response.status, text);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.json({
      access_token: data.access_token,
    });
  } catch (err) {
    console.error("[token] exchange route crashed", err);
    res.status(500).json({ error: "Token exchange failed" });
  }
});

app.get("/api/save/latest", requireApiKey, async (req, res) => {
  console.log("[save/latest] query", req.query);

  try {
    const { userId, romHash, saveType, slot } = req.query;

    if (!userId || !romHash || !saveType) {
      return res.status(400).json({ error: "Missing required query params" });
    }

    const parsedSlot = Number(slot ?? 0);

    const data = await getSaveRecord({
      userId,
      romHash,
      saveType,
      slot: parsedSlot,
    });

    if (!data) {
      console.log("[save/latest] no save found", {
        userId,
        romHash,
        saveType,
        slot: parsedSlot,
      });
      return res.json({ found: false });
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(data.storage_path, 60 * 10);

    if (signedError) {
      throw signedError;
    }

    const proxiedDownloadUrl = buildProxyDownloadUrl(req, {
      userId: data.user_id,
      romHash: data.rom_hash,
      saveType: data.save_type,
      slot: data.slot,
    });

    console.log("[save/latest] found save", {
      userId: data.user_id,
      romHash: data.rom_hash,
      storagePath: data.storage_path,
      updatedAt: data.updated_at,
      proxiedDownloadUrl,
    });

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
        downloadUrl: proxiedDownloadUrl,
        externalDownloadUrl: signed.signedUrl,
      },
    });
  } catch (err) {
    console.error("[save/latest] failed", err);
    res.status(500).json({ error: "Failed to fetch latest save" });
  }
});

app.get("/api/save/file", requireApiKey, async (req, res) => {
  console.log("[save/file] query", req.query);

  try {
    const { userId, romHash, saveType, slot } = req.query;

    if (!userId || !romHash || !saveType) {
      return res.status(400).json({ error: "Missing required query params" });
    }

    const parsedSlot = Number(slot ?? 0);

    const data = await getSaveRecord({
      userId,
      romHash,
      saveType,
      slot: parsedSlot,
    });

    if (!data) {
      console.log("[save/file] no save found", {
        userId,
        romHash,
        saveType,
        slot: parsedSlot,
      });
      return res.status(404).json({ error: "Save not found" });
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .download(data.storage_path);

    if (downloadError) {
      throw downloadError;
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("[save/file] streaming save", {
      storagePath: data.storage_path,
      bytes: buffer.length,
      saveType: data.save_type,
      slot: data.slot,
    });

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  } catch (err) {
    console.error("[save/file] failed", err);
    res.status(500).json({ error: "Failed to stream save file" });
  }
});

app.post("/api/save", requireApiKey, async (req, res) => {
  console.log("[save] body meta", {
    userId: req.body?.userId,
    romHash: req.body?.romHash,
    saveType: req.body?.saveType,
    slot: req.body?.slot,
    hasDataBase64: !!req.body?.dataBase64,
  });

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

    console.log("[save] uploading to storage", {
      storagePath,
      bytes: buffer.length,
      mimeType,
    });

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

    console.log("[save] upsert complete", {
      id: data.id,
      userId: data.user_id,
      romHash: data.rom_hash,
      storagePath: data.storage_path,
      updatedAt: data.updated_at,
    });

    res.json({
      ok: true,
      save: data,
    });
  } catch (err) {
    console.error("[save] failed", err);
    res.status(500).json({ error: "Failed to save blob" });
  }
});

app.listen(PORT, () => {
  console.log(`Save API listening on port ${PORT}`);
});