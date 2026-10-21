import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Gera os ícones PNG do PWA a partir do logo: `npm run icons`
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0.25, resizeOptions: { background: '#2D333D' } },
    apple: { ...minimal2023Preset.apple, padding: 0.15, resizeOptions: { background: '#2D333D' } },
  },
  images: ['public/favicon.svg'],
})
