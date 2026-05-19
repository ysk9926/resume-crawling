"use client";

import { useState } from "react";

import { secondaryButtonStyle } from "@/components/ui/primitives";

export function CopyTextButton({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={secondaryButtonStyle}
    >
      {copied ? "복사됨" : label}
    </button>
  );
}
