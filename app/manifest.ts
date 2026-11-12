import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MacroLync Institutional Terminal',
    short_name: 'MacroLync',
    description: 'Quantitative FX and macro intelligence with MT5 signal and telemetry integration.',
    start_url: '/',
    id: '/?source=pwa',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#080a0f',
    theme_color: '#10B981',
    categories: ['finance', 'business'],
    prefer_related_applications: false,
    related_applications: [],
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
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
      description: 'Open the private algorithm vault and EA fleet monitor.',
      url: '/store',
      icons: [{ src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
    }]
  }
}
