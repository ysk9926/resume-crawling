import type {
  JobKoreaFilterOption,
  JobKoreaSearchFilters,
} from "@/lib/types";

export type JobKoreaFilterFormState = {
  duties: string[];
  dutyKeywordInput: string;
  locals: string[];
  careerCodes: string[];
  careerStartInput: string;
  careerEndInput: string;
  educationCodes: string[];
  companyTypeCodes: string[];
  jobTypeCodes: string[];
  industryCodes: string[];
  industryKeywordInput: string;
  positionCodes: string[];
  salaryCodes: string[];
  salaryType: string;
  salaryInput: string;
  majorCodes: string[];
  licenseCodes: string[];
  preferenceCodes: string[];
  welfareCodes: string[];
  includeKeywordInput: string;
  excludeKeywordInput: string;
  directApplyOnly: boolean;
  excludeConfirmedPostings: boolean;
};

export const defaultJobKoreaFilterFormState: JobKoreaFilterFormState = {
  duties: [],
  dutyKeywordInput: "",
  locals: [],
  careerCodes: [],
  careerStartInput: "",
  careerEndInput: "",
  educationCodes: [],
  companyTypeCodes: [],
  jobTypeCodes: [],
  industryCodes: [],
  industryKeywordInput: "",
  positionCodes: [],
  salaryCodes: [],
  salaryType: "1",
  salaryInput: "",
  majorCodes: [],
  licenseCodes: [],
  preferenceCodes: [],
  welfareCodes: [],
  includeKeywordInput: "",
  excludeKeywordInput: "",
  directApplyOnly: false,
  excludeConfirmedPostings: false,
};

export type FlatJobKoreaOption = {
  value: string;
  label: string;
};

function splitListValue(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

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

function appendFlatOptions(
  items: JobKoreaFilterOption[],
  output: FlatJobKoreaOption[],
  prefix = "",
) {
  for (const item of items) {
    const label = prefix ? `${prefix} > ${item.label}` : item.label;
    if (!item.children?.length) {
      output.push({ value: item.code, label });
      continue;
    }

    if (!item.code.startsWith("group:")) {
      output.push({ value: item.code, label: `${label} (전체)` });
    }
    appendFlatOptions(item.children, output, item.label);
  }
}

export function flattenJobKoreaOptions(items: JobKoreaFilterOption[]) {
  const output: FlatJobKoreaOption[] = [];
  appendFlatOptions(items, output);
  return output;
}

export function buildJobKoreaSearchFilters(
  state: JobKoreaFilterFormState,
): JobKoreaSearchFilters | undefined {
  const filters: JobKoreaSearchFilters = {
    ...(state.duties.length ? { duties: state.duties } : {}),
    ...(state.dutyKeywordInput.trim()
      ? { duty_keywords: splitListValue(state.dutyKeywordInput) }
      : {}),
    ...(state.locals.length ? { locals: state.locals } : {}),
    ...(state.careerCodes.length ? { career_codes: state.careerCodes } : {}),
    ...(state.careerStartInput.trim()
      ? { career_start: parseOptionalNumber(state.careerStartInput, "경력 시작") }
      : {}),
    ...(state.careerEndInput.trim()
      ? { career_end: parseOptionalNumber(state.careerEndInput, "경력 종료") }
      : {}),
    ...(state.educationCodes.length ? { education_codes: state.educationCodes } : {}),
    ...(state.companyTypeCodes.length
      ? { company_type_codes: state.companyTypeCodes }
      : {}),
    ...(state.jobTypeCodes.length ? { job_type_codes: state.jobTypeCodes } : {}),
    ...(state.industryCodes.length ? { industry_codes: state.industryCodes } : {}),
    ...(state.industryKeywordInput.trim()
      ? { industry_keywords: splitListValue(state.industryKeywordInput) }
      : {}),
    ...(state.positionCodes.length ? { position_codes: state.positionCodes } : {}),
    ...(state.salaryCodes.length ? { salary_codes: state.salaryCodes } : {}),
    ...(state.salaryType.trim() ? { salary_type: state.salaryType } : {}),
    ...(state.salaryInput.trim()
      ? { salary_input: parseOptionalNumber(state.salaryInput, "급여 입력") }
      : {}),
    ...(state.majorCodes.length ? { major_codes: state.majorCodes } : {}),
    ...(state.licenseCodes.length ? { license_codes: state.licenseCodes } : {}),
    ...(state.preferenceCodes.length ? { preference_codes: state.preferenceCodes } : {}),
    ...(state.welfareCodes.length ? { welfare_codes: state.welfareCodes } : {}),
    ...(state.includeKeywordInput.trim()
      ? { include_keywords: splitListValue(state.includeKeywordInput) }
      : {}),
    ...(state.excludeKeywordInput.trim()
      ? { exclude_keywords: splitListValue(state.excludeKeywordInput) }
      : {}),
    ...(state.directApplyOnly ? { direct_apply_only: true } : {}),
    ...(state.excludeConfirmedPostings
      ? { exclude_confirmed_postings: true }
      : {}),
  };

  if (
    filters.career_start !== undefined &&
    filters.career_end !== undefined &&
    filters.career_end < filters.career_start
  ) {
    throw new Error("경력 종료값은 시작값보다 크거나 같아야 합니다.");
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

export function buildJobKoreaSearchUrl(baseUrl: string, filters?: JobKoreaSearchFilters) {
  const params = new URLSearchParams();
  params.set("menucode", "search");

  if (!filters) {
    return `${baseUrl}?${params.toString()}`;
  }

  if (filters.duties?.length) {
    params.set("duty", filters.duties.join(","));
  }
  if (filters.locals?.length) {
    params.set("local", filters.locals.join(","));
  }
  if (filters.career_codes?.length) {
    params.set("career", filters.career_codes.join(","));
  }
  if (filters.career_start !== undefined) {
    params.set("careerStart", String(filters.career_start));
  }
  if (filters.career_end !== undefined) {
    params.set("careerEnd", String(filters.career_end));
  }
  if (filters.education_codes?.length) {
    params.set("edu", filters.education_codes.join(","));
  }
  if (filters.company_type_codes?.length) {
    params.set("cotype", filters.company_type_codes.join(","));
  }
  if (filters.job_type_codes?.length) {
    params.set("jobtype", filters.job_type_codes.join(","));
  }
  if (filters.industry_codes?.length) {
    params.set("industry", filters.industry_codes.join(","));
  }
  if (filters.position_codes?.length) {
    params.set("position", filters.position_codes.join(","));
  }
  if (filters.salary_codes?.length) {
    params.set("pay", filters.salary_codes.join(","));
  }
  if (filters.salary_type) {
    params.set("paytype", filters.salary_type);
  }
  if (filters.salary_input !== undefined) {
    params.set("payinput", String(filters.salary_input));
  }
  if (filters.major_codes?.length) {
    params.set("major", filters.major_codes.join(","));
  }
  if (filters.license_codes?.length) {
    params.set("license", filters.license_codes.join(","));
  }
  if (filters.preference_codes?.length) {
    params.set("pref", filters.preference_codes.join(","));
  }
  if (filters.welfare_codes?.length) {
    params.set("wel", filters.welfare_codes.join(","));
  }
  if (filters.include_keywords?.length) {
    params.set("textinclude", filters.include_keywords.join(","));
  }
  if (filters.exclude_keywords?.length) {
    params.set("textexclude", filters.exclude_keywords.join(","));
  }
  if (filters.duty_keywords?.length) {
    params.set("dkwrd", filters.duty_keywords.join(","));
  }
  if (filters.industry_keywords?.length) {
    params.set("ikwrd", filters.industry_keywords.join(","));
  }
  if (filters.direct_apply_only) {
    params.set("direct", "1");
  }
  if (filters.exclude_confirmed_postings) {
    params.set("confirm", "1");
  }

  return `${baseUrl}?${params.toString()}`;
}
