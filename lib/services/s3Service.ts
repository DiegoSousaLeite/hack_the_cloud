/**
 * Serviço de Upload para S3
 * Utiliza Pre-signed URLs fornecidas pela Lambda Helper
 *
 * Fluxo em 2 etapas:
 * 1. Solicitar URL pré-assinada do Lambda Helper (endpoint: /api/upload-url)
 * 2. Upload direto do Next.js para S3 usando URL pré-assinada
 */

import { S3UploadRequestPayload, S3UploadResponsePayload } from '@/lib/types';
import { generateUUID } from '@/lib/utils/uuid';

const API_ENDPOINT = process.env.NEXT_PUBLIC_S3_UPLOAD_API_ENDPOINT || '';

/**
 * Etapa 1: Obtém uma URL pré-assinada para upload no S3
 * Lambda Helper garante política de expiração curta (1 hora)
 */
export async function getPreSignedUploadUrl(file: File): Promise<{ uploadUrl: string; s3_path: string }> {
  // Garantir que enviamos um userId conforme a interface exige.
  // Tentamos recuperar userInfo do localStorage (fluxo cliente). Se não houver, geramos e persistimos um userId.
  let userId = '';
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('copiloto_userInfo');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.userId) userId = parsed.userId;
        } catch {}
      }

      if (!userId) {
        userId = localStorage.getItem('copiloto_userId') || '';
      }

      if (!userId) {
        userId = generateUUID();
        localStorage.setItem('copiloto_userId', userId);
      }
    } else {
      // Ambiente server-side: gerar um id temporário (não persistido)
      userId = generateUUID();
    }
  } catch (e) {
    console.warn('Erro ao acessar localStorage para userId, gerando novo id', e);
    userId = generateUUID();
  }

  const payload: S3UploadRequestPayload = {
    userId,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size
  };

  const response = await fetch(`${API_ENDPOINT}/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Falha ao obter URL de upload');
  }

  const data: S3UploadResponsePayload = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Erro desconhecido ao obter URL');
  }

  return {
    uploadUrl: data.uploadUrl,
    s3_path: data.s3Path
  };
}

/**
 * Etapa 2: Upload direto para S3
 * O arquivo local (fileObject) é enviado diretamente do Next.js para o S3
 */
export async function uploadDirectToS3(uploadUrl: string, file: File): Promise<void> {
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file
  });

  if (!uploadResponse.ok) {
    throw new Error('Falha ao fazer upload para S3');
  }
}

/**
 * Função completa: Obtém URL pré-assinada + Upload
 * Retorna o s3_path para armazenar na lista de attachments
 */
export async function uploadFileToS3(file: File): Promise<string> {
  try {
    // Etapa 1: Obter URL pré-assinada
    const { uploadUrl, s3_path } = await getPreSignedUploadUrl(file);

    // Etapa 2: Upload direto para o S3
    await uploadDirectToS3(uploadUrl, file);

    // Etapa 3: Retornar o s3_path para armazenamento local
    return s3_path;
  } catch (error) {
    console.error('Erro no upload:', error);
    throw error;
  }
}
