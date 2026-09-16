import '@fontsource-variable/big-shoulders-display'
import '@fontsource-variable/hanken-grotesk'
// The width axis lets captions and data use a slightly condensed mono.
import '@fontsource-variable/martian-mono/wdth.css'
import './styles.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
