import { create } from "zustand";

export interface ToastItem {
  id: string;
  message: string;
}

interface UiState {
  toasts: ToastItem[];
  addToast: (message: string) => void;
  dismissToast: (id: string) => void;
}

export const useUi = create<UiState>((set) => ({
  toasts: [],
  addToast: (message) => set((state) => ({ toasts: [...state.toasts, { id: `${Date.now()}-${state.toasts.length}`, message }] })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
}));
