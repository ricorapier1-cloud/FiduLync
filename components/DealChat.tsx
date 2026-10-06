'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Send, ShieldCheck } from 'lucide-react';

export default function DealChat({ dealId, currentUserId }: { dealId: string; currentUserId: string }) {
  const supabase = createClientComponentClient();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    // Fetch initial chat history
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('deal_messages')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
    };

    fetchMessages();

    // Subscribe to real-time WebSockets feed
    const channel = supabase
      .channel(`deal_${dealId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deal_messages', filter: `deal_id=eq.${dealId}` }, 
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId, supabase]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const text = input;
    setInput('');

    await supabase.from('deal_messages').insert({
      deal_id: dealId,
      sender_id: currentUserId,
      message: text,
    });
  };

  return (
    <div className="bg-[#111820] border border-gray-800 rounded-2xl flex flex-col h-[480px]">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <ShieldCheck className="text-emerald-400" size={18} /> Encrypted Deal Room
        </h3>
        <span className="text-xs font-mono text-gray-400">ID: {dealId.substring(0, 8)}...</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-gray-500 text-sm mt-12 font-mono">No messages yet. Start negotiations securely.</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[80%] p-3 rounded-xl text-sm ${
                msg.sender_id === currentUserId
                  ? 'bg-emerald-600/20 border border-emerald-500/30 text-white ml-auto'
                  : 'bg-gray-800/60 border border-gray-700 text-gray-200 mr-auto'
              }`}
            >
              <p>{msg.message}</p>
              <span className="text-[10px] text-gray-400 block mt-1 font-mono">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={sendMessage} className="p-3 border-t border-gray-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a secure message..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm transition"
        >
          <Send size={16} /> Send
        </button>
      </form>
    </div>
  );
}
