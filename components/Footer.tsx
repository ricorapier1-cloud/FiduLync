import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-[#0B1120] border-t border-gray-900 py-8 text-center text-xs text-gray-500">
      <div className="flex justify-center space-x-6 mb-4">
        <Link href="/faq" className="hover:text-emerald-400 transition">FAQ / How It Works</Link>
        <Link href="/legal/terms" className="hover:text-emerald-400 transition">Terms & Liability</Link>
      </div>
      <p>© 2026 FiduLync. All rights reserved. Secure Escrow Infrastructure.</p>
    </footer>
  )
}
