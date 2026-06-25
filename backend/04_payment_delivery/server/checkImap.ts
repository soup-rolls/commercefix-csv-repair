import { loadAutomationConfig } from "./automationConfig";
import { checkImapConnection } from "./imapClient";

const config = loadAutomationConfig();

checkImapConnection({
  host: config.imapHost,
  port: config.imapPort,
  secure: config.imapSecure,
  user: config.imapUser,
  password: config.imapAppPassword,
  mailbox: config.imapMailbox,
  searchQuery: config.imapSearchQuery,
  proxyUrl: config.gmailProxyUrl
})
  .then((result) => {
    console.log(JSON.stringify({
      ...result,
      user: config.imapUser,
      app_password_length: config.imapAppPassword.length
    }, null, 2));
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
