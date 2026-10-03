import EscrowGenerator from './components/EscrowGenerator'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0B1120] text-gray-300">
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto">
        <div className="text-2xl font-black text-white tracking-tighter">
          Fidu<span className="text-emerald-500">Lync</span>
        </div>
        <div className="space-x-6 text-sm font-bold">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition">Dashboard</Link>
          <Link href="/faq" className="text-gray-400 hover:text-white transition">FAQ</Link>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto p-4 sm:p-8 pt-10">
        <EscrowGenerator />
      </div>
    </main>
  )
}
