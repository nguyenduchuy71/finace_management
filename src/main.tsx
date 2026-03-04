import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'

async function enableMocking() {
  // Use import.meta.env.DEV (Vite) NOT process.env.NODE_ENV
  // Also check VITE_ENABLE_MSW — set to 'false' in vercel.json to disable in production
  const mswEnabled = import.meta.env.VITE_ENABLE_MSW !== 'false'
  if (!import.meta.env.DEV || !mswEnabled) return
  const { worker } = await import('./mocks/browser')
  // Return the Promise so enableMocking().then() waits for registration
  return worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
