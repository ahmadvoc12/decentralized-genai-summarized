'use client';
import {
  createContext,
  useContext,
  useState,
  ReactNode
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  getPodUrlAll,
  saveSolidDatasetAt,
  createSolidDataset
} from '@inrupt/solid-client';
import { useSolidSession } from '@/contexts/SolidSessionContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatContextType {
  sessionsList: string[];
  setSessionsList: React.Dispatch<React.SetStateAction<string[]>>;
  currentSession: string;
  setCurrentSession: (name: string) => void;
  selectedAgent: string;
  setSelectedAgent: (value: string) => void;
  selectedLLM: string;
  setSelectedLLM: (value: string) => void;
  createNewSession: () => Promise<string | null>;
  loadSession: (name: string) => void;
  allMessages: ChatMessage[];
  sessionMessages: ChatMessage[];
  setAllMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setSessionMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  solidPermissionGranted: boolean | null;
  setSolidPermissionGranted: React.Dispatch<React.SetStateAction<boolean | null>>;
}

const ChatSessionContext = createContext<ChatContextType | undefined>(undefined);

export const ChatSessionProvider = ({ children }: { children: ReactNode }) => {
  const [sessionsList, setSessionsList] = useState<string[]>([]);
  const [currentSession, setCurrentSession] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<'default' | string>('default');
  const [selectedLLM, setSelectedLLM] = useState<'openai' | string>('openai');
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [solidPermissionGranted, setSolidPermissionGranted] = useState<boolean | null>(null);

  const { session } = useSolidSession();

  const createNewSession = async (): Promise<string | null> => {
    try {
      if (!session || !session.info?.webId) {
        console.warn("Solid session not ready");
        return null;
      }

      const name = `session-${uuidv4()}.ttl`;
      const podUrls = await getPodUrlAll(session.info.webId, { fetch: session.fetch });
      const folder = `${podUrls[0]}public/llm-solid-chat/`;
      const newUrl = `${folder}${name}`;

      await saveSolidDatasetAt(newUrl, createSolidDataset(), { fetch: session.fetch });

      setSessionsList((prev) => [name, ...prev]);
      setCurrentSession(name);
      setSessionMessages([]);
      setAllMessages([]);

      return name;
    } catch (error) {
      console.error("Gagal membuat sesi baru:", error);
      return null;
    }
  };

  const loadSession = (name: string) => {
    setCurrentSession(name);
  };

  return (
    <ChatSessionContext.Provider
      value={{
        sessionsList,
        setSessionsList,
        currentSession,
        setCurrentSession,
        selectedAgent,
        setSelectedAgent,
        selectedLLM,
        setSelectedLLM,
        createNewSession,
        loadSession,
        allMessages,
        sessionMessages,
        setAllMessages,
        setSessionMessages,
        solidPermissionGranted,
        setSolidPermissionGranted,
      }}
    >
      {children}
    </ChatSessionContext.Provider>
  );
};

export const useChatSession = () => {
  const context = useContext(ChatSessionContext);
  if (!context) {
    throw new Error('useChatSession must be used within ChatSessionProvider');
  }
  return context;
};
