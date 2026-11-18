'use client';

export function WhatsAppSupportButton() {
  const defaultMessage = encodeURIComponent(
    'Hello, I need help with my FiduLync Personal Quant workspace and MT5 research bridge.'
  );

  return (
    <a
      href={`https://wa.me/2348037212445?text=${defaultMessage}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contact FiduLync support on WhatsApp"
      title="Chat with FiduLync support (+2348037212445)"
      className="fixed bottom-20 sm:bottom-6 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/40 bg-[#061611]/95 text-emerald-400 shadow-xl shadow-black/80 backdrop-blur-md transition-all duration-200 hover:scale-110 hover:border-emerald-400 hover:bg-emerald-500 hover:text-black focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
    >
      <span className="absolute -top-1 -right-1 flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
      </span>
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
        <path d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.5 0 .16 5.34.16 11.91c0 2.1.55 4.15 1.6 5.95L0 24l6.33-1.66a11.87 11.87 0 0 0 5.74 1.46h.01c6.57 0 11.91-5.34 11.91-11.91 0-3.18-1.24-6.17-3.47-8.41ZM12.08 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.76.99 1-3.66-.24-.38a9.86 9.86 0 0 1-1.51-5.25c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.13 1.03 7 2.9a9.83 9.83 0 0 1 2.89 7c0 5.45-4.44 9.88-9.88 9.88Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
      </svg>
    </a>
  );
}

export default WhatsAppSupportButton;
