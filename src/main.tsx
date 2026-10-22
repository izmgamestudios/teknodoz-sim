import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './auth'
import { I18nProvider } from './i18n'
import { SelectionProvider } from './selection'
import { ThemeProvider } from './theme'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <SelectionProvider>
            <App />
          </SelectionProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
)
