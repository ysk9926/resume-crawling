"use client";

import { togglePostingTodoAction } from "@/app/actions";
import { secondaryButtonStyle } from "@/components/ui/primitives";

export function TodoToggle({
  postingId,
  isTodo,
}: {
  postingId: number;
  isTodo: boolean;
}) {
  const label = isTodo ? "작성예정 해제" : "작성예정으로 올리기";

  return (
    <form
      action={togglePostingTodoAction}
      onClick={(event) => event.stopPropagation()}
      style={{ display: "inline-flex" }}
    >
      <input type="hidden" name="postingId" value={postingId} />
      <input type="hidden" name="nextTodo" value={isTodo ? "0" : "1"} />
      <button
        type="submit"
        title={label}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          const details = event.currentTarget.closest("details");
          if (!details) return;
          const wasOpen = details.open;
          requestAnimationFrame(() => {
            details.open = wasOpen;
          });
        }}
        style={{
          ...secondaryButtonStyle,
          height: 26,
          padding: "0 10px",
          fontSize: 11,
          fontWeight: 600,
          borderColor: isTodo ? "#fed7aa" : "var(--rw-border)",
          backgroundColor: isTodo ? "#fff7ed" : "#ffffff",
          color: isTodo ? "#b45309" : "var(--rw-foreground)",
        }}
      >
        작성예정
      </button>
    </form>
  );
}
