'use client';
import { MessageCircle } from 'lucide-react';
export default function WhatsAppFloat() {
  return (
    <a 
      href="https://wa.me/2348037212445" 
      target="_blank" 
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-green-500 text-white p-4 rounded-full shadow-2xl hover:bg-green-600 hover:scale-105 transition-all flex items-center justify-center cursor-pointer border border-green-400"
    >
      <MessageCircle size={28} />
    </a>
  );
}
