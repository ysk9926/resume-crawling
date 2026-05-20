import type {
  RememberAddressFilter,
  RememberIndustryFilter,
  RememberSearchFilters,
} from "@/lib/types";

export const REMEMBER_COMPANY_SIZE_OPTIONS = [
  { value: "large", label: "대기업" },
  { value: "middle_standing", label: "중견기업" },
  { value: "small_medium", label: "중소기업" },
  { value: "startup", label: "스타트업" },
  { value: "foreign", label: "외국계 기업" },
] as const;

export type RememberFilterFormState = {
  keywordInput: string;
  minSalaryInput: string;
  maxSalaryInput: string;
  addressInput: string;
  industryInput: string;
  careerMode: "all" | "irrelevant";
  companySizes: string[];
  leaderPositionOnly: boolean;
  includeHeadhunter: boolean;
  simpleApplyOnly: boolean;
  includeApplied: boolean;
};

export const defaultRememberFilterFormState: RememberFilterFormState = {
  keywordInput: "",
  minSalaryInput: "",
  maxSalaryInput: "",
  addressInput: "",
  industryInput: "",
  careerMode: "all",
  companySizes: [],
  leaderPositionOnly: false,
  includeHeadhunter: true,
  simpleApplyOnly: false,
  includeApplied: false,
};

function parseOptionalNumber(value: string, fieldName: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName}는 0 이상의 정수여야 합니다.`);
  }
  return parsed;
}

function splitListValue(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAddressFilters(value: string): RememberAddressFilter[] | undefined {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return undefined;
  }

  return lines.map((line) => {
    const parts = line
      .split(/[>,/]/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0 || parts.length > 2) {
      throw new Error("지역은 한 줄에 `시/도/구/군` 형식으로 입력해 주세요.");
    }

    return {
      level1: parts[0],
      ...(parts[1] ? { level2: parts[1] } : {}),
    };
  });
}

function parseIndustryFilters(value: string): RememberIndustryFilter[] | undefined {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return undefined;
  }

  return lines.map((line) => {
    const parts = line
      .split(">")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0 || parts.length > 3) {
      throw new Error("산업/업종은 한 줄에 `대분류 > 중분류 > 소분류` 형식으로 입력해 주세요.");
    }

    return {
      level1: parts[0],
      ...(parts[1] ? { level2: parts[1] } : {}),
      ...(parts[2] ? { level3: parts[2] } : {}),
    };
  });
}

export function buildRememberSearchFilters(
  state: RememberFilterFormState,
): RememberSearchFilters | undefined {
  const keywords = splitListValue(state.keywordInput);
  const filters: RememberSearchFilters = {
    ...(keywords.length ? { keywords } : {}),
    ...(state.minSalaryInput.trim()
      ? { min_salary: parseOptionalNumber(state.minSalaryInput, "최소 연봉") }
      : {}),
    ...(state.maxSalaryInput.trim()
      ? { max_salary: parseOptionalNumber(state.maxSalaryInput, "최대 연봉") }
      : {}),
    ...(state.addressInput.trim()
      ? { addresses: parseAddressFilters(state.addressInput) }
      : {}),
    ...(state.industryInput.trim()
      ? { industry_v2_names: parseIndustryFilters(state.industryInput) }
      : {}),
    ...(state.careerMode === "irrelevant" ? { career_year: -1 } : {}),
    ...(state.companySizes.length ? { company_sizes: state.companySizes } : {}),
    ...(state.leaderPositionOnly ? { leader_position: true } : {}),
    ...(!state.includeHeadhunter ? { organization_type: "without_headhunter" as const } : {}),
    ...(state.simpleApplyOnly ? { application_type: "apply" as const } : {}),
    ...(state.includeApplied ? { include_applied_job_posting: true } : {}),
  };

  if (
    filters.min_salary !== undefined &&
    filters.max_salary !== undefined &&
    filters.max_salary < filters.min_salary
  ) {
    throw new Error("최대 연봉은 최소 연봉보다 크거나 같아야 합니다.");
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

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
