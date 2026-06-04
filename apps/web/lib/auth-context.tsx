"use client";

import React, { createContext, useContext, useState } from "react";

interface AuthContextValue {
  authed: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  authed: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  return (
    <AuthContext.Provider value={{ authed, login: () => setAuthed(true), logout: () => setAuthed(false) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
