import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    ForeignKey,
    Table,
)
from sqlalchemy.orm import relationship

from database import Base

# --- association tables (many-to-many) ---

team_members = Table(
    "team_members",
    Base.metadata,
    Column("team_id", Integer, ForeignKey("teams.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)

event_attendees = Table(
    "event_attendees",
    Base.metadata,
    Column("event_id", Integer, ForeignKey("events.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), unique=True, nullable=False)
    description = Column(Text, default="")
    color = Column(String(20), default="#5b7fdb")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(160), unique=True, nullable=False, index=True)
    role = Column(String(60), default="member")
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    organization = relationship("Organization", back_populates="users")
    teams = relationship("Team", secondary=team_members, back_populates="members")
    events_attending = relationship("Event", secondary=event_attendees, back_populates="attendees")


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), unique=True, nullable=False)
    description = Column(Text, default="")
    color = Column(String(20), default="#c1443c")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    members = relationship("User", secondary=team_members, back_populates="teams")
    events = relationship("Event", back_populates="team")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    location = Column(String(200), default="")
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    all_day = Column(Boolean, default=False)
    color = Column(String(20), default="#2c4870")

    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    organization = relationship("Organization")
    team = relationship("Team", back_populates="events")
    created_by = relationship("User", foreign_keys=[created_by_id])
    attendees = relationship("User", secondary=event_attendees, back_populates="events_attending")
