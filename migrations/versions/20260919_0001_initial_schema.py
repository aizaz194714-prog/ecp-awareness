"""Create the voter awareness schema.

Revision ID: 20260919_0001
Revises:
Create Date: 2026-09-19
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260919_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "admins",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("username", sa.Text(), nullable=False),
        sa.Column("email", sa.Text()),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("username", name="uq_admins_username"),
        sa.UniqueConstraint("email", name="uq_admins_email"),
    )
    op.create_table(
        "participants",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("identifier_hash", sa.Text(), nullable=False),
        sa.Column("identifier_mask", sa.Text(), nullable=False),
        sa.Column("registered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("awareness_started_at", sa.DateTime(timezone=True)),
        sa.Column("awareness_completed_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.Text(), nullable=False, server_default="IN_PROGRESS"),
        sa.Column("visits", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("status IN ('IN_PROGRESS', 'COMPLETED')", name="ck_participants_status"),
        sa.UniqueConstraint("identifier_hash", name="uq_participants_identifier_hash"),
    )
    op.create_index("idx_participants_registered", "participants", ["registered_at"])
    op.create_index("idx_participants_activity", "participants", ["last_activity_at"])
    op.create_index("idx_participants_status", "participants", ["status"])
    op.create_table(
        "awareness_progress",
        sa.Column("participant_id", sa.BigInteger(), sa.ForeignKey("participants.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("general_knowledge_started_at", sa.DateTime(timezone=True)),
        sa.Column("general_knowledge_completed_at", sa.DateTime(timezone=True)),
        sa.Column("survey_started_at", sa.DateTime(timezone=True)),
        sa.Column("survey_completed_at", sa.DateTime(timezone=True)),
        sa.Column("game_started_at", sa.DateTime(timezone=True)),
        sa.Column("game_completed_at", sa.DateTime(timezone=True)),
        sa.Column("quiz_started_at", sa.DateTime(timezone=True)),
        sa.Column("quiz_completed_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "survey_responses",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("participant_id", sa.BigInteger(), sa.ForeignKey("participants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("survey_key", sa.Text(), nullable=False),
        sa.Column("question_key", sa.Text(), nullable=False),
        sa.Column("answer_value", sa.Text(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("participant_id", "survey_key", "question_key", name="uq_survey_response"),
    )
    op.create_index("idx_survey_submitted", "survey_responses", ["submitted_at"])
    op.create_table(
        "game_progress",
        sa.Column("participant_id", sa.BigInteger(), sa.ForeignKey("participants.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("stage_1_at", sa.DateTime(timezone=True)),
        sa.Column("stage_2_at", sa.DateTime(timezone=True)),
        sa.Column("stage_3_at", sa.DateTime(timezone=True)),
        sa.Column("stage_4_at", sa.DateTime(timezone=True)),
        sa.Column("stage_5_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "quiz_attempts",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("participant_id", sa.BigInteger(), sa.ForeignKey("participants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("answers_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_quiz_participant", "quiz_attempts", ["participant_id"])
    op.create_index("idx_quiz_completed", "quiz_attempts", ["completed_at"])
    op.create_table(
        "activity_logs",
        sa.Column("id", sa.BigInteger(), sa.Identity(), primary_key=True),
        sa.Column("participant_id", sa.BigInteger(), sa.ForeignKey("participants.id", ondelete="SET NULL")),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("event_key", sa.Text(), nullable=False),
        sa.Column("details_json", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("participant_id", "event_key", name="uq_activity_event"),
    )
    op.create_index("idx_activity_created", "activity_logs", ["created_at"])
    op.create_index("idx_activity_type", "activity_logs", ["event_type"])


def downgrade() -> None:
    op.drop_table("activity_logs")
    op.drop_table("quiz_attempts")
    op.drop_table("game_progress")
    op.drop_table("survey_responses")
    op.drop_table("awareness_progress")
    op.drop_table("participants")
    op.drop_table("admins")
