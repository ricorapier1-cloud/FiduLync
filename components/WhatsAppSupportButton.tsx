'use client';

export default function WhatsAppSupportButton() {
  const whatsappNumber = '2348037212445';
  const defaultMessage = encodeURIComponent(
    'Hello FiduLync & AlgoLync Desk, I have an enquiry regarding your MT5 EAs, licensing, and Macro Terminal.'
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${defaultMessage}`;

  return (
    <aside aria-label="Support desk" className="fixed bottom-20 right-4 z-50 sm:bottom-6 sm:right-6">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2.5 rounded-full border border-emerald-400/40 bg-[#0c1016]/95 px-3.5 py-2.5 text-xs font-medium text-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-200 hover:border-emerald-400 hover:bg-[#111722] hover:shadow-[0_0_20px_rgba(52,211,153,0.3)] active:scale-95"
        aria-label="Chat with Desk on WhatsApp (+234 803 721 2445)"
      >
        <span className="relative flex h-3 w-3 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
        </span>

        {/* WhatsApp Icon */}
        <svg
          className="h-4 w-4 text-emerald-400 transition-transform duration-200 group-hover:scale-110"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12.031 2c-5.522 0-9.999 4.477-9.999 9.999 0 1.77.462 3.488 1.341 5.013l-1.424 5.204 5.334-1.399c1.472.802 3.125 1.226 4.748 1.226 5.522 0 10-4.477 10-10 0-5.521-4.478-9.999-10-9.999zm5.82 14.161c-.241.678-1.225 1.258-1.742 1.341-.482.078-1.077.112-3.23-.78-2.753-1.141-4.524-3.921-4.66-4.103-.138-.182-1.111-1.48-1.111-2.822 0-1.341.701-1.999.951-2.271.25-.272.545-.341.727-.341.182 0 .363.002.521.01.169.009.395-.064.618.472.227.545.772 1.884.84 2.022.068.138.114.298.022.479-.09.182-.136.295-.272.454-.136.159-.286.355-.408.476-.136.136-.278.284-.12.556.159.272.706 1.164 1.514 1.884 1.042.929 1.92 1.217 2.193 1.353.272.136.431.114.59-.068.159-.182.681-.795.863-1.068.182-.272.363-.227.613-.136.25.09 1.589.749 1.861.885.272.136.454.204.522.318.068.114.068.658-.173 1.336z" />
        </svg>

        <span className="font-mono text-[11px] font-semibold tracking-wide text-slate-200">
          WhatsApp Desk
        </span>
      </a>
    </aside>
  );
}
