import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Densum Digital Lab',
    short_name: 'Densum',
    description: 'Densum Digital Lab Management System',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/app-logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/app-logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
