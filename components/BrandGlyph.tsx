export type BrandGlyphName =
  | 'activity'
  | 'arrow-down'
  | 'arrow-up-right'
  | 'calendar'
  | 'calendar-clock'
  | 'chart'
  | 'check'
  | 'chevron-down'
  | 'clock'
  | 'close'
  | 'copy'
  | 'external-link'
  | 'gauge'
  | 'mail'
  | 'menu'
  | 'radio'
  | 'refresh'
  | 'shield'
  | 'shield-alert'
  | 'signal'
  | 'trend';

type BrandGlyphProps = {
  name: BrandGlyphName;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export default function BrandGlyph({
  name,
  size = 18,
  strokeWidth = 1.8,
  className,
}: BrandGlyphProps) {
  let shape: React.ReactNode;
  switch (name) {
    case 'activity':
      shape = <path d="M3 12h4l2.2-6 4.1 12 2.2-6H21" />;
      break;
    case 'arrow-down':
      shape = <><path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M4 20h16" /></>;
      break;
    case 'arrow-up-right':
      shape = <><path d="M6 18 18 6" /><path d="M8 6h10v10" /></>;
      break;
    case 'calendar':
      shape = <><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 9.5h17M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" /></>;
      break;
    case 'calendar-clock':
      shape = <><rect x="3" y="4.5" width="15" height="16" rx="2" /><path d="M7 2.5v4M14 2.5v4M3 9h15M7 13h.01M7 17h.01" /><circle cx="17.5" cy="17.5" r="4" /><path d="M17.5 15.5v2l1.5 1" /></>;
      break;
    case 'chart':
      shape = <><path d="M3 20h18" /><path d="M6 17v-5M10 17V8M14 17v-3M18 17V5" /><path d="m5 9 4-4 4 2 6-5" /></>;
      break;
    case 'check':
      shape = <path d="m4 12.5 5 5L20 6" />;
      break;
    case 'chevron-down':
      shape = <path d="m6 9 6 6 6-6" />;
      break;
    case 'clock':
      shape = <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>;
      break;
    case 'close':
      shape = <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>;
      break;
    case 'copy':
      shape = <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>;
      break;
    case 'external-link':
      shape = <><path d="M13 5h6v6M19 5l-9 9" /><path d="M17 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5" /></>;
      break;
    case 'gauge':
      shape = <><path d="M4 17a8 8 0 1 1 16 0" /><path d="m12 13 4-4M7 17h.01M17 17h.01" /></>;
      break;
    case 'mail':
      shape = <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>;
      break;
    case 'menu':
      shape = <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>;
      break;
    case 'radio':
      shape = <><circle cx="12" cy="12" r="2" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" /></>;
      break;
    case 'refresh':
      shape = <><path d="M20 7v5h-5" /><path d="M19 12a7 7 0 0 0-12-4L4 11" /><path d="M4 17v-5h5" /><path d="M5 12a7 7 0 0 0 12 4l3-3" /></>;
      break;
    case 'shield':
      shape = <><path d="m12 2.5 8 3.4v5.5c0 5.1-3.2 8.6-8 10.1-4.8-1.5-8-5-8-10.1V5.9l8-3.4Z" /><path d="M8 14v-3M12 14V8M16 14v-5" /></>;
      break;
    case 'shield-alert':
      shape = <><path d="m12 2.5 8 3.4v5.5c0 5.1-3.2 8.6-8 10.1-4.8-1.5-8-5-8-10.1V5.9l8-3.4Z" /><path d="M12 7v5" /><path d="M12 16h.01" /></>;
      break;
    case 'signal':
      shape = <><path d="M3 18h2M7 15h2M11 12h2M15 9h2M19 6h2" /><path d="M3 21h18" /></>;
      break;
    case 'trend':
      shape = <><path d="M4 18 10 12l4 3 6-8" /><path d="M14 7h6v6" /></>;
      break;
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shape}
    </svg>
  );
}
