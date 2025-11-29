# Guia de Setup Rápido - Copiloto Acadêmico

Este guia ajudará você a configurar e executar o Copiloto Acadêmico localmente e na AWS.

## Passo 1: Configuração Local

### 1.1 Instale as dependências

```bash
npm install
```

### 1.2 Configure as variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Por enquanto, deixe os valores vazios. Você os preencherá após configurar a infraestrutura AWS.

### 1.3 Execute o projeto localmente (modo dev)

```bash
npm run dev
```

Acesse http://localhost:3000

**Nota**: Sem a infraestrutura AWS configurada, as funcionalidades de upload, chat e TTS não funcionarão ainda.

## Passo 2: Configuração da Infraestrutura AWS

### 2.1 Pré-requisitos AWS

- Conta AWS ativa
- AWS CLI instalado e configurado
- Permissões para criar: Lambda, S3, API Gateway, Bedrock, Polly

### 2.2 Crie um Bucket S3

```bash
aws s3 mb s3://copiloto-academico-uploads --region us-east-1
```

Configure a política de expiração (lifecycle rule) para 24 horas:

```json
{
  "Rules": [
    {
      "Id": "DeleteAfter24Hours",
      "Status": "Enabled",
      "Expiration": {
        "Days": 1
      },
      "Filter": {
        "Prefix": ""
      }
    }
  ]
}
```

Configure CORS no bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["http://localhost:3000", "https://seu-dominio.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### 2.3 Crie as Lambda Functions

#### Lambda 1: S3 Upload Helper

Crie arquivo `lambda-s3-upload/index.py`:

```python
import boto3
import json
import os
from datetime import datetime

s3_client = boto3.client('s3')
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'copiloto-academico-uploads')

def lambda_handler(event, context):
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
    }

    # Handle preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }

    try:
        body = json.loads(event['body'])
        file_name = body['fileName']
        file_type = body['fileType']

        # Generate unique key
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        key = f'uploads/{timestamp}-{file_name}'

        # Generate pre-signed URL
        url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': key,
                'ContentType': file_type
            },
            ExpiresIn=3600
        )

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'success': True,
                'uploadUrl': url,
                's3Path': f's3://{BUCKET_NAME}/{key}'
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
```

Deploy:

```bash
cd lambda-s3-upload
zip -r function.zip .
aws lambda create-function \
  --function-name copiloto-s3-upload \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler index.lambda_handler \
  --zip-file fileb://function.zip \
  --environment Variables="{BUCKET_NAME=copiloto-academico-uploads}"
```

#### Lambda 2: Chat Helper (Bedrock Integration)

Crie arquivo `lambda-chat/index.py`:

```python
import boto3
import json
import os

bedrock_client = boto3.client('bedrock-runtime', region_name='us-east-1')
s3_client = boto3.client('s3')

def lambda_handler(event, context):
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}

    try:
        body = json.loads(event['body'])
        system_prompt = body['systemPrompt']
        user_query = body['userQuery']
        s3_paths = body.get('s3Paths', [])

        # TODO: Process documents from S3 (OCR, text extraction)
        documents_context = ""

        # Call Bedrock
        response = bedrock_client.invoke_model(
            modelId='anthropic.claude-3-sonnet-20240229-v1:0',
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 2048,
                'system': system_prompt,
                'messages': [
                    {
                        'role': 'user',
                        'content': f'{user_query}\n\nContexto dos documentos: {documents_context}'
                    }
                ]
            })
        )

        result = json.loads(response['body'].read())
        llm_response = result['content'][0]['text']

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'success': True,
                'llm_response': llm_response
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
```

#### Lambda 3: TTS Helper (Polly Integration)

Crie arquivo `lambda-tts/index.py`:

```python
import boto3
import json
import os
from datetime import datetime

polly_client = boto3.client('polly')
s3_client = boto3.client('s3')
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'copiloto-academico-uploads')

def lambda_handler(event, context):
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}

    try:
        body = json.loads(event['body'])
        text = body['text']
        voice_id = body.get('voiceId', 'Camila')

        # Generate audio with Polly
        response = polly_client.synthesize_speech(
            Text=text,
            OutputFormat='mp3',
            VoiceId=voice_id,
            Engine='neural'
        )

        # Save to S3
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        audio_key = f'audio/{timestamp}.mp3'

        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=audio_key,
            Body=response['AudioStream'].read(),
            ContentType='audio/mpeg'
        )

        # Generate temporary URL
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET_NAME, 'Key': audio_key},
            ExpiresIn=3600
        )

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'success': True,
                'audioUrl': url
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }
```

### 2.4 Crie API Gateway

```bash
# Criar API REST
aws apigateway create-rest-api \
  --name copiloto-academico-api \
  --description "API para Copiloto Acadêmico"

# Anote o API_ID retornado

# Criar recursos e métodos para cada Lambda
# /get-upload-url -> POST -> Lambda S3 Upload
# /chat -> POST -> Lambda Chat
# /text-to-speech -> POST -> Lambda TTS
```

Configure CORS no API Gateway para cada método.

### 2.5 Atualize as Variáveis de Ambiente

Edite `.env.local`:

```env
NEXT_PUBLIC_S3_UPLOAD_API_ENDPOINT=https://seu-api-id.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_CHAT_API_ENDPOINT=https://seu-api-id.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_TTS_API_ENDPOINT=https://seu-api-id.execute-api.us-east-1.amazonaws.com/prod
```

## Passo 3: Deploy do Frontend com Amplify

### 3.1 Instale o Amplify CLI

```bash
npm install -g @aws-amplify/cli
amplify configure
```

### 3.2 Inicialize o Amplify

```bash
amplify init
```

### 3.3 Adicione Hosting

```bash
amplify add hosting
# Escolha: Hosting with Amplify Console
```

### 3.4 Publique

```bash
amplify publish
```

## Passo 4: Teste a Aplicação

1. Acesse a URL fornecida pelo Amplify
2. Teste o upload de um PDF
3. Envie uma mensagem
4. Teste o Text-to-Speech

## Troubleshooting

### Erro de CORS
- Verifique as configurações de CORS no S3 e API Gateway
- Certifique-se de que as Lambda Functions retornam os headers corretos

### Erro no Bedrock
- Verifique se você tem acesso ao modelo Claude no Bedrock
- Certifique-se de que a região está correta (us-east-1)

### Erro no Polly
- Verifique se a voz 'Camila' está disponível na sua região
- Teste com outras vozes em português: 'Ricardo' (masculino)

## Recursos Adicionais

- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [AWS Polly Voices](https://docs.aws.amazon.com/polly/latest/dg/voicelist.html)
- [Next.js Documentation](https://nextjs.org/docs)
- [AWS Amplify Documentation](https://docs.amplify.aws/)
