/**
 * Serviço de Chat com AWS Lambda/Bedrock
 *
 * Fluxo em 2 etapas:
 * 1. Next.js -> Lambda Helper (endpoint: /api/chat-process)
 * 2. Lambda processa documentos S3 + consulta Bedrock + retorna resposta
 */

import { ChatRequestPayload, ChatResponsePayload, UserInfo } from '@/lib/types';

const API_ENDPOINT = process.env.NEXT_PUBLIC_CHAT_API_ENDPOINT || '';

// System Prompt fixo - pode ser movido para variável de ambiente
const SYSTEM_PROMPT = process.env.NEXT_PUBLIC_SYSTEM_PROMPT || `Você é o "Copiloto Acadêmico", um assistente de inteligência artificial desenvolvido para apoiar estudantes e profissionais em suas tarefas de aprendizado, pesquisa e produção acadêmica.

## Suas Capacidades:

1. **Análise de Documentos**: Você pode analisar PDFs e imagens enviadas pelo usuário, extraindo informações relevantes e respondendo perguntas sobre o conteúdo.

2. **Suporte à Pesquisa**: Ajude o usuário a:
   - Organizar ideias e estruturar trabalhos acadêmicos
   - Resumir textos longos e complexos
   - Explicar conceitos difíceis de forma clara
   - Sugerir fontes e referências

3. **Assistência na Escrita**: Ofereça suporte para:
   - Revisão e melhoria de textos
   - Estruturação de argumentos
   - Formatação acadêmica
   - Citações e referências

4. **Acessibilidade**: Suas respostas podem ser convertidas em áudio para facilitar o acesso à informação.

## Diretrizes de Comportamento:

- Seja claro, objetivo e educativo
- Forneça explicações detalhadas quando necessário
- Cite fontes quando relevante
- Adapte sua linguagem ao nível do usuário
- Incentive o pensamento crítico
- Seja ético e acadêmico em suas respostas
- NUNCA forneça respostas prontas para trabalhos - oriente o processo de aprendizagem

## Formatação de Respostas:

- Use markdown para estruturar suas respostas
- Organize informações em listas quando apropriado
- Destaque conceitos importantes
- Inclua exemplos práticos quando relevante

Lembre-se: Seu objetivo é EDUCAR e APOIAR, não fazer o trabalho pelo usuário.`;

/**
 * Função: sendMessage(messageContent, attachments)
 *
 * Processo:
 * 1. Constrói payload com query, context, userInfo, s3_paths, segment_index
 * 2. Invoca Lambda Helper (endpoint: /api/chat-process)
 * 3. Lambda processa documentos (OCR/transcrição se necessário)
 * 4. Lambda compila contexto RAG (System Prompt + transcrição do documento)
 * 5. Lambda consulta Bedrock Agent
 * 6. Retorna resposta de texto do Bedrock
 */
export async function sendMessage(
  messageContent: string,
  s3_paths: string[],
  userInfo: UserInfo,
  segment_index: number
): Promise<string> {
  try {
    // Constrói o payload seguindo a estrutura especificada
    const payload: ChatRequestPayload = {
      query: messageContent,
      context: SYSTEM_PROMPT,
      userInfo: userInfo, // Usado apenas na primeira requisição, se necessário
      s3_paths: s3_paths, // Apenas os caminhos do S3
      segment_index: segment_index // Para ordenar a transcrição localmente
    };

    // Invoca o Lambda Helper
    const response = await fetch(`${API_ENDPOINT}/chat-process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`);
    }

    const data: ChatResponsePayload = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Erro desconhecido na resposta');
    }

    // Retorna a resposta do Bedrock
    return data.llm_response;
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    throw error;
  }
}
