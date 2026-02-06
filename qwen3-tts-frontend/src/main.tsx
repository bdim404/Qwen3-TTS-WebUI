import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './locales'
import './index.css'
import App from './App.tsx'
import { preloadBaseFont } from './lib/fontManager'

preloadBaseFont()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
