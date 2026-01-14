import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      '@browserbasehq/stagehand',
      'playwright',
      'playwright-core',
      '@langchain/langgraph',
      'fluent-ffmpeg',
    ],
  },
  webpack: (config, { isServer, nextRuntime }) => {
    // Node.js server only: externalize heavy/native deps. Do NOT externalize for Edge (middleware).
    if (isServer && nextRuntime === 'nodejs') {
      config.externals = [
        ...(config.externals || []),
        'playwright',
        'playwright-core',
        ({ request }, callback) => {
          if (request && request.startsWith('@opentelemetry/')) {
            return callback(null, `commonjs ${request}`)
          }
          callback()
        },
      ]
    }

    // Edge runtime (middleware): bundle our stub instead of requiring @opentelemetry/api (not available in Edge).
    // Apply stub whenever we're not building the Node server (dev can run middleware build with nextRuntime undefined).
    if (isServer && nextRuntime !== 'nodejs') {
      config.resolve = config.resolve || {}
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@opentelemetry/api': path.join(__dirname, 'src/lib/opentelemetry-stub.js'),
        '@opentelemetry/api$': path.join(__dirname, 'src/lib/opentelemetry-stub.js'),
      }
    }

    return config
  },
}

export default nextConfig
