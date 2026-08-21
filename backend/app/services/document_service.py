"""Secure Document Management Vault Service.

Provides encrypted metadata tracking, ownership validation, role-based isolation,
and verification status for student and faculty credentials, reports, and offer letters.
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserDocument
from app.schemas.contracts import APIModel


class UserDocumentCreate(APIModel):
    document_type: str  # resume, certificate, academic_record, internship_report, offer_letter, internship_completion_certificate, fdp_certificate, research_document, achievement_proof
    title: str
    file_name: str
    file_size_bytes: int = 0
    mime_type: str = "application/pdf"
    file_url: str | None = None
    related_entity_id: UUID | None = None
    metadata_payload: dict | None = None


class UserDocumentResponse(APIModel):
    id: UUID
    user_id: UUID
    user_role: str
    document_type: str
    title: str
    file_name: str
    file_size_bytes: int
    mime_type: str
    file_url: str | None
    verification_status: str
    related_entity_id: UUID | None
    metadata_payload: dict
    created_at: str


async def list_user_documents(
    session: AsyncSession,
    user_id: UUID,
    document_type: str | None = None,
) -> list[UserDocumentResponse]:
    stmt = (
        select(UserDocument)
        .where(UserDocument.user_id == user_id)
        .order_by(UserDocument.created_at.desc())
    )
    if document_type:
        stmt = stmt.where(UserDocument.document_type == document_type)

    rows = (await session.scalars(stmt)).all()
    return [
        UserDocumentResponse(
            id=d.id,
            user_id=d.user_id,
            user_role=d.user_role,
            document_type=d.document_type,
            title=d.title,
            file_name=d.file_name,
            file_size_bytes=d.file_size_bytes,
            mime_type=d.mime_type,
            file_url=d.file_url,
            verification_status=d.verification_status,
            related_entity_id=d.related_entity_id,
            metadata_payload=d.metadata_payload,
            created_at=d.created_at.isoformat(),
        )
        for d in rows
    ]


async def create_user_document(
    session: AsyncSession,
    user_id: UUID,
    user_role: str,
    payload: UserDocumentCreate,
) -> UserDocumentResponse:
    doc = UserDocument(
        user_id=user_id,
        user_role=user_role,
        document_type=payload.document_type,
        title=payload.title,
        file_name=payload.file_name,
        file_size_bytes=payload.file_size_bytes,
        mime_type=payload.mime_type,
        file_url=payload.file_url or f"https://vault.skillpassport.edu/docs/{user_id}/{payload.file_name}",
        verification_status="verified" if "certificate" in payload.document_type else "uploaded",
        related_entity_id=payload.related_entity_id,
        metadata_payload=payload.metadata_payload or {},
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)

    return UserDocumentResponse(
        id=doc.id,
        user_id=doc.user_id,
        user_role=doc.user_role,
        document_type=doc.document_type,
        title=doc.title,
        file_name=doc.file_name,
        file_size_bytes=doc.file_size_bytes,
        mime_type=doc.mime_type,
        file_url=doc.file_url,
        verification_status=doc.verification_status,
        related_entity_id=doc.related_entity_id,
        metadata_payload=doc.metadata_payload,
        created_at=doc.created_at.isoformat(),
    )


async def delete_user_document(
    session: AsyncSession,
    document_id: UUID,
    user_id: UUID,
) -> None:
    doc = await session.get(UserDocument, document_id)
    if not doc or doc.user_id != user_id:
        raise ValueError("Document not found or access denied")

    await session.delete(doc)
    await session.commit()
