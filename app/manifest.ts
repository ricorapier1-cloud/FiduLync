import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FiduLync',
    short_name: 'FiduLync',
    description: 'Safe Escrow Infrastructure for Zero Risk Social Commerce.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B1120',
    theme_color: '#10B981',
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
        // @ts-ignore
        form_factor: 'wide'
      },
      {
        src: '/screenshot-mobile.png',
        sizes: '720x1280',
        type: 'image/png',
        // @ts-ignore
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
