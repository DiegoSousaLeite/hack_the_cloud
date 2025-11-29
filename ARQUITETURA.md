# Arquitetura do Copiloto Acadêmico

Este documento descreve a arquitetura implementada do Copiloto Acadêmico, seguindo rigorosamente o modelo stateless com estado gerenciado exclusivamente no frontend.

## Modelo de Dados

### Estado Local (Frontend - React useState)

O estado da aplicação é mantido **apenas localmente** no navegador:

```typescript
// Estado gerenciado no componente principal (app/page.tsx)
{
  userInfo: { name: string, age: number },  // Contexto do usuário
  messageList: Array<Message>,               // Histórico de conversação
  attachments: Array<Attachment>            // Arquivos anexados localmente
}
```

### Interfaces TypeScript

#### Attachment
```typescript
interface Attachment {
  fileName: string;
  fileObject: File;      // Objeto File local do navegador
  s3_path: string;       // URL/Path retornado após upload no S3
  uploadProgress?: number;
}
```

#### Message
```typescript
interface Message {
  id: string;                    // UUID gerado no frontend
  segment_index: number;         // Índice para ordenação
  fromAssistant: boolean;        // true = IA, false = Usuário
  content: string;               // Conteúdo da mensagem
  attachmentPaths: string[];     // S3 paths dos anexos
  timestamp: Date;
}
```

## Fluxos de Dados

### 1. Fluxo de Upload (S3 - Temporário)

**Processo em 2 etapas:**

```
┌─────────────┐      ┌─────────────────┐      ┌──────────┐
│   Browser   │─────>│ Lambda Helper   │─────>│   S3     │
│  (Next.js)  │ (1)  │ (Pre-signed URL)│ (2)  │ (Upload) │
└─────────────┘      └─────────────────┘      └──────────┘
```

**Etapa 1: Obter URL Pré-assinada**
```typescript
// Endpoint: /api/upload-url
// Service: lib/services/s3Service.ts > getPreSignedUploadUrl()

const { uploadUrl, s3_path } = await getPreSignedUploadUrl(file);
```

**Payload de Requisição:**
```json
{
  "fileName": "documento.pdf",
  "fileType": "application/pdf",
  "fileSize": 1024000
}
```

**Payload de Resposta:**
```json
{
  "success": true,
  "uploadUrl": "https://bucket.s3.amazonaws.com/uploads/...?signature=...",
  "s3Path": "s3://bucket/uploads/20250129-documento.pdf"
}
```

**Etapa 2: Upload Direto para S3**
```typescript
// Upload direto do navegador para S3
await uploadDirectToS3(uploadUrl, file);
```

**Atualização do Estado Local:**
```typescript
const attachment: Attachment = {
  fileName: file.name,
  fileObject: file,
  s3_path: s3_path,  // Armazenado para envio posterior
  uploadProgress: 100
};
```

### 2. Fluxo de Chat (Lambda -> Bedrock)

**Processo em etapas:**

```
┌─────────────┐      ┌──────────────┐      ┌─────────┐
│   Browser   │─────>│ Lambda Helper│─────>│ Bedrock │
│  (Next.js)  │      │ (chat-process│      │ (LLM)   │
└─────────────┘      └──────────────┘      └─────────┘
       │                     │
       │                     └──> OCR/Transcrição (S3)
       │                     └──> Compila RAG Context
       │                     └──> Consulta Bedrock
       │
       └──> Atualiza messageList local
```

**Função: sendMessage()**
```typescript
// Service: lib/services/chatService.ts

sendMessage(
  messageContent: string,
  s3_paths: string[],
  userInfo: UserInfo,
  segment_index: number
)
```

**Payload de Requisição:**
```json
{
  "query": "Explique este documento",
  "context": "Você é o Copiloto Acadêmico...",
  "userInfo": { "name": "", "age": 0 },
  "s3_paths": ["s3://bucket/uploads/doc.pdf"],
  "segment_index": 1
}
```

**Processamento no Lambda:**
1. Recebe o payload
2. Processa documentos do S3 (OCR/Transcrição se necessário)
3. Compila contexto RAG: `System Prompt + Transcrição do Documento`
4. Consulta AWS Bedrock Agent
5. Retorna resposta de texto

**Payload de Resposta:**
```json
{
  "success": true,
  "llm_response": "Este documento trata de..."
}
```

**Atualização do Estado:**
```typescript
// 1. Adiciona mensagem do usuário
setMessages(prev => [...prev, userMessage]);

// 2. Adiciona resposta do assistente
setMessages(prev => [...prev, assistantMessage]);

// 3. Limpa anexos após envio
onClearAttachments();
```

### 3. Fluxo de Text-to-Speech (AWS Polly)

**Processo:**

```
┌─────────────┐      ┌──────────────┐      ┌─────────┐
│   Browser   │─────>│ Lambda Helper│─────>│ Polly   │
│  (Next.js)  │      │ (TTS)        │      │ (Audio) │
└─────────────┘      └──────────────┘      └─────────┘
       │                     │                    │
       │                     │                    └──> Gera MP3
       │                     └──> Salva em S3 (temp)
       │                     └──> Retorna URL temporária
       │
       └──> Reproduz áudio (HTML5 Audio)
```

**Função: playTextToSpeech()**
```typescript
// Service: lib/services/ttsService.ts
// Endpoint: /api/text-to-speech

await playTextToSpeech(message.content);
```

**Payload de Requisição:**
```json
{
  "text": "Conteúdo da mensagem do assistente...",
  "voiceId": "Camila"
}
```

**Processamento no Lambda:**
1. Recebe o texto
2. Gera áudio com AWS Polly (voz Camila - pt-BR)
3. Salva MP3 no S3 com expiração de 1 hora
4. Retorna URL temporária

**Payload de Resposta:**
```json
{
  "success": true,
  "audioUrl": "https://bucket.s3.amazonaws.com/audio/123.mp3?expires=..."
}
```

**Reprodução:**
```typescript
// Usa HTML5 Audio element (não armazena arquivo)
const audio = new Audio(audioUrl);
await audio.play();
```

## Endpoints AWS Lambda

### 1. Lambda Helper S3
- **Endpoint:** `/upload-url`
- **Método:** POST
- **Função:** Gerar URLs pré-assinadas para upload
- **Expiração:** 1 hora
- **Código:** Veja `SETUP.md` seção "Lambda Helper S3"

### 2. Lambda Helper Chat
- **Endpoint:** `/chat-process`
- **Método:** POST
- **Função:** Processar documentos + Consultar Bedrock
- **Integrações:** S3, Textract/Rekognition, Bedrock
- **Código:** Veja `SETUP.md` seção "Lambda Helper Chat"

### 3. Lambda Helper TTS
- **Endpoint:** `/text-to-speech`
- **Método:** POST
- **Função:** Gerar áudio com AWS Polly
- **Integrações:** Polly, S3
- **Código:** Veja `SETUP.md` seção "Lambda Helper TTS"

## Variáveis de Ambiente

```env
# Endpoints AWS (obrigatórios)
NEXT_PUBLIC_S3_UPLOAD_API_ENDPOINT=https://api-id.execute-api.region.amazonaws.com/prod
NEXT_PUBLIC_CHAT_API_ENDPOINT=https://api-id.execute-api.region.amazonaws.com/prod
NEXT_PUBLIC_TTS_API_ENDPOINT=https://api-id.execute-api.region.amazonaws.com/prod

# System Prompt (opcional - sobrescreve o padrão)
NEXT_PUBLIC_SYSTEM_PROMPT="Você é o Copiloto Acadêmico..."
```

## Segurança e Privacidade

### Políticas Implementadas

1. **Stateless Backend**
   - Nenhum dado persistido em banco de dados
   - Estado existe apenas na memória do navegador
   - Sessão perde-se ao fechar o navegador

2. **S3 Temporário**
   - Arquivos expiram automaticamente em 24h
   - URLs pré-assinadas expiram em 1h
   - Política de lifecycle configurada no bucket

3. **Áudio Temporário**
   - Arquivos MP3 expiram em 1h
   - URLs de áudio são temporárias
   - Não são armazenados localmente

4. **CORS**
   - Configurado no S3 para aceitar uploads do frontend
   - Configurado no API Gateway para requisições CORS
   - Headers apropriados em todas as Lambda Functions

## Estrutura de Componentes

```
app/page.tsx (Estado Principal)
    │
    ├── MainLayout
    │   ├── Sidebar (FileUpload)
    │   │   └── Attachment List
    │   │
    │   └── Main (ChatContainer)
    │       ├── Message List
    │       │   └── ChatMessage (com TTS)
    │       └── Input Area
    │
    └── Estado Local:
        ├── pendingAttachments[]
        ├── messages[]
        └── userInfo{}
```

## Services (lib/services/)

### s3Service.ts
- `getPreSignedUploadUrl(file)` - Obtém URL pré-assinada
- `uploadDirectToS3(url, file)` - Upload direto para S3
- `uploadFileToS3(file)` - Função completa (combina as duas)

### chatService.ts
- `sendMessage(content, s3_paths, userInfo, index)` - Envia mensagem para chat

### ttsService.ts
- `playTextToSpeech(text)` - Reproduz texto como áudio

## Fluxo Completo de Uso

1. **Usuário anexa documento**
   ```
   Upload → Lambda S3 → Pre-signed URL → Upload Direto → s3_path armazenado
   ```

2. **Usuário envia mensagem**
   ```
   sendMessage → Lambda Chat → Processa S3 → Bedrock → Resposta
   ```

3. **Usuário clica "Ouvir"**
   ```
   playTTS → Lambda TTS → Polly → MP3 no S3 → Reproduz
   ```

4. **Limpeza automática**
   ```
   - Anexos limpos após envio da mensagem
   - S3 expira arquivos em 24h
   - Áudio expira em 1h
   ```

## Observações Importantes

- **Nenhuma persistência:** Todo estado é local e temporário
- **Privacidade:** Dados não são armazenados permanentemente
- **Escalabilidade:** Lambda escala automaticamente
- **Custo:** Pay-per-use (apenas quando usado)
- **Acessibilidade:** TTS para todas as respostas da IA

---

Para detalhes de implementação, consulte `SETUP.md` e `README.md`.
