import { useState } from 'react';

interface NavItem {
  key: string;
  label: string;
  disabled: boolean;
}

const MENU_ITEMS: NavItem[] = [
  { key: 'monitor', label: '任务运行监控', disabled: false },
  { key: 'analytics', label: '数据分析', disabled: true },
  { key: 'settings', label: '系统设置', disabled: true },
];

export function NavMenu() {
  const [active, setActive] = useState('monitor');

  return (
    <nav style={{
      width: 200,
      minWidth: 200,
      background: 'var(--bg-deep)',
      borderRight: '4px solid var(--ink-muted)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      <div style={{
        padding: '16px 16px 20px',
        fontFamily: 'var(--font-heading)',
        fontSize: 8,
        color: 'var(--accent-cyan)',
        letterSpacing: 1,
        borderBottom: '4px solid var(--ink-muted)',
        lineHeight: 1.8,
      }}>
        <span style={{ fontSize: 14 }}>▓▓▓</span>
        <br />
        CODING HARNESS
      </div>

      <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {MENU_ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <button
              key={item.key}
              disabled={item.disabled}
              onClick={() => !item.disabled && setActive(item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px',
                fontFamily: 'var(--font-body)',
                fontSize: 18,
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                color: item.disabled
                  ? 'var(--ink-muted)'
                  : isActive
                  ? 'var(--bg-deep)'
                  : 'var(--text-bone)',
                background: isActive ? 'var(--accent-cyan)' : 'transparent',
                border: 'none',
                borderLeft: isActive
                  ? '4px solid var(--accent-lime)'
                  : '4px solid transparent',
                opacity: item.disabled ? 0.4 : 1,
                textAlign: 'left',
                width: '100%',
                transition: 'none',
                imageRendering: 'pixelated',
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>
                {item.disabled ? '▸' : '■'}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
