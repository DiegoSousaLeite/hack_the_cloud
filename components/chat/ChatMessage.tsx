'use client';

/**
 * Componente de Mensagem do Chat
 * Exibe mensagens do usuário e do assistente
 */

import React, { useState } from 'react';
import { Message } from '@/lib/types';
import { playTextToSpeech } from '@/lib/services/ttsService';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const handlePlayAudio = async () => {
    if (!message.fromAssistant) return;

    setIsPlayingAudio(true);
    setAudioError(null);

    try {
      await playTextToSpeech(message.content);
    } catch (error) {
      setAudioError('Erro ao reproduzir áudio');
      console.error('Erro TTS:', error);
    } finally {
      setIsPlayingAudio(false);
    }
  };

  return (
    <div
      className={`flex w-full ${message.fromAssistant ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`
          max-w-[80%] rounded-lg p-4 shadow-sm
          ${message.fromAssistant
            ? 'bg-[var(--card-bg)] border border-[var(--border)]'
            : 'bg-[var(--primary)] text-white'
          }
        `}
      >
        {/* Cabeçalho da mensagem */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div
              className={`
                w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${message.fromAssistant
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-white text-[var(--primary)]'
                }
              `}
            >
              {message.fromAssistant ? 'AI' : 'U'}
            </div>
            <span
              className={`text-xs font-medium ${
                message.fromAssistant ? 'text-[var(--secondary)]' : 'text-white/80'
              }`}
            >
              {message.fromAssistant ? 'Copiloto Acadêmico' : 'Você'}
            </span>
          </div>

          {/* Botão de Text-to-Speech (somente para mensagens do assistente) */}
          {message.fromAssistant && (
            <button
              onClick={handlePlayAudio}
              disabled={isPlayingAudio}
              className="p-1 hover:bg-[var(--background)] rounded transition-colors disabled:opacity-50"
              aria-label="Ouvir resposta"
              title="Ouvir resposta"
            >
              {isPlayingAudio ? (
                <svg className="w-5 h-5 text-[var(--primary)] animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-[var(--primary)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Conteúdo da mensagem com suporte a Markdown */}
        <div
          className={`prose prose-sm max-w-none ${
            message.fromAssistant
              ? 'prose-slate dark:prose-invert'
              : 'prose-invert'
          }`}
        >
          <MessageContent content={message.content} />
        </div>

        {/* Anexos (se houver) */}
        {message.attachmentPaths.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--secondary)] mb-1">Documentos anexados:</p>
            <div className="flex flex-wrap gap-1">
              {message.attachmentPaths.map((path, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-1 bg-[var(--background)] rounded border border-[var(--border)]"
                >
                  Documento {idx + 1}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Erro de áudio */}
        {audioError && (
          <div className="mt-2 text-xs text-[var(--error)]">
            {audioError}
          </div>
        )}

        {/* Timestamp */}
        <div className={`mt-2 text-xs ${
          message.fromAssistant ? 'text-[var(--secondary)]' : 'text-white/60'
        }`}>
          {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
}

// Componente auxiliar para renderizar conteúdo com formatação básica
function MessageContent({ content }: { content: string }) {
  // Converte markdown básico para HTML
  const formatContent = (text: string) => {
    return text
      .split('\n')
      .map((line, idx) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h3 key={idx} className="font-semibold mt-3 mb-1">{line.slice(4)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={idx} className="font-bold text-lg mt-4 mb-2">{line.slice(3)}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={idx} className="font-bold text-xl mt-4 mb-2">{line.slice(2)}</h1>;
        }

        // Listas
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <li key={idx} className="ml-4">
              {line.slice(2)}
            </li>
          );
        }

        // Linha vazia
        if (line.trim() === '') {
          return <br key={idx} />;
        }

        // Texto normal
        return <p key={idx} className="mb-2">{line}</p>;
      });
  };

  return <div>{formatContent(content)}</div>;
}
