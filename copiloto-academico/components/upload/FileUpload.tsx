'use client';

/**
 * Componente de Upload de Arquivos para S3
 * Utiliza Pre-signed URLs para upload direto
 */

import React, { useState } from 'react';
import { Attachment } from '@/lib/types';
import { uploadFileToS3 } from '@/lib/services/s3Service';

interface FileUploadProps {
  onFileUploaded: (attachment: Attachment) => void;
  pendingAttachments: Attachment[];
  onRemoveAttachment: (fileName: string) => void;
}

export default function FileUpload({
  onFileUploaded,
  pendingAttachments,
  onRemoveAttachment
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validação de tipo de arquivo
        const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
          setError(`Tipo de arquivo não suportado: ${file.name}`);
          continue;
        }

        // Validação de tamanho (máx 10MB)
        if (file.size > 10 * 1024 * 1024) {
          setError(`Arquivo muito grande: ${file.name} (máx 10MB)`);
          continue;
        }

        // Upload para S3 (retorna s3_path)
        const s3_path = await uploadFileToS3(file);

        const attachment: Attachment = {
          fileName: file.name,
          fileObject: file,
          s3_path: s3_path,
          uploadProgress: 100
        };

        onFileUploaded(attachment);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer upload');
    } finally {
      setUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Botão de Upload */}
      <div className="relative">
        <input
          type="file"
          id="file-upload"
          className="hidden"
          onChange={handleFileChange}
          multiple
          accept=".pdf,.png,.jpg,.jpeg"
          disabled={uploading}
        />
        <label
          htmlFor="file-upload"
          className={`
            flex items-center justify-center w-full px-4 py-3
            border-2 border-dashed rounded-lg cursor-pointer
            transition-colors duration-200
            ${uploading
              ? 'border-[var(--secondary)] bg-[var(--card-bg)] cursor-not-allowed'
              : 'border-[var(--primary)] bg-transparent hover:bg-[var(--card-bg)]'
            }
          `}
        >
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-[var(--secondary)]"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-2 text-sm text-[var(--foreground)]">
              {uploading ? 'Fazendo upload...' : 'Clique para adicionar arquivos'}
            </p>
            <p className="mt-1 text-xs text-[var(--secondary)]">
              PDF, PNG, JPG até 10MB
            </p>
          </div>
        </label>
      </div>

      {/* Mensagem de Erro */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Lista de Anexos */}
      {pendingAttachments.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[var(--foreground)]">
            Arquivos anexados ({pendingAttachments.length})
          </h3>
          <div className="space-y-2">
            {pendingAttachments.map((attachment) => (
              <div
                key={attachment.fileName}
                className="flex items-center justify-between p-3 bg-[var(--background)] border border-[var(--border)] rounded-lg"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {/* Ícone do arquivo */}
                  <div className="flex-shrink-0">
                    {attachment.fileObject.type.startsWith('image/') ? (
                      <svg className="h-5 w-5 text-[var(--primary)]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-[var(--primary)]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>

                  {/* Nome do arquivo */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">
                      {attachment.fileName}
                    </p>
                    <p className="text-xs text-[var(--secondary)]">
                      {(attachment.fileObject.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                {/* Botão de remover */}
                <button
                  onClick={() => onRemoveAttachment(attachment.fileName)}
                  className="flex-shrink-0 ml-2 p-1 hover:bg-[var(--card-bg)] rounded transition-colors"
                  aria-label="Remover arquivo"
                >
                  <svg className="h-5 w-5 text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
