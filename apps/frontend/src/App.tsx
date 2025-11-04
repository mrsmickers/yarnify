import { Routes, Route } from 'react-router-dom'
import './App.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routes } from './config/routes'
import { ThemeProvider } from './theme/theme-provider'
import { AppShell } from './components/layout/AppShell'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppShell>
          <Routes>
            {routes.map((route) => (
              <Route key={route.path} {...route} />
            ))}
          </Routes>
        </AppShell>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
