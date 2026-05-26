"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { updateApplicationStatusAction } from "@/app/actions";
import {
  ActionToastForm,
  ActionToastSubmitButton,
} from "@/components/ui/action-toast-form";
import { primaryButtonStyle, secondaryButtonStyle } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/format";
import {
  getApplicationMethodLabel,
  getApplicationStatusLabel,
} from "@/lib/status-labels";
import type { Application } from "@/lib/types";

type DeadlineTone = "neutral" | "info" | "warning" | "danger" | "success";

export type ApplicationRowProps = {
  application: Application;
  deadline: {
    label: string;
    detail: string | null;
    tone: DeadlineTone;
  };
  gridTemplateColumns: string;
};

function toneForStatus(
  status: string,
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "offer") return "success";
  if (status === "applied" || status === "document_passed" || status === "interview")
    return "info";
  if (status === "planned") return "warning";
  if (status === "rejected" || status === "withdrawn") return "danger";
  return "neutral";
}

const deadlineNumericColor: Record<DeadlineTone, string> = {
  danger: "#b91c1c",
  warning: "#b45309",
  info: "var(--rw-foreground)",
  success: "var(--rw-foreground)",
  neutral: "var(--rw-muted)",
};

const modalChipBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "3px 10px",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.02em",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const modalChipPalette: Record<DeadlineTone, CSSProperties> = {
  danger: { backgroundColor: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" },
  warning: { backgroundColor: "#fff7ed", color: "#b45309", border: "1px solid #fed7aa" },
  info: { backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #dbeafe" },
  success: { backgroundColor: "#ecfdf5", color: "#047857", border: "1px solid #d1fae5" },
  neutral: { backgroundColor: "#f5f5f5", color: "#525252", border: "1px solid #e5e5e5" },
};

const detailLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "var(--rw-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: 0,
};

const detailValueStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--rw-foreground)",
  marginTop: 4,
  wordBreak: "break-word",
};

const modalStatusOptions = [
  { label: "지원 예정", value: "planned" },
  { label: "지원 완료", value: "applied" },
  { label: "서류 통과", value: "document_passed" },
  { label: "면접 진행", value: "interview" },
  { label: "오퍼", value: "offer" },
  { label: "불합격", value: "rejected" },
  { label: "철회", value: "withdrawn" },
] as const;

export function ApplicationRow({
  application,
  deadline,
  gridTemplateColumns,
}: ApplicationRowProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isCoverLetter = application.application_method === "cover_letter";
  const isClosed =
    application.status === "rejected" || application.status === "withdrawn";

  const statusLabel =
    application.status === "planned" && isCoverLetter
      ? "자소서 작성"
      : getApplicationStatusLabel(application.status);

  const methodLabel = getApplicationMethodLabel(application.application_method);
  const templateLabel = application.resume_template_title ?? "수동 편집";

  const metaParts = [application.source_name, methodLabel, templateLabel].filter(
    (part): part is string => Boolean(part && part.length > 0),
  );

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

  function handleRowKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen(true);
    }
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      setIsOpen(false);
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        onKeyDown={handleRowKeyDown}
        className="rw-application-row"
        style={{
          display: "grid",
          gridTemplateColumns,
          alignItems: "center",
          gap: 16,
          padding: "16px 24px",
          borderBottom: "1px solid var(--rw-border)",
          cursor: "pointer",
          opacity: isClosed ? 0.6 : 1,
          transition: "background-color 150ms ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <StatusBadge label={statusLabel} tone={toneForStatus(application.status)} />
        </div>

        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--rw-foreground)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {application.company_name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--rw-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {application.job_title}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--rw-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={metaParts.join(" · ")}
          >
            {metaParts.join(" · ")}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: deadlineNumericColor[deadline.tone],
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
            }}
          >
            {deadline.label}
          </span>
          {deadline.detail ? (
            <span
              style={{
                fontSize: 11,
                color: "var(--rw-muted)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {deadline.detail}
            </span>
          ) : null}
        </div>

        <div
          style={{
            textAlign: "right",
            fontSize: 11,
            color: "var(--rw-muted)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatDateTime(application.updated_at)}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        className="rw-application-modal"
        aria-labelledby={`application-modal-title-${application.id}`}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxHeight: "80vh",
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
                id={`application-modal-title-${application.id}`}
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--rw-foreground)",
                  letterSpacing: "-0.01em",
                }}
              >
                {application.company_name}
              </h2>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: "var(--rw-muted)",
                }}
              >
                {application.job_title}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <StatusBadge label={application.source_name} tone="neutral" />
                <StatusBadge
                  label={methodLabel}
                  tone={isCoverLetter ? "warning" : "info"}
                />
                <StatusBadge
                  label={getApplicationStatusLabel(application.status)}
                  tone={toneForStatus(application.status)}
                />
                <span style={{ ...modalChipBase, ...modalChipPalette[deadline.tone] }}>
                  {deadline.label}
                </span>
              </div>
            </div>
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setIsOpen(false)}
              style={{
                appearance: "none",
                background: "transparent",
                border: "none",
                fontSize: 22,
                lineHeight: 1,
                color: "var(--rw-muted)",
                cursor: "pointer",
                padding: 4,
                marginTop: -4,
                marginRight: -4,
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              padding: "20px 24px",
              overflowY: "auto",
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              columnGap: 24,
              rowGap: 16,
            }}
          >
            <div
              style={{
                gridColumn: "1 / -1",
                padding: "12px 14px",
                border: "1px solid var(--rw-border)",
                borderRadius: 4,
                backgroundColor: "var(--rw-subtle)",
              }}
            >
              <ActionToastForm
                action={updateApplicationStatusAction}
                errorMessage="지원 상태 변경에 실패했습니다."
                successMessage="지원 상태를 변경했습니다."
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <input type="hidden" name="applicationId" value={application.id} />
                <label
                  style={{
                    display: "flex",
                    minWidth: 180,
                    flex: "1 1 180px",
                    flexDirection: "column",
                    gap: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--rw-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  상태 빠른 변경
                  <select
                    name="status"
                    defaultValue={application.status}
                    style={{
                      height: 30,
                      border: "1px solid var(--rw-border)",
                      borderRadius: 2,
                      backgroundColor: "#ffffff",
                      color: "var(--rw-foreground)",
                      fontSize: 12,
                      padding: "6px 10px",
                    }}
                  >
                    {modalStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <ActionToastSubmitButton
                  pendingLabel="변경 중..."
                  style={{
                    ...secondaryButtonStyle,
                    borderColor: "var(--rw-accent)",
                    color: "var(--rw-accent)",
                  }}
                >
                  상태 변경
                </ActionToastSubmitButton>
              </ActionToastForm>
            </div>
            <div>
              <div style={detailLabelStyle}>플랫폼</div>
              <div style={detailValueStyle}>{application.source_name}</div>
            </div>
            <div>
              <div style={detailLabelStyle}>이력서 템플릿</div>
              <div style={detailValueStyle}>{templateLabel}</div>
            </div>
            <div>
              <div style={detailLabelStyle}>스냅샷 제목</div>
              <div style={detailValueStyle}>
                {application.resume_snapshot_title || "-"}
              </div>
            </div>
            <div>
              <div style={detailLabelStyle}>마감일</div>
              <div style={detailValueStyle}>
                {deadline.detail ?? application.apply_period_raw_snapshot ?? "-"}
              </div>
            </div>
            <div>
              <div style={detailLabelStyle}>지원일</div>
              <div style={detailValueStyle}>
                {application.applied_at ? formatDateTime(application.applied_at) : "-"}
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={detailLabelStyle}>메모</div>
              <div
                style={{
                  ...detailValueStyle,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  color: application.note ? "var(--rw-foreground)" : "var(--rw-muted)",
                }}
              >
                {application.note || "작성된 메모가 없습니다."}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 24px",
              borderTop: "1px solid var(--rw-border)",
              backgroundColor: "var(--rw-table-header)",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "var(--rw-muted)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              최근 업데이트 · {formatDateTime(application.updated_at)}
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <a
                href={application.detail_url}
                target="_blank"
                rel="noreferrer"
                style={secondaryButtonStyle}
              >
                공고 원문
              </a>
              {application.external_apply_url ? (
                <a
                  href={application.external_apply_url}
                  target="_blank"
                  rel="noreferrer"
                  style={secondaryButtonStyle}
                >
                  제출 링크
                </a>
              ) : null}
              <Link href={`/applications/${application.id}`} style={primaryButtonStyle}>
                상세 관리
              </Link>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
