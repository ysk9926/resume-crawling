"use client";

import { REMEMBER_COMPANY_SIZE_OPTIONS } from "@/lib/remember";
import type { RememberFilterFormState } from "@/lib/remember";

type RememberSyncPanelProps = {
  sourceUrl: string;
  state: RememberFilterFormState;
  updateState: (patch: Partial<RememberFilterFormState>) => void;
};

export function RememberSyncPanel({
  sourceUrl,
  state,
  updateState,
}: RememberSyncPanelProps) {
  const toggleCompanySize = (value: string) => {
    updateState({
      companySizes: state.companySizes.includes(value)
        ? state.companySizes.filter((item) => item !== value)
        : [...state.companySizes, value],
    });
  };

  return (
    <div className="admin-card admin-stack">
      <div className="section-kicker">Remember Filters</div>
      <div className="form-grid">
        <label className="field-label">
          키워드
          <input
            className="admin-input"
            onChange={(event) => updateState({ keywordInput: event.target.value })}
            placeholder="백엔드, 데이터, AI"
            type="text"
            value={state.keywordInput}
          />
        </label>

        <label className="field-label">
          최소 연봉(만원)
          <input
            className="admin-input"
            inputMode="numeric"
            min={0}
            onChange={(event) => updateState({ minSalaryInput: event.target.value })}
            placeholder="6000"
            type="number"
            value={state.minSalaryInput}
          />
        </label>

        <label className="field-label">
          최대 연봉(만원)
          <input
            className="admin-input"
            inputMode="numeric"
            min={0}
            onChange={(event) => updateState({ maxSalaryInput: event.target.value })}
            placeholder="10000"
            type="number"
            value={state.maxSalaryInput}
          />
        </label>

        <label className="field-label span-2">
          지역
          <textarea
            className="admin-textarea"
            onChange={(event) => updateState({ addressInput: event.target.value })}
            placeholder={"서울특별시/강남구\n경기도/성남시"}
            rows={3}
            value={state.addressInput}
          />
        </label>

        <label className="field-label">
          경력
          <select
            className="admin-input"
            onChange={(event) =>
              updateState({ careerMode: event.target.value as "all" | "irrelevant" })
            }
            value={state.careerMode}
          >
            <option value="all">전체</option>
            <option value="irrelevant">경력 무관만</option>
          </select>
        </label>

        <label className="field-label span-2">
          산업/업종
          <textarea
            className="admin-textarea"
            onChange={(event) => updateState({ industryInput: event.target.value })}
            placeholder={"IT·통신 > AI/데이터 > 데이터 분석\n제조 > 전기·전자 > 반도체"}
            rows={3}
            value={state.industryInput}
          />
        </label>
      </div>

      <div className="admin-stack">
        <span className="field-caption">기업 유형</span>
        <div className="checkbox-grid">
          {REMEMBER_COMPANY_SIZE_OPTIONS.map((option) => (
            <label key={option.value} className="checkbox-chip">
              <input
                checked={state.companySizes.includes(option.value)}
                onChange={() => toggleCompanySize(option.value)}
                type="checkbox"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="checkbox-grid">
        <label className="checkbox-chip">
          <input
            checked={state.leaderPositionOnly}
            onChange={(event) => updateState({ leaderPositionOnly: event.target.checked })}
            type="checkbox"
          />
          <span>리더급 포지션만</span>
        </label>
        <label className="checkbox-chip">
          <input
            checked={state.includeHeadhunter}
            onChange={(event) => updateState({ includeHeadhunter: event.target.checked })}
            type="checkbox"
          />
          <span>헤드헌팅 포함</span>
        </label>
        <label className="checkbox-chip">
          <input
            checked={state.simpleApplyOnly}
            onChange={(event) => updateState({ simpleApplyOnly: event.target.checked })}
            type="checkbox"
          />
          <span>간편 지원만</span>
        </label>
        <label className="checkbox-chip">
          <input
            checked={state.includeApplied}
            onChange={(event) => updateState({ includeApplied: event.target.checked })}
            type="checkbox"
          />
          <span>지원한 공고 포함</span>
        </label>
      </div>

      <div className="inline-link-row">
        <a
          className="admin-button ghost"
          href={sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          리멤버 검색 페이지 열기
        </a>
      </div>
    </div>
  );
}
