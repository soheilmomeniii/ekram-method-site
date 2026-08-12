// Daily digest -> Telegram. Triggered by Vercel Cron (see vercel.json).
// Manual run: /api/digest?token=ADMIN_TOKEN
//
// Needs TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID. Silent if they're missing.

function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function tg(text) {
  const bot = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!bot || !chat) return false;
  const r = await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chat,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  return r.ok;
}

export default async function handler(req, res) {
  // Vercel Cron marks its own requests; otherwise require the admin token.
  const fromCron = Boolean(req.headers["x-vercel-cron"]);
  const admin = process.env.ADMIN_TOKEN;
  if (!fromCron) {
    if (!admin || String(req.query.token || "") !== admin) {
      return res.status(404).json({ error: "Not found" });
    }
  }

  const cfg = kvConfig();
  if (!cfg) return res.status(503).json({ error: "No store connected" });

  try {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const [allRes, dayRes] = await Promise.all([
      fetch(`${cfg.url}/zcard/subs`, {
        headers: { Authorization: `Bearer ${cfg.token}` },
      }),
      fetch(`${cfg.url}/zrangebyscore/subs/${since}/+inf`, {
        headers: { Authorization: `Bearer ${cfg.token}` },
      }),
    ]);
    const total = (await allRes.json()).result || 0;
    const fresh = (await dayRes.json()).result || [];

    if (!fresh.length) {
      return res.status(200).json({ ok: true, total, new: 0, sent: false });
    }

    const lines = fresh.map((e) => `• ${e}`).join("\n");
    const sent = await tg(
      `<b>The Ekram Method</b>\n${fresh.length} new signup${
        fresh.length === 1 ? "" : "s"
      } in the last 24h\n\n${lines}\n\n<b>${total}</b> total`
    );
    return res.status(200).json({ ok: true, total, new: fresh.length, sent });
  } catch (err) {
    console.error("digest failed", err);
    return res.status(500).json({ error: "Digest failed" });
  }
}
