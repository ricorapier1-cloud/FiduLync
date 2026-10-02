import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
      name: 'FiduLync Escrow',
          short_name: 'FiduLync',
              description: 'Ultra-secure peer-to-peer payment and milestone escrow platform.',
                  start_url: '/',
                      display: 'standalone',
                          background_color: '#090d16',
                              theme_color: '#090d16',
                                  orientation: 'portrait',
                                      id: '/',
                                          categories: ['finance', 'shopping', 'utilities'],
                                              icons: [
                                                    {
                                                            src: '/icon-192.png',
                                                                    sizes: '192x192',
                                                                            type: 'image/png',
                                                                                    purpose: 'maskable'
                                                                                          },
                                                                                                {
                                                                                                        src: '/icon-512.png',
                                                                                                                sizes: '512x512',
                                                                                                                        type: 'image/png',
                                                                                                                                purpose: 'any'
                                                                                                                                      }
                                                                                                                                          ],
                                                                                                                                              screenshots: [
                                                                                                                                                    {
                                                                                                                                                            src: '/icon-512.png',
                                                                                                                                                                    sizes: '512x512',
                                                                                                                                                                            type: 'image/png',
                                                                                                                                                                                    form_factor: 'wide',
                                                                                                                                                                                            label: 'FiduLync Desktop View'
                                                                                                                                                                                                  },
                                                                                                                                                                                                        {
                                                                                                                                                                                                                src: '/icon-192.png',
                                                                                                                                                                                                                        sizes: '192x192',
                                                                                                                                                                                                                                type: 'image/png',
                                                                                                                                                                                                                                        form_factor: 'narrow',
                                                                                                                                                                                                                                                label: 'FiduLync Mobile View'
                                                                                                                                                                                                                                                      }
                                                                                                                                                                                                                                                          ],
                                                                                                                                                                                                                                                              shortcuts: [
                                                                                                                                                                                                                                                                    {
                                                                                                                                                                                                                                                                            name: 'Create Safe Link',
                                                                                                                                                                                                                                                                                    url: '/pay',
                                                                                                                                                                                                                                                                                            description: 'Generate a new protected payment link'
                                                                                                                                                                                                                                                                                                  }
                                                                                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                                                                        }