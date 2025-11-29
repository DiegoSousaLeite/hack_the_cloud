'use client';

/**
 * Copiloto Acadêmico - Página Principal
 * Aplicação stateless com estado gerenciado no frontend
 */

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import ChatContainer from '@/components/chat/ChatContainer';
import FileUpload from '@/components/upload/FileUpload';
import { Attachment } from '@/lib/types';

export default function Home() {
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);

  const handleFileUploaded = (attachment: Attachment) => {
    setPendingAttachments(prev => [...prev, attachment]);
  };

  const handleRemoveAttachment = (fileName: string) => {
    setPendingAttachments(prev =>
      prev.filter(attachment => attachment.fileName !== fileName)
    );
  };

  const handleClearAttachments = () => {
    setPendingAttachments([]);
  };

  return (
    <MainLayout
      sidebar={
        <FileUpload
          onFileUploaded={handleFileUploaded}
          pendingAttachments={pendingAttachments}
          onRemoveAttachment={handleRemoveAttachment}
        />
      }
    >
      <ChatContainer
        pendingAttachments={pendingAttachments}
        onClearAttachments={handleClearAttachments}
      />
    </MainLayout>
  );
}
