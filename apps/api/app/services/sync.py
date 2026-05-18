from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.crawlers.base import CrawledJobPosting
from app.crawlers.registry import get_crawler
from app.models import Application, JobPosting, JobSyncRun, ResumeTemplate, Source, utcnow
from app.services.cache import invalidate_read_caches


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
    status: str,
    note: str,
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
            status=status,
            note=note,
            resume_snapshot_title=snapshot_title,
            resume_snapshot_markdown=template.markdown_content,
        )
        session.add(application)
    else:
        application.resume_template_id = template.id
        application.status = status
        application.note = note
        application.resume_snapshot_title = snapshot_title
        application.resume_snapshot_markdown = template.markdown_content

    session.commit()
    session.refresh(application)
    invalidate_read_caches()
    return application


def update_application_snapshot(
    session: Session,
    application_id: int,
    status: str,
    note: str,
    applied_at: date | None,
    resume_snapshot_title: str,
    resume_snapshot_markdown: str,
) -> Application:
    application = session.get(Application, application_id)
    if application is None:
        raise ValueError("Application not found.")

    application.status = status
    application.note = note
    application.applied_at = applied_at
    application.resume_snapshot_title = resume_snapshot_title
    application.resume_snapshot_markdown = resume_snapshot_markdown
    session.commit()
    session.refresh(application)
    invalidate_read_caches()
    return application
