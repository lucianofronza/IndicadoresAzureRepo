import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env.docker file manually
  const envPath = path.resolve(__dirname, '../.env.docker')
  let envVars = {}
  
  try {
    const envContent = readFileSync(envPath, 'utf8')
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '')
        if (key.startsWith('VITE_')) {
          envVars[key] = value
        }
      }
    })
  } catch (error) {
    console.warn('Could not load .env.docker:', error.message)
  }
  
  return {
    plugins: [react()],
    define: {
      // Inject VITE_ variables into the app
      ...Object.keys(envVars).reduce((acc, key) => {
        acc[`import.meta.env.${key}`] = JSON.stringify(envVars[key])
        return acc
      }, {}),
    },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  }
})
