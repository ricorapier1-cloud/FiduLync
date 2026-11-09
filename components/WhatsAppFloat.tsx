'use client';
import { MessageCircle } from 'lucide-react';
export default function WhatsAppFloat() {
  return (
    <a 
      href="https://wa.me/2348037212445" 
      target="_blank" 
      rel="noopener noreferrer"
      className="whatsapp-float fixed bottom-6 right-6 z-40 flex cursor-pointer items-center justify-center rounded-full border border-green-400 bg-green-500 p-4 text-white shadow-2xl transition-all hover:scale-105 hover:bg-green-600"
    >
      <MessageCircle size={28} />
    </a>
  );
}
