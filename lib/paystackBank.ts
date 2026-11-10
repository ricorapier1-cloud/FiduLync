import 'server-only';
import { NIGERIAN_BANKS } from '@/lib/banks';
import { getPaystackSecretKey } from '@/lib/serverConfig';

type BankResolution =
  | { ok: true; accountName: string; accountNumber: string }
  | { ok: false; status: 400 | 502 | 503; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function resolvePaystackBankAccount(
  accountNumber: string,
  bankCode: string,
): Promise<BankResolution> {
  if (!/^\d{10}$/.test(accountNumber) || !NIGERIAN_BANKS.some((bank) => bank.code === bankCode)) {
    return { ok: false, status: 400, message: 'Provide a valid 10-digit account number and supported bank.' };
  }

  const secret = getPaystackSecretKey();
  if (!secret) {
    return { ok: false, status: 503, message: 'Bank verification is not configured.' };
  }

  const params = new URLSearchParams({ account_number: accountNumber, bank_code: bankCode });
  let response: Response;
  try {
    response = await fetch(`https://api.paystack.co/bank/resolve?${params}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    console.error(timedOut ? 'Paystack bank verification timed out.' : 'Paystack bank verification request failed.');
    return {
      ok: false,
      status: 503,
      message: timedOut ? 'Bank verification timed out. Please try again.' : 'Bank verification is temporarily unavailable.',
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    console.error('Paystack returned an unreadable bank verification response:', error);
    return { ok: false, status: 502, message: 'Bank verification returned an invalid response.' };
  }

  if (!response.ok) {
    return { ok: false, status: 502, message: 'Bank verification is temporarily unavailable.' };
  }
  if (!isRecord(payload) || typeof payload.status !== 'boolean') {
    console.error('Paystack returned an invalid bank verification payload.');
    return { ok: false, status: 502, message: 'Bank verification returned an invalid response.' };
  }
  if (!payload.status) {
    return { ok: false, status: 400, message: 'Account could not be verified. Check the bank and account number.' };
  }
  if (!isRecord(payload.data)) {
    console.error('Paystack returned incomplete bank verification details.');
    return { ok: false, status: 502, message: 'Bank verification returned invalid account details.' };
  }

  const resolvedName = payload.data.account_name;
  const resolvedNumber = payload.data.account_number;
  if (
    typeof resolvedName !== 'string' ||
    resolvedName.trim().length < 2 ||
    resolvedName.trim().length > 100 ||
    typeof resolvedNumber !== 'string' ||
    resolvedNumber !== accountNumber
  ) {
    console.error('Paystack returned invalid bank account details.');
    return { ok: false, status: 502, message: 'Bank verification returned invalid account details.' };
  }

  return { ok: true, accountName: resolvedName.trim(), accountNumber: resolvedNumber };
}
