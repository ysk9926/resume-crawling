"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";

import { createManualPostingAction } from "@/app/actions";
import {
  inputStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  textareaStyle,
} from "@/components/ui/primitives";

type ManualPostingModalProps = {
  triggerLabel?: string;
  triggerStyle?: CSSProperties;
};

const formLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 10,
  fontWeight: 700,
  color: "var(--rw-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const checkboxLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  color: "var(--rw-foreground)",
};

export function ManualPostingModal({
  triggerLabel = "+ 수동 공고 추가",
  triggerStyle,
}: ManualPostingModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const wasPendingRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => setIsOpen(false);
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  useEffect(() => {
    if (wasPendingRef.current && !isPending) {
      formRef.current?.reset();
      setIsOpen(false);
    }
    wasPendingRef.current = isPending;
  }, [isPending]);

  function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current && !isPending) {
      setIsOpen(false);
    }
  }

  function handleSubmit(formData: FormData) {
    startTransition(() => {
      void createManualPostingAction(formData);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        style={triggerStyle ?? primaryButtonStyle}
      >
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        className="rw-application-modal rw-manual-application-modal"
        aria-labelledby="manual-posting-modal-title"
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxHeight: "85vh",
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              padding: "20px 24px",
              borderBottom: "1px solid var(--rw-border)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2
                id="manual-posting-modal-title"
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--rw-foreground)",
                  letterSpacing: "-0.01em",
                }}
              >
                수동 공고 추가
              </h2>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: "var(--rw-muted)",
                }}
              >
                크롤링되지 않는 공고를 직접 등록합니다. 새 플랫폼명은 저장 즉시 DB에 등록되어
                필터에 재사용됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="닫기"
              style={{
                ...secondaryButtonStyle,
                padding: "4px 10px",
                height: 28,
                fontSize: 14,
              }}
            >
              ×
            </button>
          </div>

          <form
            ref={formRef}
            action={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 0,
                overflowY: "auto",
                minHeight: 0,
              }}
            >
              <div
                style={{
                  padding: "16px 24px",
                  borderRight: "1px solid var(--rw-border)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <label style={formLabelStyle}>
                  플랫폼명
                  <input
                    name="platformName"
                    placeholder="리멤버"
                    required
                    style={inputStyle}
                  />
                </label>
                <label style={formLabelStyle}>
                  회사명
                  <input
                    name="companyName"
                    placeholder="회사명"
                    required
                    style={inputStyle}
                  />
                </label>
                <label style={formLabelStyle}>
                  공고명
                  <input
                    name="jobTitle"
                    placeholder="백엔드 엔지니어"
                    required
                    style={inputStyle}
                  />
                </label>
                <label style={formLabelStyle}>
                  공고 원문 URL
                  <input name="detailUrl" placeholder="https://..." style={inputStyle} />
                </label>
                <label style={formLabelStyle}>
                  지원 URL
                  <input
                    name="externalApplyUrl"
                    placeholder="https://..."
                    style={inputStyle}
                  />
                </label>
              </div>

              <div
                style={{
                  padding: "16px 24px",
                  borderRight: "1px solid var(--rw-border)",
                  display: "grid",
                  gap: 10,
                }}
              >
                <label style={formLabelStyle}>
                  등록일
                  <input type="date" name="postedAt" style={inputStyle} />
                </label>
                <label style={formLabelStyle}>
                  접수 시작일
                  <input type="date" name="applyStartDate" style={inputStyle} />
                </label>
                <label style={formLabelStyle}>
                  접수 마감일
                  <input type="date" name="applyEndDate" style={inputStyle} />
                </label>
                <label style={formLabelStyle}>
                  접수기간 텍스트
                  <input
                    name="applyPeriodRaw"
                    placeholder="예: 상시채용 / ~06.05"
                    style={inputStyle}
                  />
                </label>
                <label style={formLabelStyle}>
                  태그
                  <input name="tags" placeholder="Backend, Data" style={inputStyle} />
                </label>
                <label style={formLabelStyle}>
                  정제 상태
                  <select name="curationStatus" defaultValue="new" style={inputStyle}>
                    <option value="new">검토 전</option>
                    <option value="interesting">관심</option>
                    <option value="ignored">제외</option>
                  </select>
                </label>
              </div>

              <div
                style={{
                  padding: "16px 24px",
                  display: "grid",
                  gap: 10,
                }}
              >
                <label style={formLabelStyle}>
                  공고 요약 / 본문
                  <textarea
                    name="normalizedContent"
                    rows={6}
                    placeholder="공고 핵심 내용, 자격요건, 메모"
                    style={textareaStyle}
                  />
                </label>
                <label style={formLabelStyle}>
                  내부 메모
                  <textarea
                    name="curationNote"
                    rows={4}
                    placeholder="왜 저장했는지, 다음 액션"
                    style={textareaStyle}
                  />
                </label>
                <label style={checkboxLabelStyle}>
                  <input type="checkbox" name="isBookmarked" defaultChecked />
                  찜 등록
                </label>
                <label style={checkboxLabelStyle}>
                  <input type="checkbox" name="isTodo" />
                  작성예정으로 표시
                </label>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                padding: "12px 24px",
                borderTop: "1px solid var(--rw-border)",
                backgroundColor: "var(--rw-subtle)",
              }}
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                style={{
                  ...secondaryButtonStyle,
                  opacity: isPending ? 0.6 : 1,
                  cursor: isPending ? "not-allowed" : "pointer",
                }}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isPending}
                style={{
                  ...primaryButtonStyle,
                  opacity: isPending ? 0.7 : 1,
                  cursor: isPending ? "wait" : "pointer",
                }}
              >
                {isPending ? "저장 중..." : "수동 공고 저장"}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
