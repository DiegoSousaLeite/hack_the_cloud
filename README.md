# Copiloto Acadêmico

Um assistente inteligente desenvolvido com Next.js e AWS Serverless para apoiar estudantes em suas tarefas acadêmicas.

## Características

- Interface de duas colunas estilo NotebookLM
- Upload de documentos (PDF, PNG, JPG) para S3
- Chat com IA usando AWS Bedrock
- Text-to-Speech com AWS Polly para acessibilidade
- Aplicação stateless (estado mantido apenas no navegador)
- Design responsivo com tema claro/escuro

## Tecnologias

### Frontend
- Next.js 15+ com TypeScript
- Tailwind CSS para estilização
- React Hooks para gerenciamento de estado

### Backend (AWS Serverless)
- AWS Lambda para processamento
- AWS S3 para armazenamento temporário
- AWS Bedrock para IA/LLM
- AWS Polly para Text-to-Speech
- AWS API Gateway para endpoints REST

## Pré-requisitos

- Node.js 18+
- npm ou yarn
- Conta AWS ativa
- AWS Amplify CLI instalado
- AWS CLI configurado

## Instalação

### 1. Clone o repositório

```bash
cd copiloto-academico
npm install
```

### 2. Configure as variáveis de ambiente

Copie o arquivo de exemplo e configure seus endpoints AWS:

```bash
cp .env.local.example .env.local
```

Edite `.env.local` com seus endpoints reais:

```env
NEXT_PUBLIC_S3_UPLOAD_API_ENDPOINT=https://sua-api-gateway.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_CHAT_API_ENDPOINT=https://sua-api-gateway.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_TTS_API_ENDPOINT=https://sua-api-gateway.execute-api.us-east-1.amazonaws.com/prod
```

### 3. Execute localmente

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## Estrutura do Projeto

```
copiloto-academico/
├── app/                      # Next.js App Router
│   ├── globals.css          # Estilos globais
│   └── page.tsx             # Página principal
├── components/              # Componentes React
│   ├── chat/               # Componentes de chat
│   │   ├── ChatContainer.tsx
│   │   └── ChatMessage.tsx
│   ├── layout/             # Componentes de layout
│   │   └── MainLayout.tsx
│   └── upload/             # Componentes de upload
│       └── FileUpload.tsx
├── lib/                     # Lógica de negócio
│   ├── services/           # Serviços de API
│   │   ├── chatService.ts
│   │   ├── s3Service.ts
│   │   └── ttsService.ts
│   ├── types/              # Definições TypeScript
│   │   └── index.ts
│   └── utils/              # Utilitários
│       └── uuid.ts
└── .env.local.example      # Exemplo de variáveis de ambiente
```

## Deploy com AWS Amplify

### 1. Inicialize o Amplify

```bash
npm install -g @aws-amplify/cli
amplify init
```

### 2. Configure os recursos AWS

Você precisará criar:

#### Lambda Functions

1. **Lambda Helper S3**: Gera URLs pré-assinadas para upload
2. **Lambda Helper Chat**: Integração com AWS Bedrock
3. **Lambda Helper TTS**: Integração com AWS Polly

#### S3 Bucket

- Crie um bucket com política de expiração de 24h para arquivos temporários
- Configure CORS para aceitar uploads do frontend

#### API Gateway

- Crie endpoints REST para cada Lambda
- Configure CORS adequadamente

### 3. Deploy do frontend

```bash
amplify add hosting
amplify publish
```

## Fluxo de Funcionamento

### Upload de Arquivos

1. Usuário seleciona arquivo (PDF/Imagem)
2. Frontend solicita URL pré-assinada à Lambda Helper S3
3. Frontend faz upload direto para S3
4. S3 path é armazenado no estado local

### Chat com IA

1. Usuário envia mensagem com/sem anexos
2. Frontend envia query + S3 paths para Lambda Helper Chat
3. Lambda processa documentos (OCR se necessário)
4. Lambda consulta AWS Bedrock com contexto
5. Resposta é retornada e exibida

### Text-to-Speech

1. Usuário clica em "Ouvir Resposta"
2. Frontend envia texto para Lambda Helper TTS
3. Lambda gera áudio com AWS Polly
4. Lambda retorna URL temporária do áudio
5. Frontend reproduz o áudio

## Arquitetura AWS Lambda (Backend)

Você precisará implementar as seguintes Lambdas:

### 1. Lambda Helper S3 (`/get-upload-url`)

```python
import boto3
import json
from datetime import timedelta

s3_client = boto3.client('s3')
BUCKET_NAME = 'your-bucket-name'

def lambda_handler(event, context):
    body = json.loads(event['body'])
    file_name = body['fileName']
    file_type = body['fileType']

    # Gerar URL pré-assinada
    url = s3_client.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': BUCKET_NAME,
            'Key': f'uploads/{file_name}',
            'ContentType': file_type
        },
        ExpiresIn=3600
    )

    return {
        'statusCode': 200,
        'body': json.dumps({
            'success': True,
            'uploadUrl': url,
            's3Path': f's3://{BUCKET_NAME}/uploads/{file_name}'
        })
    }
```

### 2. Lambda Helper Chat (`/chat`)

```python
import boto3
import json

bedrock_client = boto3.client('bedrock-runtime')
s3_client = boto3.client('s3')

def lambda_handler(event, context):
    body = json.loads(event['body'])
    system_prompt = body['systemPrompt']
    user_query = body['userQuery']
    s3_paths = body['s3Paths']

    # Processar documentos do S3 (OCR, etc.)
    documents_context = process_documents(s3_paths)

    # Consultar Bedrock
    response = bedrock_client.invoke_model(
        modelId='anthropic.claude-v2',
        body=json.dumps({
            'prompt': f"{system_prompt}\n\nDocumentos: {documents_context}\n\nUsuário: {user_query}",
            'max_tokens': 2048
        })
    )

    result = json.loads(response['body'].read())

    return {
        'statusCode': 200,
        'body': json.dumps({
            'success': True,
            'llm_response': result['completion']
        })
    }
```

### 3. Lambda Helper TTS (`/text-to-speech`)

```python
import boto3
import json
from datetime import datetime

polly_client = boto3.client('polly')
s3_client = boto3.client('s3')
BUCKET_NAME = 'your-bucket-name'

def lambda_handler(event, context):
    body = json.loads(event['body'])
    text = body['text']
    voice_id = body.get('voiceId', 'Camila')

    # Gerar áudio com Polly
    response = polly_client.synthesize_speech(
        Text=text,
        OutputFormat='mp3',
        VoiceId=voice_id
    )

    # Salvar no S3
    audio_key = f'audio/{datetime.now().timestamp()}.mp3'
    s3_client.put_object(
        Bucket=BUCKET_NAME,
        Key=audio_key,
        Body=response['AudioStream'].read()
    )

    # Gerar URL temporária
    url = s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': BUCKET_NAME, 'Key': audio_key},
        ExpiresIn=3600
    )

    return {
        'statusCode': 200,
        'body': json.dumps({
            'success': True,
            'audioUrl': url
        })
    }
```

## Segurança e Privacidade

- Arquivos no S3 expiram automaticamente em 24h
- Nenhum dado é persistido em banco de dados
- URLs pré-assinadas têm tempo de expiração curto
- Estado da conversa existe apenas no navegador

## Acessibilidade

- Foco visível em todos os elementos interativos
- Suporte a leitores de tela
- Text-to-Speech para respostas da IA
- Alto contraste de cores
- Navegação por teclado

## Licença

MIT

## Suporte

Para dúvidas e problemas, abra uma issue no repositório.
