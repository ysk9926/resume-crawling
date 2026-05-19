import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

type MasterResumeTemplate = {
  title: string;
  summary: string;
  content: string;
};

function parseFrontmatter(raw: string): MasterResumeTemplate {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Master resume template frontmatter is missing");
  }

  const metadata = new Map<string, string>();
  for (const line of match[1].split("\n")) {
    const [key, ...rest] = line.split(":");
    if (!key || rest.length === 0) {
      continue;
    }
    metadata.set(key.trim(), rest.join(":").trim());
  }

  const title = metadata.get("title");
  const summary = metadata.get("summary");
  if (!title || !summary) {
    throw new Error("Master resume template requires title and summary");
  }

  return {
    title,
    summary,
    content: match[2].trim(),
  };
}

const templatePath = path.join(process.cwd(), "lib", "master-resume-template.md");

export const masterResumeTemplate = parseFrontmatter(
  readFileSync(templatePath, "utf8"),
);
