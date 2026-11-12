import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MacroLync & AlgoLync Terminal',
    short_name: 'MacroLync',
    description: 'MacroLync FX research and AlgoLync strategy monitoring with MT5 signal and telemetry integration.',
    start_url: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#080a0f',
    theme_color: '#10b981',
    categories: ['finance', 'business'],
    prefer_related_applications: false,
    related_applications: [],
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      }
    ],
    screenshots: [
      {
        src: '/screenshot-desktop.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide'
      },
      {
        src: '/screenshot-mobile.png',
        sizes: '720x1280',
        type: 'image/png',
        form_factor: 'narrow'
      }
    ],
    shortcuts: [{
      name: 'AlgoLync Vault',
      short_name: 'AlgoLync',
      description: 'Open the AlgoLync strategy store and live EA fleet monitor.',
      url: '/store',
      icons: [{ src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
    }],
  };
}
