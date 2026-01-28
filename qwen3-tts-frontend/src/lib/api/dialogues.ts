import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface Dialogue {
  id: number;
  user_id: number;
  title: string;
  status: string;
  generation_mode?: string;
  merge_config?: any;
  total_lines: number;
  success_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  merged_audio_path?: string;
}

export interface DialogueLine {
  id: number;
  dialogue_id: number;
  character_id: number;
  order: number;
  text: string;
  instruct_override?: string;
  tts_params_override?: any;
  status: string;
  output_audio_path?: string;
  audio_duration?: number;
  error_message?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface DialogueLineWithCharacter extends DialogueLine {
  character_name: string;
  character_color: string;
  character_avatar_type: string;
  character_avatar_data?: string;
}

export interface DialogueDetail extends Dialogue {
  lines: DialogueLineWithCharacter[];
}

export const getDialogues = async (params?: {
  skip?: number;
  limit?: number;
  status?: string;
}) => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_BASE}/dialogues`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params,
  });
  return response.data;
};

export const getDialogueById = async (id: number): Promise<DialogueDetail> => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_BASE}/dialogues/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const createDialogue = async (data: {
  title: string;
  merge_config?: any;
}): Promise<Dialogue> => {
  const token = localStorage.getItem('token');
  const response = await axios.post(`${API_BASE}/dialogues`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const updateDialogue = async (
  id: number,
  data: {
    title?: string;
    merge_config?: any;
  }
): Promise<Dialogue> => {
  const token = localStorage.getItem('token');
  const response = await axios.patch(`${API_BASE}/dialogues/${id}`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const deleteDialogue = async (id: number): Promise<void> => {
  const token = localStorage.getItem('token');
  await axios.delete(`${API_BASE}/dialogues/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const duplicateDialogue = async (id: number): Promise<Dialogue> => {
  const token = localStorage.getItem('token');
  const response = await axios.post(
    `${API_BASE}/dialogues/${id}/duplicate`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export const getDialogueLines = async (
  dialogueId: number
): Promise<DialogueLineWithCharacter[]> => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_BASE}/dialogues/${dialogueId}/lines`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

export const createDialogueLine = async (
  dialogueId: number,
  data: {
    character_id: number;
    text: string;
    order?: number;
    instruct_override?: string;
    tts_params_override?: any;
  }
): Promise<DialogueLine> => {
  const token = localStorage.getItem('token');
  const response = await axios.post(
    `${API_BASE}/dialogues/${dialogueId}/lines`,
    data,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export const updateDialogueLine = async (
  lineId: number,
  data: {
    character_id?: number;
    text?: string;
    instruct_override?: string;
    tts_params_override?: any;
  }
): Promise<DialogueLine> => {
  const token = localStorage.getItem('token');
  const response = await axios.patch(
    `${API_BASE}/dialogues/dialogue-lines/${lineId}`,
    data,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

export const deleteDialogueLine = async (lineId: number): Promise<void> => {
  const token = localStorage.getItem('token');
  await axios.delete(`${API_BASE}/dialogues/dialogue-lines/${lineId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const reorderDialogueLines = async (
  dialogueId: number,
  lineIds: number[]
): Promise<void> => {
  const token = localStorage.getItem('token');
  await axios.put(
    `${API_BASE}/dialogues/${dialogueId}/lines/reorder`,
    { line_ids: lineIds },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};
