from __future__ import annotations

from datetime import date
from urllib.parse import urlsplit
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.crawlers.base import CrawledJobPosting
from app.crawlers.registry import get_crawler
from app.models import (
    Application,
    CoverLetterItem,
    CoverLetterTag,
    JobPosting,
    JobSyncRun,
    ResumeTemplate,
    Source,
    utcnow,
)
from app.services.cache import invalidate_read_caches
from app.utils.text import build_source_key, derive_tags, normalize_label, normalize_whitespace


def upsert_postings(
    session: Session,
    source: Source,
    crawled_postings: list[CrawledJobPosting],
) -> tuple[int, int]:
    inserted = 0
    updated = 0
    seen_at = utcnow()

    for item in crawled_postings:
        existing = session.scalar(
            select(JobPosting).where(
                JobPosting.source_id == source.id,
                JobPosting.external_id == item.external_id,
            )
        )

        if existing is None:
            session.add(
                JobPosting(
                    source_id=source.id,
                    external_id=item.external_id,
                    company_name=item.company_name,
                    title=item.title,
                    detail_url=item.detail_url,
                    external_apply_url=item.external_apply_url,
                    posted_at=item.posted_at,
                    apply_period_raw=item.apply_period_raw,
                    apply_start_date=item.apply_start_date,
                    apply_end_date=item.apply_end_date,
                    raw_content=item.raw_content,
                    normalized_content=item.normalized_content,
                    tags=item.tags,
                    last_seen_at=seen_at,
                )
            )
            inserted += 1
            continue

        existing.company_name = item.company_name
        existing.title = item.title
        existing.detail_url = item.detail_url
        existing.external_apply_url = item.external_apply_url
        existing.posted_at = item.posted_at
        existing.apply_period_raw = item.apply_period_raw
        existing.apply_start_date = item.apply_start_date
        existing.apply_end_date = item.apply_end_date
        existing.raw_content = item.raw_content
        existing.normalized_content = item.normalized_content
        existing.tags = item.tags
        existing.last_seen_at = seen_at
        updated += 1

    return inserted, updated


def run_source_sync(session: Session, source_key: str, start_page: int, end_page: int) -> JobSyncRun:
    source = session.scalar(select(Source).where(Source.key == source_key))
    if source is None:
        raise ValueError(f"Source not found: {source_key}")
    if not source.supports_sync:
        raise ValueError(f"Source does not support sync: {source_key}")

    sync_run = JobSyncRun(source_id=source.id, status="running")
    session.add(sync_run)
    session.commit()
    session.refresh(sync_run)

    crawler = get_crawler(source_key)
    try:
        crawl_info = crawler.get_crawl_info()
        if start_page < 1:
            raise ValueError("시작 페이지는 1 이상이어야 합니다.")
        if end_page < start_page:
            raise ValueError("종료 페이지는 시작 페이지보다 크거나 같아야 합니다.")
        if end_page > crawl_info.total_pages:
            raise ValueError(
                f"요청한 종료 페이지가 총 페이지 수를 초과했습니다. "
                f"(요청: {end_page}, 총 페이지: {crawl_info.total_pages})"
            )

        crawled_postings = crawler.crawl(start_page=start_page, end_page=end_page)
        inserted_count, updated_count = upsert_postings(session, source, crawled_postings)

        source.last_synced_at = utcnow()
        sync_run.status = "success"
        sync_run.message = (
            f"{start_page}~{end_page}페이지에서 {len(crawled_postings)}개의 공고를 동기화했습니다."
        )
        sync_run.inserted_count = inserted_count
        sync_run.updated_count = updated_count
        sync_run.total_count = len(crawled_postings)
        sync_run.finished_at = utcnow()
        session.commit()
        session.refresh(sync_run)
        invalidate_read_caches()
        return sync_run
    except ValueError as exc:
        session.rollback()
        failed_run = session.get(JobSyncRun, sync_run.id)
        if failed_run is not None:
            failed_run.status = "failed"
            failed_run.message = str(exc)
            failed_run.finished_at = utcnow()
            session.commit()
            session.refresh(failed_run)
            invalidate_read_caches()
        raise
    except Exception as exc:
        session.rollback()
        failed_run = session.get(JobSyncRun, sync_run.id)
        if failed_run is not None:
            failed_run.status = "failed"
            failed_run.message = str(exc)
            failed_run.finished_at = utcnow()
            session.commit()
            session.refresh(failed_run)
            invalidate_read_caches()
            return failed_run
        raise
    finally:
        crawler.close()


def create_or_replace_application(
    session: Session,
    job_posting_id: int,
    resume_template_id: int,
    application_method: str,
    status: str,
    note: str,
    applied_at: date | None = None,
) -> Application:
    posting = session.scalar(
        select(JobPosting)
        .options(joinedload(JobPosting.application))
        .where(JobPosting.id == job_posting_id)
    )
    if posting is None:
        raise ValueError("Job posting not found.")

    template = session.get(ResumeTemplate, resume_template_id)
    if template is None:
        raise ValueError("Resume template not found.")

    snapshot_title = f"{template.title} · {posting.company_name}"
    application = posting.application

    if application is None:
        application = Application(
            job_posting_id=posting.id,
            resume_template_id=template.id,
            application_method=application_method,
            status=status,
            note=note,
            applied_at=applied_at,
            apply_end_date_snapshot=posting.apply_end_date,
            apply_period_raw_snapshot=posting.apply_period_raw,
            resume_snapshot_title=snapshot_title,
            resume_snapshot_markdown=template.markdown_content,
        )
        session.add(application)
    else:
        if application.application_method != application_method:
            raise ValueError("Application method cannot be changed once created.")
        application.resume_template_id = template.id
        application.status = status
        application.note = note
        application.applied_at = applied_at
        application.apply_end_date_snapshot = posting.apply_end_date
        application.apply_period_raw_snapshot = posting.apply_period_raw
        application.resume_snapshot_title = snapshot_title
        application.resume_snapshot_markdown = template.markdown_content

    session.commit()
    session.refresh(application)
    invalidate_read_caches()
    return application


def normalize_manual_tags(title: str, content: str, tags: list[str]) -> list[str]:
    normalized = [normalize_label(tag) for tag in tags if normalize_label(tag)]
    if normalized:
        return list(dict.fromkeys(normalized))
    return derive_tags(title, content)


def derive_source_base_url(*candidates: str | None) -> str:
    for candidate in candidates:
        if not candidate:
            continue
        parsed = urlsplit(candidate)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
        return candidate
    return ""


def resolve_manual_urls(
    detail_url: str | None,
    external_apply_url: str | None,
) -> tuple[str, str | None, str]:
    normalized_detail = normalize_label(detail_url or "") or None
    normalized_external = normalize_label(external_apply_url or "") or None
    resolved_detail = normalized_detail or normalized_external

    if resolved_detail is None:
        raise ValueError("Manual entries require at least one URL.")

    return (
        resolved_detail,
        normalized_external,
        derive_source_base_url(resolved_detail, normalized_external),
    )


def find_or_create_source(
    session: Session,
    platform_name: str,
    base_url: str,
    supports_sync: bool = False,
) -> Source:
    normalized_name = normalize_label(platform_name)
    if not normalized_name:
        raise ValueError("Platform name is required.")

    existing_sources = session.scalars(select(Source).order_by(Source.id)).all()
    for source in existing_sources:
        if source.name.casefold() != normalized_name.casefold():
            continue
        if not source.base_url and base_url:
            source.base_url = base_url
        if supports_sync and not source.supports_sync:
            source.supports_sync = True
        return source

    key_base = build_source_key(normalized_name)
    key = key_base
    suffix = 2
    while session.scalar(select(Source.id).where(Source.key == key)) is not None:
        suffix_label = f"-{suffix}"
        key = f"{key_base[: max(1, 50 - len(suffix_label))]}{suffix_label}"
        suffix += 1

    source = Source(
        key=key,
        name=normalized_name,
        base_url=base_url,
        supports_sync=supports_sync,
    )
    session.add(source)
    session.flush()
    return source


def build_manual_posting(
    session: Session,
    platform_name: str,
    company_name: str,
    title: str,
    detail_url: str | None,
    external_apply_url: str | None,
    posted_at: date | None,
    apply_start_date: date | None,
    apply_end_date: date | None,
    apply_period_raw: str | None,
    normalized_content: str,
    tags: list[str],
    curation_status: str,
    curation_note: str | None,
    is_bookmarked: bool,
    is_todo: bool,
) -> JobPosting:
    normalized_company_name = normalize_label(company_name)
    normalized_title = normalize_label(title)
    if not normalized_company_name:
        raise ValueError("Company name is required.")
    if not normalized_title:
        raise ValueError("Job title is required.")

    resolved_detail_url, resolved_apply_url, base_url = resolve_manual_urls(
        detail_url,
        external_apply_url,
    )
    source = find_or_create_source(
        session,
        platform_name=platform_name,
        base_url=base_url,
        supports_sync=False,
    )
    content = normalize_whitespace(normalized_content)
    bookmarked = is_bookmarked or is_todo
    posting = JobPosting(
        source_id=source.id,
        external_id=f"manual:{uuid4().hex}",
        company_name=normalized_company_name,
        title=normalized_title,
        detail_url=resolved_detail_url,
        external_apply_url=resolved_apply_url,
        ingest_kind="manual",
        posted_at=posted_at,
        apply_period_raw=normalize_label(apply_period_raw or "") or None,
        apply_start_date=apply_start_date,
        apply_end_date=apply_end_date,
        raw_content=content,
        normalized_content=content,
        tags=normalize_manual_tags(normalized_title, content, tags),
        curation_status=curation_status,
        curation_note=normalize_whitespace(curation_note or "") or None,
        is_bookmarked=bookmarked,
        is_todo=is_todo,
        last_seen_at=utcnow(),
    )
    session.add(posting)
    session.flush()
    return posting


def create_manual_posting(
    session: Session,
    platform_name: str,
    company_name: str,
    title: str,
    detail_url: str | None,
    external_apply_url: str | None,
    posted_at: date | None,
    apply_start_date: date | None,
    apply_end_date: date | None,
    apply_period_raw: str | None,
    normalized_content: str,
    tags: list[str],
    curation_status: str,
    curation_note: str | None,
    is_bookmarked: bool,
    is_todo: bool,
) -> JobPosting:
    posting = build_manual_posting(
        session,
        platform_name=platform_name,
        company_name=company_name,
        title=title,
        detail_url=detail_url,
        external_apply_url=external_apply_url,
        posted_at=posted_at,
        apply_start_date=apply_start_date,
        apply_end_date=apply_end_date,
        apply_period_raw=apply_period_raw,
        normalized_content=normalized_content,
        tags=tags,
        curation_status=curation_status,
        curation_note=curation_note,
        is_bookmarked=is_bookmarked,
        is_todo=is_todo,
    )
    session.commit()
    session.refresh(posting)
    invalidate_read_caches()
    return posting


def create_manual_application(
    session: Session,
    platform_name: str,
    company_name: str,
    job_title: str,
    detail_url: str | None,
    external_apply_url: str | None,
    posted_at: date | None,
    apply_start_date: date | None,
    apply_end_date: date | None,
    apply_period_raw: str | None,
    normalized_content: str,
    tags: list[str],
    curation_status: str,
    curation_note: str | None,
    is_bookmarked: bool,
    is_todo: bool,
    resume_template_id: int,
    application_method: str,
    status: str,
    note: str,
    applied_at: date | None = None,
) -> Application:
    template = session.get(ResumeTemplate, resume_template_id)
    if template is None:
        raise ValueError("Resume template not found.")

    posting = build_manual_posting(
        session,
        platform_name=platform_name,
        company_name=company_name,
        title=job_title,
        detail_url=detail_url,
        external_apply_url=external_apply_url,
        posted_at=posted_at,
        apply_start_date=apply_start_date,
        apply_end_date=apply_end_date,
        apply_period_raw=apply_period_raw,
        normalized_content=normalized_content,
        tags=tags,
        curation_status=curation_status,
        curation_note=curation_note,
        is_bookmarked=is_bookmarked,
        is_todo=is_todo,
    )
    application = Application(
        job_posting_id=posting.id,
        resume_template_id=template.id,
        application_method=application_method,
        status=status,
        note=note,
        applied_at=applied_at,
        apply_end_date_snapshot=posting.apply_end_date,
        apply_period_raw_snapshot=posting.apply_period_raw,
        resume_snapshot_title=f"{template.title} · {posting.company_name}",
        resume_snapshot_markdown=template.markdown_content,
    )
    session.add(application)
    session.commit()
    session.refresh(application)
    invalidate_read_caches()
    return application


def normalize_cover_letter_tag(tag: str) -> str:
    return " ".join(tag.strip().lower().split())


def resolve_cover_letter_tags(session: Session, tags: list[str]) -> list[CoverLetterTag]:
    resolved: list[CoverLetterTag] = []
    seen: set[str] = set()

    for raw in tags:
        normalized = normalize_cover_letter_tag(raw)
        label = " ".join(raw.strip().split())
        if not normalized or normalized in seen:
            continue

        tag = session.scalar(select(CoverLetterTag).where(CoverLetterTag.name == normalized))
        if tag is None:
            tag = CoverLetterTag(name=normalized, label=label)
            session.add(tag)
            session.flush()
        elif tag.label != label:
            tag.label = label

        resolved.append(tag)
        seen.add(normalized)

    return resolved


def create_cover_letter_item(
    session: Session,
    application_id: int,
    question: str,
    answer_markdown: str,
    tags: list[str],
) -> CoverLetterItem:
    application = session.scalar(
        select(Application)
        .options(joinedload(Application.cover_letter_items))
        .where(Application.id == application_id)
    )
    if application is None:
        raise ValueError("Application not found.")
    if application.application_method != "cover_letter":
        raise ValueError("Cover letter items can only be added to cover letter applications.")

    next_index = session.scalar(
        select(func.max(CoverLetterItem.order_index)).where(CoverLetterItem.application_id == application_id)
    )
    item = CoverLetterItem(
        application_id=application_id,
        question=question,
        answer_markdown=answer_markdown,
        order_index=(next_index or -1) + 1,
    )
    item.tags = resolve_cover_letter_tags(session, tags)
    session.add(item)
    session.commit()
    session.refresh(item)
    invalidate_read_caches()
    return item


def update_cover_letter_item(
    session: Session,
    item_id: int,
    question: str,
    answer_markdown: str,
    tags: list[str],
    order_index: int,
) -> CoverLetterItem:
    item = session.scalar(
        select(CoverLetterItem)
        .options(joinedload(CoverLetterItem.application), joinedload(CoverLetterItem.tags))
        .where(CoverLetterItem.id == item_id)
    )
    if item is None:
        raise ValueError("Cover letter item not found.")

    item.question = question
    item.answer_markdown = answer_markdown
    item.order_index = order_index
    item.tags = resolve_cover_letter_tags(session, tags)
    session.commit()
    session.refresh(item)
    invalidate_read_caches()
    return item


def delete_cover_letter_item(session: Session, item_id: int) -> None:
    item = session.get(CoverLetterItem, item_id)
    if item is None:
        raise ValueError("Cover letter item not found.")

    session.delete(item)
    session.commit()
    invalidate_read_caches()


def update_application_snapshot(
    session: Session,
    application_id: int,
    status: str,
    note: str,
    applied_at: date | None,
    resume_template_id: int | None,
    resume_snapshot_title: str,
    resume_snapshot_markdown: str,
) -> Application:
    application = session.get(Application, application_id)
    if application is None:
        raise ValueError("Application not found.")

    if resume_template_id is not None:
        template = session.get(ResumeTemplate, resume_template_id)
        if template is None:
            raise ValueError("Resume template not found.")
        application.resume_template_id = resume_template_id
    else:
        application.resume_template_id = None

    application.status = status
    application.note = note
    application.applied_at = applied_at
    application.resume_snapshot_title = resume_snapshot_title
    application.resume_snapshot_markdown = resume_snapshot_markdown
    session.commit()
    session.refresh(application)
    invalidate_read_caches()
    return application
