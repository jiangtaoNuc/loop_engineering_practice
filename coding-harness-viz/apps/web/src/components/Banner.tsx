interface Props {
  message: string;
  type: 'warning' | 'error' | 'info';
}

export function Banner({ message, type }: Props) {
  const bg = type === 'error' ? 'var(--accent-red)' : type === 'warning' ? '#F6A641' : 'var(--accent-cyan)';

  return (
    <div style={{
      padding: '8px 16px',
      background: bg,
      color: 'var(--bg-deep)',
      fontFamily: 'var(--font-heading)',
      fontSize: 9,
      textAlign: 'center',
      animation: 'bannerSlide 0.3s ease-out',
    }}>
      {message}
    </div>
  );
}
