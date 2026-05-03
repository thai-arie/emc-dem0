import { create } from "zustand";
import type { User } from "../entities/types";

const storageKey = "emc.auth.user";

function storedUser() {
  try {
    const value = window.localStorage.getItem(storageKey);
    const user = value ? (JSON.parse(value) as User) : null;
    return user?.email ? user : null;
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: storedUser(),
  setUser: (user) => {
    window.localStorage.setItem(storageKey, JSON.stringify(user));
    set({ user });
  },
  clearUser: () => {
    window.localStorage.removeItem(storageKey);
    set({ user: null });
  }
}));
