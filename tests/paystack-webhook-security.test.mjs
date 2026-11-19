import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyPaystackWebhookSignature } from '../.quant-test/paystackWebhookSecurity.js';

const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ALGO_TEST' } });
const legacySecret = 'sk_test_example_secret';
const webhookSecret = 'whsec_example_signing_secret';

test('accepts the legacy x-paystack-signature over the exact raw body', () => {
  const signature = createHmac('sha512', legacySecret).update(body).digest('hex');
  assert.equal(verifyPaystackWebhookSignature(body, new Headers({ 'x-paystack-signature': signature }), { legacySecret }), true);
});

test('accepts a timestamped Paystack-Signature with a matching v1 signature', () => {
  const now = 1_800_000_000;
  const signature = createHmac('sha512', webhookSecret).update(now + '.' + body).digest('hex');
  const headers = new Headers({ 'paystack-signature': `t=${now},v1=whk_test:${signature}` });
  assert.equal(verifyPaystackWebhookSignature(body, headers, { webhookSecret }, now), true);
});

test('rejects stale timestamped webhook signatures', () => {
  const now = 1_800_000_000;
  const oldTimestamp = now - 301;
  const signature = createHmac('sha512', webhookSecret).update(oldTimestamp + '.' + body).digest('hex');
  const headers = new Headers({ 'paystack-signature': `t=${oldTimestamp},v1=whk_test:${signature}` });
  assert.equal(verifyPaystackWebhookSignature(body, headers, { webhookSecret }, now), false);
});

test('rejects a modified raw body', () => {
  const signature = createHmac('sha512', legacySecret).update(body).digest('hex');
  assert.equal(verifyPaystackWebhookSignature(body + ' ', new Headers({ 'x-paystack-signature': signature }), { legacySecret }), false);
});

test('does not downgrade to the legacy signature when a configured modern signature is invalid', () => {
  const legacySignature = createHmac('sha512', legacySecret).update(body).digest('hex');
  const headers = new Headers({
    'paystack-signature': 't=1800000000,v1=whk_test:' + 'a'.repeat(128),
    'x-paystack-signature': legacySignature,
  });
  assert.equal(verifyPaystackWebhookSignature(body, headers, { legacySecret, webhookSecret }, 1_800_000_000), false);
});

test('fails closed when a configured modern signing secret has an invalid format', () => {
  const legacySignature = createHmac('sha512', legacySecret).update(body).digest('hex');
  const headers = new Headers({
    'paystack-signature': 't=1800000000,v1=whk_test:' + 'a'.repeat(128),
    'x-paystack-signature': legacySignature,
  });
  assert.equal(verifyPaystackWebhookSignature(body, headers, { legacySecret, webhookSecret: 'wrong-prefix-secret' }, 1_800_000_000), false);
});
