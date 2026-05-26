"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  HiCheckCircle,
  HiInformationCircle,
  HiXCircle,
} from "react-icons/hi";

export type ToastTone = "success" | "error" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
};

type ToastItem = Required<Pick<ToastInput, "title" | "tone">> &
  Pick<ToastInput, "description"> & {
    id: number;
  };

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toastPalette: Record<
  ToastTone,
  {
    backgroundColor: string;
    borderColor: string;
    color: string;
    iconColor: string;
  }
> = {
  success: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    color: "#064e3b",
    iconColor: "#059669",
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    color: "#7f1d1d",
    iconColor: "#dc2626",
  },
  info: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    color: "#1e3a8a",
    iconColor: "#2563eb",
  },
};

const toastIcons = {
  success: HiCheckCircle,
  error: HiXCircle,
  info: HiInformationCircle,
} as const;

declare global {
  interface WindowEventMap {
    "rw:toast": CustomEvent<ToastInput>;
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef<Map<number, number>>(new Map());

  const dismissToast = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const id = nextIdRef.current;
      nextIdRef.current += 1;

      setToasts((items) => [
        ...items.slice(-3),
        {
          id,
          title: toast.title,
          description: toast.description,
          tone: toast.tone ?? "info",
        },
      ]);

      const timer = window.setTimeout(() => dismissToast(id), 3600);
      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  useEffect(() => {
    const handleToast = (event: WindowEventMap["rw:toast"]) => {
      showToast(event.detail);
    };
    window.addEventListener("rw:toast", handleToast);
    return () => window.removeEventListener("rw:toast", handleToast);
  }, [showToast]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="rw-toast-viewport"
      >
        {toasts.map((toast) => {
          const Icon = toastIcons[toast.tone];
          const palette = toastPalette[toast.tone];
          return (
            <div
              key={toast.id}
              className="rw-toast"
              role="status"
              style={{
                backgroundColor: palette.backgroundColor,
                borderColor: palette.borderColor,
                color: palette.color,
              }}
            >
              <Icon
                aria-hidden="true"
                size={18}
                style={{
                  flex: "0 0 auto",
                  color: palette.iconColor,
                  marginTop: 1,
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>
                  {toast.title}
                </div>
                {toast.description ? (
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 12,
                      lineHeight: 1.45,
                      opacity: 0.82,
                    }}
                  >
                    {toast.description}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="알림 닫기"
                onClick={() => dismissToast(toast.id)}
                style={{
                  flex: "0 0 auto",
                  appearance: "none",
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 2,
                  opacity: 0.72,
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context.showToast;
}
