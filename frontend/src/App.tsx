import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from '@/components/layout/MainLayout'
import ContasAPagar from '@/pages/ContasAPagar'
import Receitas from '@/pages/Receitas'
import FluxoCaixa from '@/pages/FluxoCaixa'
import Configuracoes from '@/pages/Configuracoes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/ap" replace />} />
            <Route path="ap" element={<ContasAPagar />} />
            <Route path="receitas" element={<Receitas />} />
            <Route path="fluxo" element={<FluxoCaixa />} />
            <Route path="config" element={<Configuracoes />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
