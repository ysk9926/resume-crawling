const postingCurationLabels: Record<string, string> = {
  new: "검토 전",
  interesting: "관심",
  ignored: "제외",
};

const applicationStatusLabels: Record<string, string> = {
  planned: "지원 예정",
  applied: "지원 완료",
  document_passed: "서류 통과",
  interview: "면접 진행",
  offer: "오퍼",
  rejected: "불합격",
  withdrawn: "철회",
};

export function getPostingCurationLabel(status: string): string {
  return postingCurationLabels[status] ?? status;
}

export function getApplicationStatusLabel(status: string): string {
  return applicationStatusLabels[status] ?? status;
}
