import { defineConfig, createServer, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import {
  FAQ,
  FEATURES,
  LONG_DESCRIPTION,
  OG_IMAGE_ALT,
  SEO_DESCRIPTION,
  SEO_TITLE,
  SITE_NAME,
} from './src/seo/content'

// Caminho base do site (ex.: '/capivara-chess/' no GitHub Pages)
const base = withSlash(process.env.BASE_PATH ?? '/')

/**
 * URL pública completa do app (ex.: 'https://exemplo.com/capivara-chess/'). Opcional: sem ela,
 * canonical, og:url e sitemap.xml são omitidos e a imagem do Open Graph usa caminho relativo.
 */
const siteUrl = resolveSiteUrl(process.env.SITE_URL, base)

function withSlash(path: string) {
  return path.endsWith('/') ? path : `${path}/`
}

function resolveSiteUrl(raw: string | undefined, basePath: string): string | undefined {
  if (!raw?.trim()) return undefined
  const url = new URL(raw.trim())
  // Só a origem foi informada: completa com o caminho base
  if (url.pathname === '/' && basePath !== '/') url.pathname = basePath
  url.pathname = withSlash(url.pathname)
  url.search = ''
  url.hash = ''
  return url.href
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Metadados de SEO no index.html, pré-render da página inicial, robots.txt e sitemap.xml. */
function seo(): Plugin {
  let isBuild = false
  let root = process.cwd()
  const ogImage = siteUrl ? new URL('og-image.png', siteUrl).href : `${base}og-image.png`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: SITE_NAME,
        alternateName: 'Capivara',
        ...(siteUrl && { url: siteUrl }),
        description: LONG_DESCRIPTION,
        image: ogImage,
        applicationCategory: 'GameApplication',
        applicationSubCategory: 'Análise de partidas de xadrez',
        operatingSystem: 'Web',
        browserRequirements: 'Requer um navegador moderno com JavaScript e WebAssembly',
        inLanguage: 'pt-BR',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
        featureList: FEATURES,
      },
      {
        '@type': 'FAQPage',
        inLanguage: 'pt-BR',
        mainEntity: FAQ.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  }

  return {
    name: 'capivara-seo',
    configResolved(config) {
      isBuild = config.command === 'build'
      root = config.root
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        const urlTags = siteUrl
          ? `<link rel="canonical" href="${escapeHtml(siteUrl)}" />\n    <meta property="og:url" content="${escapeHtml(siteUrl)}" />`
          : ''
        const json = JSON.stringify(jsonLd).replace(/</g, '\\u003c')
        html = html
          .replaceAll('%SEO_TITLE%', escapeHtml(SEO_TITLE))
          .replaceAll('%SEO_DESCRIPTION%', escapeHtml(SEO_DESCRIPTION))
          .replaceAll('%SITE_NAME%', escapeHtml(SITE_NAME))
          .replaceAll('%OG_IMAGE%', escapeHtml(ogImage))
          .replaceAll('%OG_IMAGE_ALT%', escapeHtml(OG_IMAGE_ALT))
          .replace('<!--seo:url-->', urlTags)
          .replace('<!--seo:jsonld-->', `<script type="application/ld+json">${json}</script>`)

        if (!isBuild) return html

        // Pré-render: injeta no #root o HTML da página inicial, para buscadores e para quem está sem JS.
        // O cliente usa createRoot, que substitui esse HTML pela mesma marcação.
        const server = await createServer({
          configFile: false,
          root,
          base,
          logLevel: 'error',
          appType: 'custom',
          plugins: [react()],
          server: { middlewareMode: true, hmr: false, ws: false },
          optimizeDeps: { noDiscovery: true, include: [] },
        })
        try {
          const { render } = (await server.ssrLoadModule('/src/prerender.tsx')) as { render: () => string }
          const markup = render()
          if (!html.includes('<div id="root"></div>')) throw new Error('index.html sem <div id="root"></div>')
          return html.replace('<div id="root"></div>', `<div id="root">${markup}</div>`)
        } finally {
          await server.close()
        }
      },
    },
    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /']
      if (siteUrl) robots.push('', `Sitemap: ${new URL('sitemap.xml', siteUrl).href}`)
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${robots.join('\n')}\n` })

      if (siteUrl) {
        const lastmod = new Date().toISOString().slice(0, 10)
        const sitemap = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          '  <url>',
          `    <loc>${escapeHtml(siteUrl)}</loc>`,
          `    <lastmod>${lastmod}</lastmod>`,
          '  </url>',
          '</urlset>',
          '',
        ].join('\n')
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
      }
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    seo(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: './',
        name: `${SITE_NAME} — análise de partidas de xadrez`,
        short_name: SITE_NAME,
        description: LONG_DESCRIPTION,
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#1C2026',
        theme_color: '#1C2026',
        categories: ['games', 'education', 'utilities'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Abre arquivos .pgn direto no app instalado (Chrome/Edge)
        file_handlers: [{ action: './', accept: { 'application/x-chess-pgn': ['.pgn'] } }],
        launch_handler: { client_mode: 'focus-existing' },
      },
      workbox: {
        // Inclui o Stockfish (wasm) e o livro de aberturas para funcionar offline.
        // A og-image.png só serve para prévias de link: fica fora do precache. O SDK do Firebase
        // também: só quem entra com Google o baixa, e aí ele fica no cache de runtime abaixo.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,wasm,pgn}'],
        globIgnores: ['**/og-image.png', '**/assets/firebase-*.js'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/firebase-[\w-]+\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'firebase-sdk', expiration: { maxEntries: 4 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  // Expõe na rede local (acesso de celular/outros PCs)
  server: { host: true, port: 5173 },
})
