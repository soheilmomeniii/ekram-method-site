// POST /api/subscribe  { email }
// Keeps the provider key server-side so the page's CSP stays 'self' only.
// Set ONE of these in Vercel → Project → Settings → Environment Variables:
//   BUTTONDOWN_API_KEY                 (buttondown.com → Settings → API)
//   RESEND_API_KEY + RESEND_AUDIENCE_ID  (resend.com → Audiences)
//   CONVERTKIT_API_KEY + CONVERTKIT_FORM_ID

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function toButtonown(email) {
  const r = await fetch("https://api.buttondown.email/v1/subscribers", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.BUTTONDOWN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email_address: email, tags: ["ekram-method"] }),
  });
  // 400 with "already subscribed" is a success from the visitor's point of view
  if (r.ok || r.status === 409) return { ok: true };
  const body = await r.text();
  if (r.status === 400 && /already/i.test(body)) return { ok: true };
  return { ok: false, status: r.status, body };
}

async function toResend(email) {
  const r = await fetch(
    `https://api.resend.com/audiences/${process.env.RESEND_AUDIENCE_ID}/contacts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    }
  );
  if (r.ok) return { ok: true };
  return { ok: false, status: r.status, body: await r.text() };
}

async function toConvertKit(email) {
  const r = await fetch(
    `https://api.convertkit.com/v3/forms/${process.env.CONVERTKIT_FORM_ID}/subscribe`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: process.env.CONVERTKIT_API_KEY, email }),
    }
  );
  if (r.ok) return { ok: true };
  return { ok: false, status: r.status, body: await r.text() };
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

  // honeypot: real people leave it empty
  if (trap) return res.status(200).json({ ok: true });

  if (!EMAIL.test(email) || email.length > 254) {
    return res.status(400).json({ error: "That email doesn't look right." });
  }

  try {
    let result;
    if (process.env.BUTTONDOWN_API_KEY) result = await toButtonown(email);
    else if (process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_ID)
      result = await toResend(email);
    else if (process.env.CONVERTKIT_API_KEY && process.env.CONVERTKIT_FORM_ID)
      result = await toConvertKit(email);
    else {
      // No provider key yet. Don't lose the person: record it in the runtime log
      // (Vercel → Project → Logs, filter "SUBSCRIBER") and accept the signup.
      // Remove this branch once a provider key is set.
      console.log(`SUBSCRIBER ${email} ${new Date().toISOString()}`);
      return res.status(200).json({ ok: true });
    }

    if (!result.ok) {
      console.error("subscribe provider error", result.status, result.body);
      return res.status(502).json({ error: "Couldn't save that. Try again?" });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("subscribe failed", err);
    return res.status(500).json({ error: "Something broke. Try again?" });
  }
}
