import { create } from "zustand";
import type { Role, User } from "../entities/types";

const users: User[] = [
  { id: "USR-CEO", full_name: "Maya Chen", role: "CEO" },
  { id: "USR-COL", full_name: "Collections officer", role: "COLLECTIONS" },
  { id: "USR-OPS", full_name: "Ops coordinator", role: "OPS" }
];

interface AuthState {
  user: User | null;
  login: (role: Role) => void;
  switchRole: (role: Role) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  login: (role) => set({ user: users.find((user) => user.role === role) ?? null }),
  switchRole: (role) => set({ user: users.find((user) => user.role === role) ?? null })
}));
