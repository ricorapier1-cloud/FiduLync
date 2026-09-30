import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'FiduLync',
    short_name: 'FiduLync',
    description: 'Secure P2P escrow payment links. Lock funds safely until delivery is confirmed.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#059669',
    lang: 'en',
    dir: 'ltr',
    categories: ['finance', 'business', 'utilities'],
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshot-desktop.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
        label: 'FiduLync Desktop App',
      },
      {
        src: '/screenshot-mobile.png',
        sizes: '750x1334',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'FiduLync Mobile App',
      },
    ],
  }
}
