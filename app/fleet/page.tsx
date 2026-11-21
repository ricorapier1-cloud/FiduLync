import { redirect } from 'next/navigation';

/**
 * Account-specific fleet telemetry is private and is not exposed as a public page.
 * The research terminal remains accessible without a browser login.
 */
export default function EaFleetPage() {
  redirect('/analytics');
}
