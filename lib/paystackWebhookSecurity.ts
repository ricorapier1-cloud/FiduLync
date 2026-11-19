import { createHmac, timingSafeEqual } from 'node:crypto';

type HeaderReader = { get(name: string): string | null };
type PaystackSignatureSecrets = { legacySecret?: string; webhookSecret?: string };

function matchesHex(expectedHex: string, suppliedHex: string): boolean {
  if (!/^[a-f0-9]{128}$/i.test(suppliedHex)) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const supplied = Buffer.from(suppliedHex, 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function verifyPaystackWebhookSignature(
  rawBody: string,
  headers: HeaderReader,
  secrets: PaystackSignatureSecrets,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const modernHeader = headers.get('paystack-signature') ?? '';
  const webhookSecret = secrets.webhookSecret?.trim() ?? '';
  if (modernHeader && webhookSecret) {
    if (!webhookSecret.startsWith('whsec_')) return false;
    const parts = modernHeader.split(',').map((part) => part.trim());
    const timestampPart = parts.find((part) => part.startsWith('t='));
    const timestamp = timestampPart ? Number(timestampPart.slice(2)) : NaN;
    if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) return false;
    const signedPayload = timestamp + '.' + rawBody;
    const expected = createHmac('sha512', webhookSecret).update(signedPayload).digest('hex');
    const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3).split(':').at(-1) ?? '');
    return signatures.some((signature) => matchesHex(expected, signature));
  }

  const legacySecret = secrets.legacySecret?.trim() ?? '';
  const legacySignature = headers.get('x-paystack-signature') ?? '';
  if (!legacySecret.startsWith('sk_') || !/^[a-f0-9]{128}$/i.test(legacySignature)) return false;
  const expected = createHmac('sha512', legacySecret).update(rawBody).digest('hex');
  return matchesHex(expected, legacySignature);
}
