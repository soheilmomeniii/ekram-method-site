// GET /api/list?token=...        -> JSON  { count, subscribers: [{email, at}] }
// GET /api/list?token=...&csv=1  -> CSV download
//
// Set ADMIN_TOKEN in Vercel → Settings → Environment Variables to enable this.
// Without it the route 404s, so the list is never publicly readable.

function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export default async function handler(req, res) {
  const admin = process.env.ADMIN_TOKEN;
  if (!admin) return res.status(404).json({ error: "Not found" });

  const given = String(req.query.token || "");
  // constant-ish time compare
  if (given.length !== admin.length || given !== admin) {
    return res.status(401).json({ error: "Nope" });
  }

  const cfg = kvConfig();
  if (!cfg) return res.status(503).json({ error: "No store connected" });

  try {
    const r = await fetch(`${cfg.url}/zrange/subs/0/-1/withscores`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
    });
    const body = await r.json();
    const flat = body.result || [];

    const rows = [];
    for (let i = 0; i < flat.length; i += 2) {
      rows.push({
        email: flat[i],
        at: new Date(Number(flat[i + 1])).toISOString(),
      });
    }

    if (req.query.csv) {
      const csv =
        "email,signed_up_at\n" + rows.map((r) => `${r.email},${r.at}`).join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="ekram-method-subscribers.csv"'
      );
      return res.status(200).send(csv);
    }

    return res.status(200).json({ count: rows.length, subscribers: rows });
  } catch (err) {
    console.error("list failed", err);
    return res.status(500).json({ error: "Couldn't read the list" });
  }
}
