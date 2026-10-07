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
  createSolidDataset,
  getSolidDataset,       // ← Tambahkan ini
  createContainerAt      // ← Tambahkan ini
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
      if (!session || !session.info?.isLoggedIn) {
        console.warn("[ChatSession] Solid session belum login atau tidak valid");
        return null;
      }

      const webId = session.info.webId;
      console.log("[ChatSession] WebID saat ini:", webId); // 🔍 DEBUG: Cek apakah webId ada

      if (!webId) {
        throw new Error("WebID tidak ditemukan di sesi. Silakan logout dan login ulang.");
      }

      // 1. Coba ambil Pod URL secara otomatis
      console.log("[ChatSession] Mencoba mengambil Pod URL dari WebID...");
      const podUrls = await getPodUrlAll(webId, { fetch: session.fetch });
      console.log("[ChatSession] Hasil getPodUrlAll:", podUrls); // 🔍 DEBUG: Lihat hasilnya

      let podUrl = "";
      
      if (podUrls && podUrls.length > 0) {
        podUrl = podUrls[0];
      } else {
        // 2. FALLBACK: Jika gagal, coba tebak URL Pod dari WebID
        // Contoh: https://user.solidcommunity.net/profile/card#me -> https://user.solidcommunity.net/
        console.warn("[ChatSession] getPodUrlAll gagal. Mencoba fallback manual dari WebID...");
        try {
          const urlObj = new URL(webId);
          podUrl = `${urlObj.protocol}//${urlObj.hostname}/`;
          console.log("[ChatSession] Fallback Pod URL berhasil ditebak:", podUrl);
        } catch (e) {
          throw new Error(`Gagal menemukan atau menebak Pod URL dari WebID: ${webId}`);
        }
      }

      // Pastikan URL diakhiri dengan slash '/'
      const safePodUrl = podUrl.endsWith('/') ? podUrl : `${podUrl}/`;
      const folder = `${safePodUrl}public/llm-solid-chat/`;
      const name = `session-${uuidv4()}.ttl`;
      const newUrl = `${folder}${name}`;

      console.log("[ChatSession] Target folder untuk sesi baru:", folder);

      // 3. Cek dan buat folder jika belum ada
      try {
        await getSolidDataset(folder, { fetch: session.fetch });
        console.log("[ChatSession] Folder sudah ada, melanjutkan...");
      } catch (folderError: any) {
        if (folderError.statusCode === 404 || folderError.status === 404) {
          console.warn(`[ChatSession] Folder belum ada. Membuat folder: ${folder}`);
          await createContainerAt(folder, { fetch: session.fetch });
          console.log("[ChatSession] Folder berhasil dibuat.");
        } else {
          console.error("[ChatSession] Error saat mengecek/membuat folder:", folderError);
          throw folderError;
        }
      }

      // 4. Simpan file sesi baru
      console.log("[ChatSession] Menyimpan file sesi di:", newUrl);
      await saveSolidDatasetAt(newUrl, createSolidDataset(), { fetch: session.fetch });

      // 5. Update state UI
      setSessionsList((prev) => [name, ...prev]);
      setCurrentSession(name);
      setSessionMessages([]);
      setAllMessages([]);

      return name;
    } catch (error: any) {
      console.error("[ChatSession] Gagal membuat sesi baru:", error);
      
      if (error.status === 403 || error.statusCode === 403) {
        alert("Akses ditolak (403). Pastikan Anda memberikan izin 'Write' saat login ke Solid Pod.");
      } else if (error.message.includes("WebID tidak ditemukan")) {
        alert("Sesi tidak valid. Silakan logout dan login ulang.");
      } else {
        alert(`Gagal membuat sesi: ${error.message}`);
      }
      
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