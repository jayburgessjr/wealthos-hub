import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { loadAnswers, type OnboardingAnswers } from "@/lib/onboardingProfile";

export type NavMode = "simple" | "pro";

const STORAGE_KEY = "bwh_nav_mode_v1";
const EVENT = "bwh-nav-mode-change";

/** Simple for new/some and for anyone with no onboarding data; pro for experienced. */
export function getDefaultNavMode(answers: OnboardingAnswers | null): NavMode {
  return answers?.experience === "experienced" ? "pro" : "simple";
}

export function readStoredNavMode(): NavMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "simple" || v === "pro" ? v : null;
  } catch {
    return null;
  }
}

export function writeStoredNavMode(mode: NavMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore; the choice just will not persist
  }
}

export function useNavMode(): { mode: NavMode; setMode: (m: NavMode) => void } {
  const { user } = useAuth();
  const [mode, setModeState] = useState<NavMode>(
    () => readStoredNavMode() ?? getDefaultNavMode(loadAnswers(user?.id)),
  );

  // Re-resolve when the user changes (the stored choice still wins).
  useEffect(() => {
    setModeState(readStoredNavMode() ?? getDefaultNavMode(loadAnswers(user?.id)));
  }, [user?.id]);

  useEffect(() => {
    const onChange = () =>
      setModeState(readStoredNavMode() ?? getDefaultNavMode(loadAnswers(user?.id)));
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [user?.id]);

  const setMode = useCallback((m: NavMode) => {
    writeStoredNavMode(m);
    setModeState(m);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { mode, setMode };
}

/** Called when onboarding finishes so the answers pick the default mode. */
export function resetNavMode(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "");
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}
