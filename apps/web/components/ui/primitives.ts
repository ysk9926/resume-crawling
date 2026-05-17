import type { CSSProperties } from "react";

export const pageBodyStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  minWidth: 0,
};

export const sectionTitleStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--rw-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: 0,
};

export const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 24px",
  borderBottom: "1px solid var(--rw-border)",
  backgroundColor: "var(--rw-table-header)",
};

export const thStyle: CSSProperties = {
  backgroundColor: "var(--rw-table-header)",
  color: "var(--rw-muted)",
  fontWeight: 600,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  padding: "8px 14px",
  textAlign: "left",
  borderBottom: "1px solid var(--rw-border)",
  position: "sticky",
  top: 0,
  zIndex: 1,
};

export const tdStyle: CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid var(--rw-border)",
  color: "var(--rw-foreground)",
  verticalAlign: "middle",
  fontSize: 12,
};

export const inputStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 2,
  border: "1px solid var(--rw-border)",
  fontSize: 12,
  backgroundColor: "#ffffff",
  color: "var(--rw-foreground)",
  outline: "none",
  height: 30,
};

export const textareaStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 2,
  border: "1px solid var(--rw-border)",
  fontSize: 12,
  backgroundColor: "#ffffff",
  color: "var(--rw-foreground)",
  outline: "none",
  lineHeight: 1.6,
  fontFamily: "var(--font-sans)",
  width: "100%",
  resize: "vertical",
};

export const monoTextareaStyle: CSSProperties = {
  ...textareaStyle,
  fontFamily: "var(--font-mono)",
};

export const primaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "6px 14px",
  height: 30,
  borderRadius: 2,
  border: "none",
  backgroundColor: "var(--rw-accent)",
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export const secondaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "6px 14px",
  height: 30,
  borderRadius: 2,
  border: "1px solid var(--rw-border)",
  backgroundColor: "#ffffff",
  color: "var(--rw-foreground)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  whiteSpace: "nowrap",
  textDecoration: "none",
};

export const ghostLinkStyle: CSSProperties = {
  ...secondaryButtonStyle,
  color: "var(--rw-muted)",
};
