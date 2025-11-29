/**
 * Tipos e Interfaces para o Copiloto Acadêmico
 * Gerenciamento de estado local (stateless backend)
 */

export interface UserInfo {
  userId: string; // UUID único gerado no primeiro acesso (armazenado no localStorage)
  name: string;
  age: number;
}

export interface Attachment {
  fileName: string;
  fileObject: File; // Objeto File local do navegador
  s3_path: string; // URL/Path retornado do upload para S3
  uploadProgress?: number; // 0-100
}

export interface Message {
  id: string; // UUID gerado no frontend
  segment_index: number;
  fromAssistant: boolean; // true para IA, false para Usuário
  content: string;
  attachmentPaths: string[]; // Lista de S3 paths de anexos usados naquela mensagem
  timestamp: Date;
}

export interface ChatState {
  userInfo: UserInfo;
  messageList: Message[];
  pendingAttachments: Attachment[];
  isLoading: boolean;
}

// Payload para Lambda/Bedrock (seguindo estrutura especificada)
export interface ChatRequestPayload {
  query: string; // messageContent
  context: string; // System Prompt fixo
  userInfo: UserInfo; // Usado apenas na primeira requisição
  s3_paths: string[]; // Caminhos do S3 dos anexos
  segment_index: number; // Para ordenar a transcrição
}

export interface ChatResponsePayload {
  llm_response: string;
  success: boolean;
  error?: string;
}

// Payload para Text-to-Speech
export interface TTSRequestPayload {
  text: string;
  voiceId?: string;
}

export interface TTSResponsePayload {
  audioUrl: string;
  success: boolean;
  error?: string;
}

// Payload para Pre-signed URL do S3
export interface S3UploadRequestPayload {
  userId: string; // UUID do usuário (para organizar arquivos no S3)
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface S3UploadResponsePayload {
  uploadUrl: string;
  s3Path: string;
  success: boolean;
  error?: string;
}
