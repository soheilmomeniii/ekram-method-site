// POST /api/subscribe  { email }
//
// Stores signups in Vercel's KV (Upstash Redis). Create it in
// Vercel → Storage → Create Database → Upstash for Redis, then connect it to
// this project — Vercel injects the credentials automatically, so there is no
// key to copy anywhere.
//
// Optional: if BUTTONDOWN_API_KEY is also present, each address is forwarded to
// Buttondown as well. KV stays the source of truth either way.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

async function forwardToButtondown(email) {
  try {
    await fetch("https://api.buttondown.com/v1/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.BUTTONDOWN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email_address: email, tags: ["ekram-method"] }),
    });
  } catch (e) {
    console.error("buttondown forward failed", e); // never blocks the signup
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let email = "";
  let trap = "";
  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    email = String(body.email || "").trim().toLowerCase();
    trap = String(body.company || "");
  } catch {
    return res.status(400).json({ error: "Bad request" });
  }

  if (trap) return res.status(200).json({ ok: true }); // honeypot
  if (!EMAIL.test(email) || email.length > 254) {
    return res.status(400).json({ error: "That email doesn't look right." });
  }

  const cfg = kvConfig();
  if (!cfg) {
    // No store connected yet: don't lose the person.
    console.log(`SUBSCRIBER ${email} ${new Date().toISOString()}`);
    return res.status(200).json({ ok: true });
  }

  try {
    // sorted set, score = signup time, so the list is ordered and deduped
    await kv(`zadd/subs/${Date.now()}/${encodeURIComponent(email)}`, cfg);
    if (process.env.BUTTONDOWN_API_KEY) await forwardToButtondown(email);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("subscribe failed", err);
    console.log(`SUBSCRIBER ${email} ${new Date().toISOString()}`); // safety net
    return res.status(200).json({ ok: true });
  }
}
