'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { modules } from '@/lib/modules';

export function ModuleSidebar() {
  const pathname = usePathname();
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    // Sincronización inicial del tema
    const darkActive = typeof window !== 'undefined' && localStorage.getItem('IDR_dark') === 'true';
    setIsDark(darkActive);
    if (darkActive) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }

    // Sincronización ante cambios de Storage (disparado desde el iframe en otra pestaña)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'IDR_dark') {
        const dark = e.newValue === 'true';
        setIsDark(dark);
        if (dark) {
          document.documentElement.classList.add('dark-mode');
        } else {
          document.documentElement.classList.remove('dark-mode');
        }
      }
    };

    // Sincronización ante evento CustomEvent (disparado localmente por los iframes en el mismo origen)
    const handleThemeEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ isDark: boolean }>;
      const dark = customEvent.detail?.isDark;
      setIsDark(dark);
      if (dark) {
        document.documentElement.classList.add('dark-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('idr-theme-change', handleThemeEvent);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('idr-theme-change', handleThemeEvent);
    };
  }, []);

  // Filtramos el módulo actual. Para evitar problemas con subrutas,
  // comparamos si el pathname actual comienza con el href del módulo.
  const visibleModules = modules.filter((m) => {
    return !pathname.startsWith(m.href);
  });

  return (
    <aside className="module-sidebar">
      <div className="sidebar-inner">
        <a
          href="/"
          className="sidebar-brand-mini"
          aria-label="Ir al inicio"
          title="Inicio"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-8 h-8"
            style={{ overflow: 'visible' }}
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
        </a>

        <div className="sidebar-divider" />

        <nav className="sidebar-nav">
          {visibleModules.map((m) => {
            const isEnabled = m.enabled;
            const itemContent = (
              <>
                <div className={`sidebar-icon-wrapper color-${m.colorClass}`}>
                  {m.icon}
                </div>
                <span className="sidebar-label">{m.label}</span>
              </>
            );

            if (!isEnabled) {
              return (
                <div
                  key={m.id}
                  className={`sidebar-item sidebar-item-disabled sidebar-item-${m.colorClass}`}
                  title={`${m.label} (Deshabilitado)`}
                >
                  {itemContent}
                </div>
              );
            }

            return (
              <a
                key={m.id}
                href={m.href}
                className={`sidebar-item sidebar-item-${m.colorClass}`}
                title={`Ir a ${m.label}`}
              >
                {itemContent}
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
