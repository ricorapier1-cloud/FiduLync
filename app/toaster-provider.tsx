'use client'
import { Toaster } from 'react-hot-toast'

export default function ToasterProvider() {
  return <Toaster position="top-center" toastOptions={{ 
    style: { background: '#111827', color: '#fff', border: '1px solid #1F2937' },
    success: { iconTheme: { primary: '#10B981', secondary: '#111827' } },
    error: { iconTheme: { primary: '#EF4444', secondary: '#111827' } }
  }} />
}
