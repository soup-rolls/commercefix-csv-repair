const fs = require("node:fs");
const path = require("node:path");
const { createTransport } = require("nodemailer");

const envPath = path.resolve(__dirname, "..", ".env.local");
if (!fs.existsSync(envPath)) {
  console.error(JSON.stringify({
    ok: false,
    message: `.env.local not found: ${envPath}`,
    password_printed: false
  }, null, 2));
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = /^\s*([^#][^=]+?)=(.*)$/.exec(line);
  if (!match) continue;
  env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
}

const transporter = createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT),
  secure: env.SMTP_SECURE === "true",
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_APP_PASSWORD
  },
  proxy: env.GMAIL_PROXY_URL && env.GMAIL_PROXY_URL !== "false" ? env.GMAIL_PROXY_URL : undefined
});

transporter.verify()
  .then(() => {
    console.log(JSON.stringify({
      ok: true,
      smtp_user: env.SMTP_USER,
      auth: "verified",
      password_printed: false
    }, null, 2));
  })
  .catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      message: error && error.message ? error.message : "SMTP verify failed",
      password_printed: false
    }, null, 2));
    process.exit(1);
  });
