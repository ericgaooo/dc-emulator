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