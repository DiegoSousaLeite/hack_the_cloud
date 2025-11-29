/**
 * Serviço de Text-to-Speech com AWS Polly
 * Converte texto em áudio usando Lambda Helper
 */

import { TTSRequestPayload, TTSResponsePayload } from '@/lib/types';

const API_ENDPOINT = process.env.NEXT_PUBLIC_TTS_API_ENDPOINT || '';

/**
 * Converte texto em áudio usando AWS Polly e reproduz
 */
export async function playTextToSpeech(text: string): Promise<void> {
  try {
    const payload: TTSRequestPayload = {
      text,
      voiceId: 'Camila' // Voz em português brasileiro do AWS Polly
    };

    const response = await fetch(`${API_ENDPOINT}/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Erro na API TTS: ${response.status}`);
    }

    const data: TTSResponsePayload = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Erro ao gerar áudio');
    }

    // Criar elemento de áudio e reproduzir
    const audio = new Audio(data.audioUrl);

    return new Promise((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Erro ao reproduzir áudio'));
      audio.play().catch(reject);
    });
  } catch (error) {
    console.error('Erro no TTS:', error);
    throw error;
  }
}
