import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
// Font tự host (CSP chỉ cho font-src 'self'). Mỗi file có unicode-range -> chỉ tải subset cần dùng.
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
