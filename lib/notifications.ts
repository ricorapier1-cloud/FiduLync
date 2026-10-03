import { Resend } from 'resend';

// Initialize with your Resend API Key (add RESEND_API_KEY to Vercel)
const resend = new Resend(process.env.RESEND_API_KEY || '');

export async function sendEscrowNotification(email: string, type: 'funded' | 'completed' | 'disputed', amount: number, linkId: string) {
  if (!process.env.RESEND_API_KEY) return; // Skip if no key is configured

  const subjectMap = {
    funded: `Funds Locked! ₦${amount.toLocaleString()} is secured.`,
    completed: `Payout Triggered for Escrow ${linkId}`,
    disputed: `URGENT: Dispute Raised for Escrow ${linkId}`
  }

  const htmlMap = {
    funded: `<p>Great news! The buyer has paid ₦${amount.toLocaleString()} into FiduLync's secure vault.</p><p>You are now completely safe to deliver the item or service. The funds will be released to you the moment the buyer confirms delivery.</p>`,
    completed: `<p>The buyer has confirmed delivery! Your payout of ₦${(amount * 0.98).toLocaleString()} (minus platform fee) has been routed to your bank account.</p>`,
    disputed: `<p>The buyer has raised a dispute regarding this transaction. Your funds are currently frozen pending an admin review.</p>`
  }

  try {
    await resend.emails.send({
      from: 'FiduLync Escrow <secure@fidulync.com>',
      to: email,
      subject: subjectMap[type],
      html: htmlMap[type]
    });
  } catch (err) {
    console.error('Failed to send notification', err);
  }
}
