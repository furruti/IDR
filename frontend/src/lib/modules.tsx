import React from 'react';

export interface AppModule {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  colorClass: string;
  enabled: boolean;
}

export const modules: AppModule[] = [
  {
    id: 'cctv',
    label: 'CCTV',
    href: '/cctv',
    colorClass: 'green',
    enabled: true,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-8 h-8"
      >
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
  },
  {
    id: 'materiales',
    label: 'Materiales',
    href: '/materiales',
    colorClass: 'blue',
    enabled: true,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-8 h-8"
      >
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14" />
        <polyline points="3.29 7 12 12 20.71 7" />
        <line x1="12" y1="22" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    id: 'racks',
    label: 'Racks',
    href: '/racks',
    colorClass: 'red',
    enabled: true,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-8 h-8"
      >
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
        <circle cx="17" cy="4.5" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="17" cy="9.5" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="17" cy="14.5" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'patcheras',
    label: 'Patcheras',
    href: '/patcheras',
    colorClass: 'orange',
    enabled: false, // Actualmente deshabilitado
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-8 h-8"
      >
        <path d="M12 22v-5" />
        <path d="M9 8V2" />
        <path d="M15 8V2" />
        <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
      </svg>
    ),
  },
  {
    id: 'licencias',
    label: 'Licencias',
    href: '/licencias',
    colorClass: 'purple',
    enabled: true,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-8 h-8"
      >
        <rect x="3" y="4" width="18" height="16" rx="3" ry="3" />
        <circle cx="9" cy="10" r="2" />
        <line x1="15" y1="8" x2="17" y2="8" />
        <line x1="15" y1="12" x2="17" y2="12" />
        <line x1="7" y1="16" x2="17" y2="16" />
      </svg>
    ),
  },
];
