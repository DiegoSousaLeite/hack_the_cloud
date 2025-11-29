'use client';

/**
 * Container Principal do Chat
 * Gerencia o fluxo de conversação e estado
 */

import React, { useState, useRef, useEffect } from 'react';
import { Message, Attachment } from '@/lib/types';
import { generateUUID } from '@/lib/utils/uuid';
import { sendMessage } from '@/lib/services/chatService';
import ChatMessage from './ChatMessage';

interface ChatContainerProps {
  pendingAttachments: Attachment[];
  onClearAttachments: () => void;
}

export default function ChatContainer({
  pendingAttachments,
  onClearAttachments
}: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const messageContent = inputValue.trim();
    const s3_paths = pendingAttachments.map(a => a.s3_path);

    // Criar mensagem do usuário
    const userMessage: Message = {
      id: generateUUID(),
      segment_index: messages.length + 1,
      fromAssistant: false,
      content: messageContent,
      attachmentPaths: s3_paths,
      timestamp: new Date()
    };

    // Adicionar mensagem do usuário ao estado
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Enviar para o backend (AWS Lambda/Bedrock)
      // Seguindo estrutura: sendMessage(messageContent, s3_paths, userInfo, segment_index)
      const llmResponse = await sendMessage(
        messageContent,
        s3_paths,
        { name: '', age: 0 }, // userInfo - contexto do usuário
        messages.length + 1 // segment_index para ordenar a transcrição
      );

      // Criar mensagem do assistente
      const assistantMessage: Message = {
        id: generateUUID(),
        segment_index: messages.length + 2,
        fromAssistant: true,
        content: llmResponse,
        attachmentPaths: [],
        timestamp: new Date()
      };

      // Adicionar resposta do assistente
      setMessages(prev => [...prev, assistantMessage]);

      // Limpar anexos após envio (limpeza de estado local e S3 paths)
      onClearAttachments();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);

      // Mensagem de erro
      const errorMessage: Message = {
        id: generateUUID(),
        segment_index: messages.length + 2,
        fromAssistant: true,
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
        attachmentPaths: [],
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--background)] p-4">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Copiloto Acadêmico
        </h1>
        <p className="text-sm text-[var(--secondary)] mt-1">
          Seu assistente inteligente para pesquisa e aprendizado
        </p>
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="max-w-md">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-[var(--secondary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
                Bem-vindo ao Copiloto Acadêmico
              </h2>
              <p className="text-[var(--secondary)]">
                Faça perguntas, anexe documentos ou peça ajuda com seus estudos.
                Estou aqui para apoiar seu aprendizado!
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-[var(--primary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-[var(--primary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-[var(--primary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de mensagem */}
      <div className="border-t border-[var(--border)] bg-[var(--background)] p-4">
        {/* Indicador de anexos pendentes */}
        {pendingAttachments.length > 0 && (
          <div className="mb-2 flex items-center text-sm text-[var(--secondary)]">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
            </svg>
            {pendingAttachments.length} arquivo{pendingAttachments.length > 1 ? 's' : ''} anexado{pendingAttachments.length > 1 ? 's' : ''}
          </div>
        )}

        <div className="flex space-x-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Digite sua mensagem... (Shift+Enter para nova linha)"
            className="flex-1 px-4 py-3 border border-[var(--border)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)] bg-[var(--background)] text-[var(--foreground)]"
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
