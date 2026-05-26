"use client";

import { HiBookmark, HiOutlineBookmark } from "react-icons/hi";

import { togglePostingBookmarkAction } from "@/app/actions";
import { ActionToastForm } from "@/components/ui/action-toast-form";

export function BookmarkToggle({
  postingId,
  isBookmarked,
}: {
  postingId: number;
  isBookmarked: boolean;
}) {
  const Icon = isBookmarked ? HiBookmark : HiOutlineBookmark;
  const color = isBookmarked ? "var(--rw-accent)" : "var(--rw-muted)";
  const label = isBookmarked ? "찜 해제" : "찜하기";

  return (
    <ActionToastForm
      action={togglePostingBookmarkAction}
      errorMessage="찜 상태 변경에 실패했습니다."
      successMessage={isBookmarked ? "찜을 해제했습니다." : "찜에 추가했습니다."}
      onClick={(event) => event.stopPropagation()}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 2,
      }}
    >
      <input type="hidden" name="postingId" value={postingId} />
      <input type="hidden" name="nextBookmarked" value={isBookmarked ? "0" : "1"} />
      <button
        type="submit"
        title={label}
        aria-label={label}
        aria-pressed={isBookmarked}
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
          width: 24,
          height: 24,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color,
        }}
      >
        <Icon size={16} />
      </button>
    </ActionToastForm>
  );
}
