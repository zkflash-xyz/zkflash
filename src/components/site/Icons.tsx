/* Line icons drawn for this site. */
type P = { size?: number; className?: string };
const S = ({ size = 16, className, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    {children}
  </svg>
);
export const ArrowRight = (p: P) => <S {...p}><path d="M4 12h15M13 6l6 6-6 6" /></S>;
export const ArrowUpRight = (p: P) => <S {...p}><path d="M7 17 17 7M8 7h9v9" /></S>;
export const CheckIcon = (p: P) => <S {...p}><path d="m5 12 5 5L20 7" /></S>;
export const CloseIcon = (p: P) => <S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>;
export const CopyIcon = (p: P) => <S {...p}><rect x="9" y="9" width="11" height="11" /><path d="M5 15H4V4h11v1" /></S>;
export const LogOutIcon = (p: P) => <S {...p}><path d="M9 4H4v16h5M15 8l4 4-4 4M19 12H9" /></S>;
export const PlayIcon = (p: P) => <S {...p}><path d="M7 5v14l11-7z" /></S>;
export const PauseIcon = (p: P) => <S {...p}><path d="M8 5v14M16 5v14" /></S>;
export const RefreshIcon = (p: P) => <S {...p}><path d="M20 11a8 8 0 0 0-14-4l-2 2M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5" /></S>;
export const WalletIcon = (p: P) => <S {...p}><rect x="3" y="6" width="18" height="14" rx="1" /><path d="M16 13h2M3 10h18M6 6l1-2h11v2" /></S>;
export const MenuIcon = (p: P) => <S {...p}><path d="M4 7h16M4 12h16M4 17h16" /></S>;
export const StarIcon = (p: P) => <S {...p}><path d="m12 4 2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.5-.8z" /></S>;
export const XIcon = ({ size = 16, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M17.6 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5 21H1.9l7.3-8.4L1.5 3h6.4l4.4 5.9zm-1.1 16.2h1.7L7.1 4.7H5.3z" />
  </svg>
);
