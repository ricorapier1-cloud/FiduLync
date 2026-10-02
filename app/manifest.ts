import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FiduLync | SafeLync Escrow & AlgoLync',
    short_name: 'FiduLync',
    description: 'P2P Escrow Protection and AlgoLync Quant Suite',
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    orientation: 'portrait-primary',
    background_color: '#020617',
    theme_color: '#10b981',
    lang: 'en-US',
    dir: 'ltr',
    categories: ['finance', 'shopping', 'utilities'],
    prefer_related_applications: false,
    related_applications: [],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' }
    ],
    screenshots: [
      { src: '/screenshot-desktop.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'FiduLync Escrow Desktop Dashboard' },
      { src: '/screenshot-mobile.png', sizes: '750x1334', type: 'image/png', form_factor: 'narrow', label: 'FiduLync Mobile Safe Link Generator' }
    ],
    shortcuts: [
      { name: 'Create Safe Link', short_name: 'Safe Link', description: 'Generate a new P2P Escrow link', url: '/', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'AlgoLync Store', short_name: 'Store', description: 'Browse quantitative trading EAs', url: '/store', icons: [{ src: '/icon-192.png', sizes: '192x192' }] }
    ],
    protocol_handlers: [
      { protocol: 'web+fidulync', url: '/pay/%s' }
    ],
    share_target: {
      action: '/share',
      method: 'GET',
      enctype: 'application/x-www-form-urlencoded',
      params: { title: 'title', text: 'text', url: 'url' }
    },
    widgets: [
      { name: 'Safe Link Quick Create', description: 'Quickly create a Safe Link', tag: 'fidulync-quick-link', ms_ac_template: '/widgets/quick-link.json', data: '/widgets/quick-link-data.json', type: 'application/json' }
    ],
    edge_side_panel: {
      preferred_width: 400
    },
    file_handlers: [
      { action: '/import', accept: { 'application/json': ['.json'] } }
    ]
  } as any
}
