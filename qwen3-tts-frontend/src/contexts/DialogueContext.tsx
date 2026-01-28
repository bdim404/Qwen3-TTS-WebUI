import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type {
  Dialogue,
  DialogueDetail,
  DialogueLineWithCharacter,
} from '@/lib/api/dialogues';
import {
  getDialogues,
  getDialogueById,
  createDialogue,
  updateDialogue,
  deleteDialogue,
  duplicateDialogue,
  createDialogueLine,
  updateDialogueLine,
  deleteDialogueLine,
  reorderDialogueLines,
} from '@/lib/api/dialogues';

interface DialogueState {
  dialogues: Dialogue[];
  currentDialogue: DialogueDetail | null;
  lines: DialogueLineWithCharacter[];
  total: number;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

interface DialogueContextValue extends DialogueState {
  loadDialogues: (params?: { skip?: number; limit?: number; status?: string }) => Promise<void>;
  loadDialogue: (id: number) => Promise<void>;
  createNewDialogue: (title: string) => Promise<number>;
  updateDialogueData: (id: number, data: { title?: string; merge_config?: any }) => Promise<void>;
  deleteDialogueData: (id: number) => Promise<void>;
  duplicateDialogueData: (id: number) => Promise<number>;
  addLine: (data: {
    character_id: number;
    text: string;
    order?: number;
    instruct_override?: string;
    tts_params_override?: any;
  }) => Promise<void>;
  updateLine: (
    lineId: number,
    data: {
      character_id?: number;
      text?: string;
      instruct_override?: string;
      tts_params_override?: any;
    }
  ) => Promise<void>;
  deleteLine: (lineId: number) => Promise<void>;
  reorderLines: (lineIds: number[]) => Promise<void>;
  clearError: () => void;
}

const DialogueContext = createContext<DialogueContextValue | undefined>(undefined);

export const DialogueProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DialogueState>({
    dialogues: [],
    currentDialogue: null,
    lines: [],
    total: 0,
    isLoading: false,
    isSaving: false,
    error: null,
  });

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const loadDialogues = useCallback(async (params?: { skip?: number; limit?: number; status?: string }) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await getDialogues(params);
      setState((prev) => ({
        ...prev,
        dialogues: data.items,
        total: data.total,
        isLoading: false,
      }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        error: error.response?.data?.detail || '加载对话列表失败',
        isLoading: false,
      }));
    }
  }, []);

  const loadDialogue = useCallback(async (id: number) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await getDialogueById(id);
      setState((prev) => ({
        ...prev,
        currentDialogue: data,
        lines: data.lines,
        isLoading: false,
      }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        error: error.response?.data?.detail || '加载对话失败',
        isLoading: false,
      }));
    }
  }, []);

  const createNewDialogue = useCallback(async (title: string): Promise<number> => {
    setState((prev) => ({ ...prev, isSaving: true, error: null }));
    try {
      const data = await createDialogue({ title });
      setState((prev) => ({
        ...prev,
        dialogues: [data, ...prev.dialogues],
        isSaving: false,
      }));
      return data.id;
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        error: error.response?.data?.detail || '创建对话失败',
        isSaving: false,
      }));
      throw error;
    }
  }, []);

  const updateDialogueData = useCallback(
    async (id: number, data: { title?: string; merge_config?: any }) => {
      setState((prev) => ({ ...prev, isSaving: true, error: null }));
      try {
        const updated = await updateDialogue(id, data);
        setState((prev) => ({
          ...prev,
          dialogues: prev.dialogues.map((d) => (d.id === id ? updated : d)),
          currentDialogue: prev.currentDialogue?.id === id ? { ...prev.currentDialogue, ...updated } : prev.currentDialogue,
          isSaving: false,
        }));
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          error: error.response?.data?.detail || '更新对话失败',
          isSaving: false,
        }));
        throw error;
      }
    },
    []
  );

  const deleteDialogueData = useCallback(async (id: number) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      await deleteDialogue(id);
      setState((prev) => ({
        ...prev,
        dialogues: prev.dialogues.filter((d) => d.id !== id),
        currentDialogue: prev.currentDialogue?.id === id ? null : prev.currentDialogue,
        isLoading: false,
      }));
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        error: error.response?.data?.detail || '删除对话失败',
        isLoading: false,
      }));
      throw error;
    }
  }, []);

  const duplicateDialogueData = useCallback(async (id: number): Promise<number> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await duplicateDialogue(id);
      setState((prev) => ({
        ...prev,
        dialogues: [data, ...prev.dialogues],
        isLoading: false,
      }));
      return data.id;
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        error: error.response?.data?.detail || '复制对话失败',
        isLoading: false,
      }));
      throw error;
    }
  }, []);

  const addLine = useCallback(
    async (data: {
      character_id: number;
      text: string;
      order?: number;
      instruct_override?: string;
      tts_params_override?: any;
    }) => {
      if (!state.currentDialogue) return;
      setState((prev) => ({ ...prev, isSaving: true, error: null }));
      try {
        await createDialogueLine(state.currentDialogue.id, data);
        await loadDialogue(state.currentDialogue.id);
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          error: error.response?.data?.detail || '添加对话行失败',
          isSaving: false,
        }));
        throw error;
      }
    },
    [state.currentDialogue, loadDialogue]
  );

  const updateLine = useCallback(
    async (
      lineId: number,
      data: {
        character_id?: number;
        text?: string;
        instruct_override?: string;
        tts_params_override?: any;
      }
    ) => {
      setState((prev) => ({ ...prev, isSaving: true, error: null }));
      try {
        await updateDialogueLine(lineId, data);
        if (state.currentDialogue) {
          await loadDialogue(state.currentDialogue.id);
        }
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          error: error.response?.data?.detail || '更新对话行失败',
          isSaving: false,
        }));
        throw error;
      }
    },
    [state.currentDialogue, loadDialogue]
  );

  const deleteLine = useCallback(
    async (lineId: number) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        await deleteDialogueLine(lineId);
        if (state.currentDialogue) {
          await loadDialogue(state.currentDialogue.id);
        }
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          error: error.response?.data?.detail || '删除对话行失败',
          isLoading: false,
        }));
        throw error;
      }
    },
    [state.currentDialogue, loadDialogue]
  );

  const reorderLines = useCallback(
    async (lineIds: number[]) => {
      if (!state.currentDialogue) return;
      setState((prev) => ({ ...prev, isSaving: true, error: null }));
      try {
        await reorderDialogueLines(state.currentDialogue.id, lineIds);
        await loadDialogue(state.currentDialogue.id);
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          error: error.response?.data?.detail || '重新排序失败',
          isSaving: false,
        }));
        throw error;
      }
    },
    [state.currentDialogue, loadDialogue]
  );

  return (
    <DialogueContext.Provider
      value={{
        ...state,
        loadDialogues,
        loadDialogue,
        createNewDialogue,
        updateDialogueData,
        deleteDialogueData,
        duplicateDialogueData,
        addLine,
        updateLine,
        deleteLine,
        reorderLines,
        clearError,
      }}
    >
      {children}
    </DialogueContext.Provider>
  );
};

export const useDialogue = () => {
  const context = useContext(DialogueContext);
  if (!context) {
    throw new Error('useDialogue must be used within a DialogueProvider');
  }
  return context;
};
