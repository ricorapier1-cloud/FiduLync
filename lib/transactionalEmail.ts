import 'server-only';

type EmailInput = {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
};

export function isTransactionalEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.LICENSE_FROM_EMAIL?.trim());
}

export async function sendTransactionalEmail(input: EmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? '';
  const from = process.env.LICENSE_FROM_EMAIL?.trim() ?? '';
  if (!apiKey || !from) return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Transactional email provider rejected a message:', response.status, detail.slice(0, 500));
    return false;
  }
  return true;
}

export function escapeEmailHtml(value: string): string {
  const entities: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

export async function sendLicenseDeliveryEmail(input: {
  email: string;
  licenseKey: string;
  mt5Account: number;
  tier: string;
  expiresAt: string | null;
  reference: string;
}): Promise<boolean> {
  const key = escapeEmailHtml(input.licenseKey);
  const account = escapeEmailHtml(String(input.mt5Account));
  const tier = escapeEmailHtml(input.tier.replaceAll('_', ' '));
  const expiry = input.expiresAt
    ? escapeEmailHtml(new Date(input.expiresAt).toUTCString())
    : 'Lifetime';
  return sendTransactionalEmail({
    to: input.email,
    subject: 'Your AlgoLync MT5 license is ready',
    idempotencyKey: `algolync-license-${input.reference}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17202a"><h2>Your AlgoLync license is ready</h2><p>Your payment has been verified and your license has been bound to the MT5 account below.</p><p><strong>License key</strong><br><code style="display:inline-block;padding:12px;background:#eef5f1;font-size:16px">${key}</code></p><p><strong>MT5 account:</strong> ${account}<br><strong>Plan:</strong> ${tier}<br><strong>Expiry:</strong> ${expiry}</p><p>In MT5, allow WebRequest to <a href="https://fidulync.vercel.app">https://fidulync.vercel.app</a> under Tools → Options → Expert Advisors. Keep this key private.</p><p>Installation guide: <a href="https://fidulync.vercel.app/downloads/AlgoLync_EA_README.txt">Open guide</a></p><p>— FiduLync / AlgoLync</p></div>`,
  });
}

export async function sendTransferCodeEmail(email: string, code: string, requestId: string): Promise<boolean> {
  return sendTransactionalEmail({
    to: email,
    subject: 'Confirm your AlgoLync MT5 account transfer',
    idempotencyKey: `algolync-transfer-${requestId}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#17202a"><h2>Confirm your MT5 account transfer</h2><p>Use this one-time code to approve the transfer of your AlgoLync license.</p><p style="font-size:28px;letter-spacing:8px;font-weight:bold">${escapeEmailHtml(code)}</p><p>This code expires in 10 minutes and can be used once. If you did not request this, ignore this email and contact FiduLync support.</p><p>— FiduLync / AlgoLync</p></div>`,
  });
}
