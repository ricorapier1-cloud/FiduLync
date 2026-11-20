import { redirect } from 'next/navigation';

/**
 * EA Fleet telemetry is part of the authenticated owner command centre.
 * Do not render a public fleet or storefront surface here.
 */
export default function EaFleetPage() {
  redirect('/owner');
}
