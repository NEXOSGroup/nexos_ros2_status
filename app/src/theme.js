import { createTheme } from '@mui/material/styles'

// NEXOS dark + gold primary (internal-app standard)
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#c8a34e' },
    secondary: { main: '#58a6ff' },
    success: { main: '#3fb950' },
    warning: { main: '#d29922' },
    error: { main: '#f85149' },
    info: { main: '#58a6ff' },
    background: { default: '#0e1116', paper: '#161b22' },
    divider: '#2a333d',
    text: { primary: '#e6edf3', secondary: '#8b98a5' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontSize: 13,
    fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
  },
  components: {
    MuiCard: { styleOverrides: { root: { border: '1px solid #2a333d' } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
})

export default theme
