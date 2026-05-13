import { Sidebar } from '@/components/Sidebar'
import { MobileNav } from '@/components/MobileNav'
import { MobileHeader } from '@/components/MobileHeader'

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-start bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <MobileHeader />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <MobileNav />
      </div>
    </div>
  )
}
