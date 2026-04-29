import { Outlet } from 'react-router-dom'
import { TopHeader } from './TopHeader'

export function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-bgBase">
      <TopHeader />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
