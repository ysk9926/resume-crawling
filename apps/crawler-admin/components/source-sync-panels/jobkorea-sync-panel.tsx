"use client";

import { useMemo } from "react";

import { flattenJobKoreaOptions } from "@/lib/jobkorea";
import type { JobKoreaFilterFormState } from "@/lib/jobkorea";
import type { SourceFilterOptions } from "@/lib/types";

type JobKoreaSyncPanelProps = {
  filterOptions: SourceFilterOptions | null;
  isLoadingOptions: boolean;
  sourceUrl: string;
  state: JobKoreaFilterFormState;
  updateState: (patch: Partial<JobKoreaFilterFormState>) => void;
};

type MultiSelectFieldProps = {
  label: string;
  options: Array<{ value: string; label: string }>;
  size?: number;
  values: string[];
  onChange: (values: string[]) => void;
};

function MultiSelectField({
  label,
  options,
  size = 8,
  values,
  onChange,
}: MultiSelectFieldProps) {
  return (
    <label className="field-label">
      {label}
      <select
        className="admin-input"
        multiple
        onChange={(event) =>
          onChange(Array.from(event.currentTarget.selectedOptions, (option) => option.value))
        }
        size={Math.min(Math.max(size, 4), 14)}
        value={values}
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="field-caption">Cmd/Ctrl + 클릭으로 여러 항목을 선택할 수 있습니다.</span>
    </label>
  );
}

export function JobKoreaSyncPanel({
  filterOptions,
  isLoadingOptions,
  sourceUrl,
  state,
  updateState,
}: JobKoreaSyncPanelProps) {
  const dutyOptions = useMemo(
    () => flattenJobKoreaOptions(filterOptions?.duties ?? []),
    [filterOptions],
  );
  const localOptions = useMemo(
    () => flattenJobKoreaOptions(filterOptions?.locals ?? []),
    [filterOptions],
  );
  const careerOptions = useMemo(
    () => flattenJobKoreaOptions(filterOptions?.careers ?? []),
    [filterOptions],
  );
  const educationOptions = useMemo(
    () => flattenJobKoreaOptions(filterOptions?.educations ?? []),
    [filterOptions],
  );
  const companyTypeOptions = useMemo(
    () => flattenJobKoreaOptions(filterOptions?.company_types ?? []),
    [filterOptions],
  );
  const jobTypeOptions = useMemo(
    () => flattenJobKoreaOptions(filterOptions?.job_types ?? []),
    [filterOptions],
  );
  const industryOptions = useMemo(
    () => flattenJobKoreaOptions(filterOptions?.industries ?? []),
    [filterOptions],
  );
  const positionOptions = useMemo(
    () => flattenJobKoreaOptions(filterOptions?.positions ?? []),
    [filterOptions],
  );
  const salaryRangeOptions = useMemo(
    () => flattenJobKoreaOptions(filterOptions?.salary_ranges ?? []),
    [filterOptions],
  );
  const salaryTypeOptions = useMemo(
    () => flattenJobKoreaOptions(filterOptions?.salary_types ?? []),
    [filterOptions],
  );
  const majorOptions = useMemo(
    () => flattenJobKoreaOptions(filterOptions?.majors ?? []),
    [filterOptions],
  );
  const licenseOptions = useMemo(
    () => flattenJobKoreaOptions(filterOptions?.licenses ?? []),
    [filterOptions],
  );
  const preferenceOptions = useMemo(
    () => flattenJobKoreaOptions(filterOptions?.preferences ?? []),
    [filterOptions],
  );
  const welfareOptions = useMemo(
    () => flattenJobKoreaOptions(filterOptions?.welfare ?? []),
    [filterOptions],
  );

  return (
    <div className="admin-card admin-stack">
      <div className="section-kicker">JobKorea Filters</div>

      {isLoadingOptions ? (
        <p className="muted-copy">잡코리아 필터 옵션을 불러오는 중입니다...</p>
      ) : null}

      <div className="form-grid">
        <MultiSelectField
          label="직무"
          onChange={(values) => updateState({ duties: values })}
          options={dutyOptions}
          values={state.duties}
        />
        <label className="field-label">
          직무 키워드
          <input
            className="admin-input"
            onChange={(event) => updateState({ dutyKeywordInput: event.target.value })}
            placeholder="백엔드, 데이터 엔지니어"
            type="text"
            value={state.dutyKeywordInput}
          />
        </label>

        <MultiSelectField
          label="근무지역"
          onChange={(values) => updateState({ locals: values })}
          options={localOptions}
          values={state.locals}
        />
        <label className="field-label">
          경력 범위(년)
          <div className="range-group">
            <input
              className="admin-input narrow"
              min={0}
              onChange={(event) => updateState({ careerStartInput: event.target.value })}
              placeholder="시작"
              type="number"
              value={state.careerStartInput}
            />
            <input
              className="admin-input narrow"
              min={0}
              onChange={(event) => updateState({ careerEndInput: event.target.value })}
              placeholder="종료"
              type="number"
              value={state.careerEndInput}
            />
          </div>
        </label>

        <MultiSelectField
          label="경력 구간"
          onChange={(values) => updateState({ careerCodes: values })}
          options={careerOptions}
          size={6}
          values={state.careerCodes}
        />
        <MultiSelectField
          label="학력"
          onChange={(values) => updateState({ educationCodes: values })}
          options={educationOptions}
          size={6}
          values={state.educationCodes}
        />

        <MultiSelectField
          label="기업형태"
          onChange={(values) => updateState({ companyTypeCodes: values })}
          options={companyTypeOptions}
          size={8}
          values={state.companyTypeCodes}
        />
        <MultiSelectField
          label="고용형태"
          onChange={(values) => updateState({ jobTypeCodes: values })}
          options={jobTypeOptions}
          size={8}
          values={state.jobTypeCodes}
        />

        <MultiSelectField
          label="산업"
          onChange={(values) => updateState({ industryCodes: values })}
          options={industryOptions}
          values={state.industryCodes}
        />
        <label className="field-label">
          산업 키워드
          <input
            className="admin-input"
            onChange={(event) => updateState({ industryKeywordInput: event.target.value })}
            placeholder="핀테크, 헬스케어"
            type="text"
            value={state.industryKeywordInput}
          />
        </label>

        <MultiSelectField
          label="직급/직책"
          onChange={(values) => updateState({ positionCodes: values })}
          options={positionOptions}
          size={8}
          values={state.positionCodes}
        />
        <MultiSelectField
          label="연봉 구간"
          onChange={(values) => updateState({ salaryCodes: values })}
          options={salaryRangeOptions}
          size={6}
          values={state.salaryCodes}
        />

        <label className="field-label">
          급여 직접입력(만원 이상)
          <div className="range-group">
            <select
              className="admin-input"
              onChange={(event) => updateState({ salaryType: event.target.value })}
              value={state.salaryType}
            >
              {salaryTypeOptions.map((option) => (
                <option key={`salary-type-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              className="admin-input"
              min={0}
              onChange={(event) => updateState({ salaryInput: event.target.value })}
              placeholder="350"
              type="number"
              value={state.salaryInput}
            />
          </div>
        </label>

        <MultiSelectField
          label="우대전공"
          onChange={(values) => updateState({ majorCodes: values })}
          options={majorOptions}
          size={10}
          values={state.majorCodes}
        />
        <MultiSelectField
          label="자격증"
          onChange={(values) => updateState({ licenseCodes: values })}
          options={licenseOptions}
          size={10}
          values={state.licenseCodes}
        />

        <MultiSelectField
          label="우대조건"
          onChange={(values) => updateState({ preferenceCodes: values })}
          options={preferenceOptions}
          size={10}
          values={state.preferenceCodes}
        />
        <MultiSelectField
          label="복리후생"
          onChange={(values) => updateState({ welfareCodes: values })}
          options={welfareOptions}
          size={10}
          values={state.welfareCodes}
        />

        <label className="field-label">
          포함 키워드
          <textarea
            className="admin-textarea"
            onChange={(event) => updateState({ includeKeywordInput: event.target.value })}
            placeholder={"Python\nFastAPI"}
            rows={3}
            value={state.includeKeywordInput}
          />
        </label>
        <label className="field-label">
          제외 키워드
          <textarea
            className="admin-textarea"
            onChange={(event) => updateState({ excludeKeywordInput: event.target.value })}
            placeholder={"SI\n파견"}
            rows={3}
            value={state.excludeKeywordInput}
          />
        </label>
      </div>

      <div className="checkbox-grid">
        <label className="checkbox-chip">
          <input
            checked={state.directApplyOnly}
            onChange={(event) => updateState({ directApplyOnly: event.target.checked })}
            type="checkbox"
          />
          <span>즉시지원만</span>
        </label>
        <label className="checkbox-chip">
          <input
            checked={state.excludeConfirmedPostings}
            onChange={(event) =>
              updateState({ excludeConfirmedPostings: event.target.checked })
            }
            type="checkbox"
          />
          <span>확인한 공고 제외</span>
        </label>
      </div>

      <div className="inline-link-row">
        <a
          className="admin-button ghost"
          href={sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          잡코리아 검색 페이지 열기
        </a>
      </div>
    </div>
  );
}
