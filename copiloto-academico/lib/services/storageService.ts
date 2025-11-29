/**
 * Serviço de localStorage para gerenciar UserInfo
 * Armazena userId (UUID), nome e idade no navegador
 */

import { UserInfo } from '@/lib/types';
import { generateUUID } from '@/lib/utils/uuid';

const STORAGE_KEY = 'copiloto_academico_user';

/**
 * Obtém UserInfo do localStorage
 * Retorna null se não existir
 */
export function getUserInfo(): UserInfo | null {
  if (typeof window === 'undefined') return null; // SSR check

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const userInfo: UserInfo = JSON.parse(stored);

    // Validação básica
    if (!userInfo.userId || !userInfo.name || !userInfo.age) {
      return null;
    }

    return userInfo;
  } catch (error) {
    console.error('Erro ao ler userInfo do localStorage:', error);
    return null;
  }
}

/**
 * Salva UserInfo no localStorage
 * Se não houver userId, gera um novo UUID
 */
export function setUserInfo(name: string, age: number, userId?: string): UserInfo {
  if (typeof window === 'undefined') {
    throw new Error('localStorage não disponível no servidor');
  }

  const userInfo: UserInfo = {
    userId: userId || generateUUID(),
    name: name.trim(),
    age: age
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo));
    return userInfo;
  } catch (error) {
    console.error('Erro ao salvar userInfo no localStorage:', error);
    throw error;
  }
}

/**
 * Limpa UserInfo do localStorage (logout)
 */
export function clearUserInfo(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Erro ao limpar userInfo:', error);
  }
}

/**
 * Verifica se o usuário já está identificado
 */
export function hasUserInfo(): boolean {
  return getUserInfo() !== null;
}

/**
 * Obtém apenas o userId do usuário atual
 */
export function getUserId(): string | null {
  const userInfo = getUserInfo();
  return userInfo?.userId || null;
}
