import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, ConfigDict


# ---------- Organization ----------

class OrganizationBase(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#5b7fdb"


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class Organization(OrganizationBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime.datetime
    user_count: int = 0


# ---------- User ----------

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: Optional[str] = "member"
    organization_id: int


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    organization_id: Optional[int] = None


class User(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime.datetime
    organization_name: Optional[str] = None


# ---------- Team ----------

class TeamBase(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#c1443c"


class TeamCreate(TeamBase):
    member_ids: Optional[List[int]] = []


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class TeamMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    organization_id: int
    organization_name: Optional[str] = None


class Team(TeamBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime.datetime
    members: List[TeamMemberOut] = []


# ---------- Event ----------

class EventBase(BaseModel):
    title: str
    description: Optional[str] = ""
    location: Optional[str] = ""
    start_time: datetime.datetime
    end_time: datetime.datetime
    all_day: Optional[bool] = False
    color: Optional[str] = "#2c4870"
    organization_id: Optional[int] = None
    team_id: Optional[int] = None
    created_by_id: Optional[int] = None


class EventCreate(EventBase):
    attendee_ids: Optional[List[int]] = []


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: Optional[datetime.datetime] = None
    end_time: Optional[datetime.datetime] = None
    all_day: Optional[bool] = None
    color: Optional[str] = None
    organization_id: Optional[int] = None
    team_id: Optional[int] = None
    attendee_ids: Optional[List[int]] = None


class EventAttendeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str


class Event(EventBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime.datetime
    organization_name: Optional[str] = None
    team_name: Optional[str] = None
    attendees: List[EventAttendeeOut] = []
