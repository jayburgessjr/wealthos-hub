import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";

interface DemoContextType {
  isDemoMode: boolean;
  setDemoMode: (val: boolean) => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return sessionStorage.getItem("aje_demo_mode") === "true";
  });

  // Authenticated users must never see demo data
  useEffect(() => {
    if (user && isDemoMode) {
      setIsDemoMode(false);
      sessionStorage.removeItem("aje_demo_mode");
    }
  }, [user]);

  const setDemoMode = (val: boolean) => {
    if (val && user) return; // silently block if logged in
    setIsDemoMode(val);
    if (val) {
      sessionStorage.setItem("aje_demo_mode", "true");
    } else {
      sessionStorage.removeItem("aje_demo_mode");
    }
  };

  return (
    <DemoContext.Provider value={{ isDemoMode, setDemoMode }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error("useDemo must be used within a DemoProvider");
  }
  return context;
}
