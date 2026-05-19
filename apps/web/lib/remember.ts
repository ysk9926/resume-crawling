import type { RememberIndustryFilter, RememberSearchFilters } from "@/lib/types";

export const REMEMBER_COMPANY_SIZE_OPTIONS = [
  { value: "large", label: "대기업" },
  { value: "middle_standing", label: "중견기업" },
  { value: "small_medium", label: "중소기업" },
  { value: "startup", label: "스타트업" },
  { value: "foreign", label: "외국계 기업" },
] as const;

function toRememberPageSearch(filters?: RememberSearchFilters) {
  const normalized = filters ?? {};
  const search = {
    ...(normalized.keywords?.length ? { keywords: normalized.keywords } : {}),
    ...(normalized.min_salary !== undefined ? { minSalary: normalized.min_salary } : {}),
    ...(normalized.max_salary !== undefined ? { maxSalary: normalized.max_salary } : {}),
    ...(normalized.addresses?.length
      ? {
          addresses: normalized.addresses.map((item) =>
            item.level2 ? [item.level1, item.level2] : [item.level1],
          ),
        }
      : {}),
    ...(normalized.career_year !== undefined ? { careerYear: normalized.career_year } : {}),
    ...(normalized.company_sizes?.length ? { companySizes: normalized.company_sizes } : {}),
    ...(normalized.industry_v2_names?.length
      ? {
          industryV2Names: normalized.industry_v2_names.map((item) => compactIndustryPath(item)),
        }
      : {}),
    ...(normalized.leader_position ? { leaderPosition: true } : {}),
    ...(normalized.organization_type ? { organizationType: normalized.organization_type } : {}),
    ...(normalized.application_type ? { applicationType: normalized.application_type } : {}),
    ...(normalized.include_applied_job_posting
      ? { includeAppliedJobPosting: true }
      : {}),
  };

  return search;
}

function compactIndustryPath(item: RememberIndustryFilter) {
  return {
    level1: item.level1,
    ...(item.level2 ? { level2: item.level2 } : {}),
    ...(item.level3 ? { level3: item.level3 } : {}),
  };
}

export function buildRememberSearchUrl(baseUrl: string, filters?: RememberSearchFilters) {
  const search = toRememberPageSearch(filters);
  if (Object.keys(search).length === 0) {
    return baseUrl;
  }

  const params = new URLSearchParams();
  params.set("search", JSON.stringify(search));
  return `${baseUrl}?${params.toString()}`;
}
