import React from 'react';
import { ModuleSidebar } from '@/components/ModuleSidebar';

export default function ModulesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="modules-layout-wrapper">
      <ModuleSidebar />
      <main className="modules-content-area">
        {children}
      </main>
    </div>
  );
}
