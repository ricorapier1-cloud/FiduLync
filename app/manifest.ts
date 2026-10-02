import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'veriPay | SafeLync Escrow & AlgoLync',
    short_name: 'veriPay',
    description: 'P2P Escrow Protection and AlgoLync Quant Suite',
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#020617',
    theme_color: '#10b981',
    categories: ['finance', 'shopping', 'utilities'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-1024.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [
      {
        src: '/screenshot-desktop.png',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
        label: 'veriPay Escrow Desktop Dashboard',
      },
      {
        src: '/screenshot-mobile.png',
        sizes: '750x1334',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'veriPay Mobile Safe Link Generator',
      },
    ],
    shortcuts: [
      {
        name: 'Create Safe Link',
        short_name: 'Safe Link',
        description: 'Generate a new P2P Escrow link',
        url: '/',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'AlgoLync Store',
        short_name: 'Store',
        description: 'Browse quantitative trading EAs',
        url: '/store',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
    ],
  }
}
