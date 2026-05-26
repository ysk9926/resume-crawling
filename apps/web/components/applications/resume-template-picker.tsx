"use client";

import { useState } from "react";

import { inputStyle, secondaryButtonStyle } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast-provider";
import type { ResumeTemplate } from "@/lib/types";

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 10,
  fontWeight: 700,
  color: "var(--rw-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

type Props = {
  templates: ResumeTemplate[];
  defaultTemplateId: number | null;
  resumeTitleInputName: string;
  resumeMarkdownTextareaName: string;
};

export function ResumeTemplatePicker({
  templates,
  defaultTemplateId,
  resumeTitleInputName,
  resumeMarkdownTextareaName,
}: Props) {
  const showToast = useToast();
  const [selectedId, setSelectedId] = useState<string>(
    defaultTemplateId !== null ? String(defaultTemplateId) : "",
  );

  function handleLoad() {
    if (!selectedId) return;
    const template = templates.find((item) => String(item.id) === selectedId);
    if (!template) return;

    const titleInput = document.querySelector<HTMLInputElement>(
      `input[name="${resumeTitleInputName}"]`,
    );
    const markdownTextarea = document.querySelector<HTMLTextAreaElement>(
      `textarea[name="${resumeMarkdownTextareaName}"]`,
    );

    if (titleInput) {
      titleInput.value = template.title;
    }
    if (markdownTextarea) {
      markdownTextarea.value = template.markdown_content;
    }
    showToast({
      title: "이력서 본문을 불러왔습니다.",
      description: template.title,
      tone: "success",
    });
  }

  return (
    <label style={labelStyle}>
      이력서 템플릿
      <div style={{ display: "flex", gap: 6 }}>
        <select
          name="resumeTemplateId"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        >
          <option value="">미연결</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleLoad}
          disabled={!selectedId}
          style={{ ...secondaryButtonStyle, opacity: selectedId ? 1 : 0.5 }}
        >
          본문 불러오기
        </button>
      </div>
    </label>
  );
}
