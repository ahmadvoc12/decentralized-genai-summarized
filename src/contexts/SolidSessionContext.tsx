'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  getDefaultSession,
  handleIncomingRedirect,
  Session,
} from '@inrupt/solid-client-authn-browser';

// Tipe context
interface SolidSessionContextType {
  session: Session;
  isLoggedIn: boolean;
  loading: boolean;
  login: (options: {
    oidcIssuer: string;
    clientId: string;
    redirectUrl: string;
    clientName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

// Buat context
const SolidSessionContext = createContext<SolidSessionContextType | undefined>(undefined);

// Provider
export function SolidSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(getDefaultSession());
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(session.info.isLoggedIn);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function init() {
      try {
        await handleIncomingRedirect({ restorePreviousSession: true });
      } catch (err) {
        console.warn('⚠️ Solid Session handleIncomingRedirect error:', err);
      } finally {
        const sess = getDefaultSession();
        setSession(sess);
        setIsLoggedIn(sess.info.isLoggedIn);
        setLoading(false);
      }
    }
    init();
  }, []);

  const login = async ({
    oidcIssuer,
    clientId,
    redirectUrl,
    clientName,
  }: {
    oidcIssuer: string;
    clientId: string;
    redirectUrl: string;
    clientName: string;
  }) => {
    await session.login({ oidcIssuer, clientId, redirectUrl, clientName });
  };

  const logout = async () => {
    await session.logout();
    setIsLoggedIn(false);
    localStorage.clear();
  };

  return (
    <SolidSessionContext.Provider
      value={{ session, isLoggedIn, loading, login, logout }}
    >
      {children}
    </SolidSessionContext.Provider>
  );
}

// Hook aman
export function useSolidSession(): SolidSessionContextType {
  const context = useContext(SolidSessionContext);

  if (!context) {
    // Saat prerendering di server-side
    if (typeof window === 'undefined') {
      return {
        session: getDefaultSession(),
        isLoggedIn: false,
        loading: false,
        login: async () => {},
        logout: async () => {},
      };
    }

    // Saat client-side tapi tidak dibungkus (fallback + warning)
    console.warn(
      '⚠️ useSolidSession dipanggil di luar <SolidSessionProvider>. Menggunakan fallback session kosong.'
    );
    return {
      session: getDefaultSession(),
      isLoggedIn: false,
      loading: false,
      login: async () => {},
      logout: async () => {},
    };
  }

  return context;
}
