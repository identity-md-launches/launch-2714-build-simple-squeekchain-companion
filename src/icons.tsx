export type IconName = 'arrow' | 'refresh' | 'block' | 'round' | 'work' | 'clock' | 'book' | 'check' | 'copy' | 'pause' | 'play' | 'chevron' | 'leaf' | 'info' | 'external';

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
    external: <><path d="M14 4h6v6m0-6L10 14M10 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-5" /></>,
    refresh: <><path d="M20 10a8 8 0 0 0-14-5L3 8m0-5v5h5M4 14a8 8 0 0 0 14 5l3-3m0 5v-5h-5" /></>,
    block: <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9" /></>,
    round: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2M4 3v4h4" /></>,
    work: <><path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    book: <><path d="M12 5C9 3 5 3 2 5v15c3-2 7-2 10 0 3-2 7-2 10 0V5c-3-2-7-2-10 0Zm0 0v15" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M15 8V3H3v13h5" /></>,
    pause: <><path d="M9 5v14M15 5v14" /></>,
    play: <path d="m7 4 13 8-13 8V4Z" />,
    chevron: <path d="m8 5 7 7-7 7" />,
    leaf: <><path d="M19 4C3 2 2 15 9 17s13-3 10-13ZM5 21 15 10" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.2" /></>,
  };
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
