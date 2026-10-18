import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { AppLanguage } from "@/lib/i18n";

const LANGUAGE_KEY = "movie-recap.language.v1";
const HISTORY_KEY = "movie-recap.history.v1";
const MAX_HISTORY = 30;

export type RetellingMode = "gemini" | "sample";

export interface HistoryItem {
  id: string;
  createdAt: number;
  title: string;
  language: AppLanguage;
  sourceUrl: string;
  transcript: string;
  retelling: string;
  mode: RetellingMode;
}

interface AppStateValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  history: HistoryItem[];
  addHistory: (item: HistoryItem) => Promise<void>;
  updateHistoryText: (id: string, retelling: string) => Promise<void>;
  removeHistoryItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  draft: HistoryItem | null;
  setDraft: (item: HistoryItem | null) => void;
  hydrated: boolean;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("en");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [draft, setDraft] = useState<HistoryItem | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [storedLanguage, storedHistory] = await Promise.all([
          AsyncStorage.getItem(LANGUAGE_KEY),
          AsyncStorage.getItem(HISTORY_KEY),
        ]);
        if (!active) return;
        if (storedLanguage === "en" || storedLanguage === "my") {
          setLanguageState(storedLanguage);
        }
        if (storedHistory) {
          const parsed = JSON.parse(storedHistory) as unknown;
          if (Array.isArray(parsed)) setHistory(parsed.slice(0, MAX_HISTORY) as HistoryItem[]);
        }
      } catch {
        // A corrupt local history should not prevent the app from opening.
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback(async (next: AppLanguage) => {
    setLanguageState(next);
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      // The choice remains active for this session if local storage is unavailable.
    }
  }, []);

  const addHistory = useCallback(async (item: HistoryItem) => {
    setHistory((current) => {
      const next = [item, ...current.filter((entry) => entry.id !== item.id)].slice(0, MAX_HISTORY);
      void AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const updateHistoryText = useCallback(async (id: string, retelling: string) => {
    setHistory((current) => {
      const next = current.map((item) => item.id === id ? { ...item, retelling } : item);
      void AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const removeHistoryItem = useCallback(async (id: string) => {
    setHistory((current) => {
      const next = current.filter((item) => item.id !== id);
      void AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const clearHistory = useCallback(async () => {
    setHistory([]);
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
    } catch {
      // Keep the in-memory clear even if the storage provider fails.
    }
  }, []);

  const value = useMemo<AppStateValue>(() => ({
    language,
    setLanguage,
    history,
    addHistory,
    updateHistoryText,
    removeHistoryItem,
    clearHistory,
    draft,
    setDraft,
    hydrated,
  }), [language, setLanguage, history, addHistory, updateHistoryText, removeHistoryItem, clearHistory, draft, hydrated]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useAppState must be used inside AppStateProvider");
  return value;
}
