import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, CssBaseline } from '@mui/material'
import theme from './theme'
import { RosProvider } from './ros'
import App from './App'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RosProvider>
        <App />
      </RosProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
