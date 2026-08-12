// POST /api/subscribe  { handle }
//
// Stores signups in Vercel's KV (Upstash Redis). Create it in
// Vercel → Storage → Create Database → Upstash for Redis, then connect it to
// this project — Vercel injects the credentials automatically, so there is no
// key to copy anywhere.
//
// Stores Telegram / X handles, not email addresses: the point is a feedback
// round you can DM, not a mailing list.

const HANDLE = /^@?[A-Za-z0-9_]{2,32}$/; // X or Telegram username

function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function kv(path, cfg) {
  const r = await fetch(`${cfg.url}/${path}`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`kv ${path} -> ${r.status} ${JSON.stringify(body)}`);
  return body.result;
}

async function pingTelegram(handle, total) {
  const bot = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!bot || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: `New signup\n${handle}${total ? `\n\n${total} total` : ""}`,
        disable_web_page_preview: true,
      }),
    });
  } catch (e) {
    console.error("telegram ping failed", e); // never blocks the signup
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let handle = "";
  let trap = "";
  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    handle = String(body.email || "").trim().toLowerCase();
    trap = String(body.company || "");
  } catch {
    return res.status(400).json({ error: "Bad request" });
  }

  if (trap) return res.status(200).json({ ok: true }); // honeypot
  if (!HANDLE.test(handle)) {
    return res
      .status(400)
      .json({ error: "A Telegram or X handle, like @somonaut." });
  }
  if (!handle.startsWith("@")) handle = `@${handle}`; // store handles consistently

  const cfg = kvConfig();
  if (!cfg) {
    // No store connected yet: don't lose the person.
    console.log(`SUBSCRIBER ${handle} ${new Date().toISOString()}`);
    return res.status(200).json({ ok: true });
  }

  try {
    // sorted set, score = signup time, so the list is ordered and deduped
    const added = await kv(`zadd/subs/${Date.now()}/${encodeURIComponent(handle)}`, cfg);
    if (added) {
      // only ping for genuinely new addresses, not repeat submits
      const total = await kv("zcard/subs", cfg).catch(() => null);
      await pingTelegram(handle, total);
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("subscribe failed", err);
    console.log(`SUBSCRIBER ${handle} ${new Date().toISOString()}`); // safety net
    return res.status(200).json({ ok: true });
  }
}
