"use client";

import {
  useActionState,
  useEffect,
  type CSSProperties,
  type MouseEventHandler,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";

import { useToast } from "@/components/ui/toast-provider";

type ActionToastState = {
  message: string;
  status: "idle" | "success" | "error";
  submissionId: number;
};

type ActionToastFormProps = {
  action: (formData: FormData) => Promise<unknown>;
  children: ReactNode;
  className?: string;
  errorMessage?: string;
  onClick?: MouseEventHandler<HTMLFormElement>;
  style?: CSSProperties;
  successMessage: string;
};

type ActionToastSubmitButtonProps = {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
  style?: CSSProperties;
};

const initialState: ActionToastState = {
  message: "",
  status: "idle",
  submissionId: 0,
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function ActionToastForm({
  action,
  children,
  className,
  errorMessage = "요청을 처리하지 못했습니다.",
  onClick,
  style,
  successMessage,
}: ActionToastFormProps) {
  const showToast = useToast();
  const [state, formAction] = useActionState(
    async (_previousState: ActionToastState, formData: FormData) => {
      try {
        await action(formData);
        return {
          message: successMessage,
          status: "success" as const,
          submissionId: Date.now(),
        };
      } catch (error) {
        return {
          message: getErrorMessage(error, errorMessage),
          status: "error" as const,
          submissionId: Date.now(),
        };
      }
    },
    initialState,
  );

  useEffect(() => {
    if (state.status === "idle" || state.submissionId === 0) {
      return;
    }
    showToast({
      title: state.message,
      tone: state.status,
    });
  }, [showToast, state]);

  return (
    <form action={formAction} className={className} onClick={onClick} style={style}>
      {children}
    </form>
  );
}

export function ActionToastSubmitButton({
  children,
  className,
  pendingLabel = "처리 중...",
  style,
}: ActionToastSubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      style={{
        ...style,
        cursor: pending ? "wait" : style?.cursor,
        opacity: pending ? 0.72 : style?.opacity,
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
