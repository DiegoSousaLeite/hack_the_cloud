/**
 * Layout Principal - Duas Colunas (estilo NotebookLM)
 * Coluna Esquerda: Upload e Anexos
 * Coluna Direita: Chat e Mensagens
 */

import React from 'react';

interface MainLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export default function MainLayout({ children, sidebar }: MainLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)]">
      {/* Coluna Esquerda - Anexos e Upload */}
      <aside className="w-80 border-r border-[var(--border)] bg-[var(--card-bg)] overflow-y-auto">
        <div className="p-4">
          <h2 className="text-xl font-semibold mb-4 text-[var(--foreground)]">
            Documentos
          </h2>
          {sidebar}
        </div>
      </aside>

      {/* Coluna Direita - Chat */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
