import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MacroLync',
    short_name: 'MacroLync',
    description: 'Global foreign exchange macro intelligence and market positioning.',
    start_url: '/',
    id: '/?source=pwa',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#080a0f',
    theme_color: '#10B981',
    categories: ['finance', 'business', 'shopping'],
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
    shortcuts: [
      {
        name: "Create Safe Link",
        short_name: "Escrow",
        description: "Create a new secure escrow link",
        url: "/",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }]
      }
    ]
  }
}
