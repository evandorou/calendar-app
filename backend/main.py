import datetime
import os
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
import schemas
from database import engine, get_db, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Notebook Calendar API", version="1.0.0")

# In production, set ALLOWED_ORIGINS to a comma-separated list of your
# frontend URL(s), e.g. "https://your-site.netlify.app". Defaults to "*"
# (all origins) for local development / Docker out-of-the-box.
_origins_env = os.environ.get("ALLOWED_ORIGINS", "*")
allowed_origins = ["*"] if _origins_env.strip() == "*" else [o.strip() for o in _origins_env.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Serialization helpers (attach derived / joined fields the schemas expect)
# ---------------------------------------------------------------------------

def serialize_org(org: models.Organization) -> schemas.Organization:
    data = schemas.Organization.model_validate(org)
    data.user_count = len(org.users)
    return data


def serialize_user(user: models.User) -> schemas.User:
    data = schemas.User.model_validate(user)
    data.organization_name = user.organization.name if user.organization else None
    return data


def serialize_team(team: models.Team) -> schemas.Team:
    data = schemas.Team.model_validate(team)
    members = []
    for m in team.members:
        mo = schemas.TeamMemberOut.model_validate(m)
        mo.organization_name = m.organization.name if m.organization else None
        members.append(mo)
    data.members = members
    return data


def serialize_event(event: models.Event) -> schemas.Event:
    data = schemas.Event.model_validate(event)
    data.organization_name = event.organization.name if event.organization else None
    data.team_name = event.team.name if event.team else None
    return data


# ---------------------------------------------------------------------------
# Organizations
# ---------------------------------------------------------------------------

@app.get("/organizations", response_model=List[schemas.Organization])
def list_organizations(db: Session = Depends(get_db)):
    orgs = db.query(models.Organization).order_by(models.Organization.name).all()
    return [serialize_org(o) for o in orgs]


@app.post("/organizations", response_model=schemas.Organization, status_code=201)
def create_organization(payload: schemas.OrganizationCreate, db: Session = Depends(get_db)):
    if db.query(models.Organization).filter(models.Organization.name == payload.name).first():
        raise HTTPException(400, "An organization with that name already exists")
    org = models.Organization(**payload.model_dump())
    db.add(org)
    db.commit()
    db.refresh(org)
    return serialize_org(org)


@app.get("/organizations/{org_id}", response_model=schemas.Organization)
def get_organization(org_id: int, db: Session = Depends(get_db)):
    org = db.query(models.Organization).get(org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    return serialize_org(org)


@app.put("/organizations/{org_id}", response_model=schemas.Organization)
def update_organization(org_id: int, payload: schemas.OrganizationUpdate, db: Session = Depends(get_db)):
    org = db.query(models.Organization).get(org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(org, k, v)
    db.commit()
    db.refresh(org)
    return serialize_org(org)


@app.delete("/organizations/{org_id}", status_code=204)
def delete_organization(org_id: int, db: Session = Depends(get_db)):
    org = db.query(models.Organization).get(org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    db.delete(org)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@app.get("/users", response_model=List[schemas.User])
def list_users(organization_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(models.User)
    if organization_id is not None:
        q = q.filter(models.User.organization_id == organization_id)
    users = q.order_by(models.User.name).all()
    return [serialize_user(u) for u in users]


@app.post("/users", response_model=schemas.User, status_code=201)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    if not db.query(models.Organization).get(payload.organization_id):
        raise HTTPException(400, "Organization does not exist")
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(400, "A user with that email already exists")
    user = models.User(**payload.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@app.get("/users/{user_id}", response_model=schemas.User)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return serialize_user(user)


@app.put("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, payload: schemas.UserUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@app.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    db.delete(user)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Teams  (members can come from different organizations)
# ---------------------------------------------------------------------------

@app.get("/teams", response_model=List[schemas.Team])
def list_teams(db: Session = Depends(get_db)):
    teams = db.query(models.Team).order_by(models.Team.name).all()
    return [serialize_team(t) for t in teams]


@app.post("/teams", response_model=schemas.Team, status_code=201)
def create_team(payload: schemas.TeamCreate, db: Session = Depends(get_db)):
    if db.query(models.Team).filter(models.Team.name == payload.name).first():
        raise HTTPException(400, "A team with that name already exists")
    data = payload.model_dump(exclude={"member_ids"})
    team = models.Team(**data)
    if payload.member_ids:
        members = db.query(models.User).filter(models.User.id.in_(payload.member_ids)).all()
        team.members = members
    db.add(team)
    db.commit()
    db.refresh(team)
    return serialize_team(team)


@app.get("/teams/{team_id}", response_model=schemas.Team)
def get_team(team_id: int, db: Session = Depends(get_db)):
    team = db.query(models.Team).get(team_id)
    if not team:
        raise HTTPException(404, "Team not found")
    return serialize_team(team)


@app.put("/teams/{team_id}", response_model=schemas.Team)
def update_team(team_id: int, payload: schemas.TeamUpdate, db: Session = Depends(get_db)):
    team = db.query(models.Team).get(team_id)
    if not team:
        raise HTTPException(404, "Team not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(team, k, v)
    db.commit()
    db.refresh(team)
    return serialize_team(team)


@app.delete("/teams/{team_id}", status_code=204)
def delete_team(team_id: int, db: Session = Depends(get_db)):
    team = db.query(models.Team).get(team_id)
    if not team:
        raise HTTPException(404, "Team not found")
    db.delete(team)
    db.commit()
    return None


@app.post("/teams/{team_id}/members/{user_id}", response_model=schemas.Team)
def add_team_member(team_id: int, user_id: int, db: Session = Depends(get_db)):
    team = db.query(models.Team).get(team_id)
    user = db.query(models.User).get(user_id)
    if not team or not user:
        raise HTTPException(404, "Team or user not found")
    if user not in team.members:
        team.members.append(user)
        db.commit()
        db.refresh(team)
    return serialize_team(team)


@app.delete("/teams/{team_id}/members/{user_id}", response_model=schemas.Team)
def remove_team_member(team_id: int, user_id: int, db: Session = Depends(get_db)):
    team = db.query(models.Team).get(team_id)
    user = db.query(models.User).get(user_id)
    if not team or not user:
        raise HTTPException(404, "Team or user not found")
    if user in team.members:
        team.members.remove(user)
        db.commit()
        db.refresh(team)
    return serialize_team(team)


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

@app.get("/events", response_model=List[schemas.Event])
def list_events(
    start: Optional[datetime.datetime] = None,
    end: Optional[datetime.datetime] = None,
    organization_id: Optional[int] = None,
    team_id: Optional[int] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.Event)
    if start is not None:
        q = q.filter(models.Event.end_time >= start)
    if end is not None:
        q = q.filter(models.Event.start_time <= end)
    if organization_id is not None:
        q = q.filter(models.Event.organization_id == organization_id)
    if team_id is not None:
        q = q.filter(models.Event.team_id == team_id)
    events = q.order_by(models.Event.start_time).all()
    if user_id is not None:
        events = [
            e for e in events
            if e.created_by_id == user_id or any(a.id == user_id for a in e.attendees)
        ]
    return [serialize_event(e) for e in events]


@app.post("/events", response_model=schemas.Event, status_code=201)
def create_event(payload: schemas.EventCreate, db: Session = Depends(get_db)):
    if payload.end_time < payload.start_time:
        raise HTTPException(400, "end_time cannot be before start_time")
    data = payload.model_dump(exclude={"attendee_ids"})
    event = models.Event(**data)
    if payload.attendee_ids:
        attendees = db.query(models.User).filter(models.User.id.in_(payload.attendee_ids)).all()
        event.attendees = attendees
    db.add(event)
    db.commit()
    db.refresh(event)
    return serialize_event(event)


@app.get("/events/{event_id}", response_model=schemas.Event)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(models.Event).get(event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    return serialize_event(event)


@app.put("/events/{event_id}", response_model=schemas.Event)
def update_event(event_id: int, payload: schemas.EventUpdate, db: Session = Depends(get_db)):
    event = db.query(models.Event).get(event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    update_data = payload.model_dump(exclude_unset=True, exclude={"attendee_ids"})
    for k, v in update_data.items():
        setattr(event, k, v)
    if payload.attendee_ids is not None:
        attendees = db.query(models.User).filter(models.User.id.in_(payload.attendee_ids)).all()
        event.attendees = attendees
    db.commit()
    db.refresh(event)
    return serialize_event(event)


@app.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(models.Event).get(event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    db.delete(event)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Demo seed data (only runs if the database is empty)
# ---------------------------------------------------------------------------

@app.post("/seed")
def seed_demo_data(db: Session = Depends(get_db)):
    if db.query(models.Organization).count() > 0:
        return {"seeded": False, "message": "Data already exists"}

    acme = models.Organization(name="Acme Corp", description="Widgets & gadgets", color="#5b7fdb")
    globex = models.Organization(name="Globex Inc", description="Global exports", color="#c1443c")
    db.add_all([acme, globex])
    db.commit()
    db.refresh(acme)
    db.refresh(globex)

    users = [
        models.User(name="Rin Tanaka", email="rin@acmecorp.io", role="Engineer", organization_id=acme.id),
        models.User(name="Sam Ortiz", email="sam@acmecorp.io", role="Designer", organization_id=acme.id),
        models.User(name="Priya Nair", email="priya@globexinc.io", role="PM", organization_id=globex.id),
        models.User(name="Leo Fischer", email="leo@globexinc.io", role="Engineer", organization_id=globex.id),
    ]
    db.add_all(users)
    db.commit()
    for u in users:
        db.refresh(u)

    cross_team = models.Team(
        name="Launch Task Force",
        description="Cross-org team shipping the Q3 launch",
        color="#2f8f5b",
        members=[users[0], users[2], users[3]],
    )
    db.add(cross_team)
    db.commit()
    db.refresh(cross_team)

    now = datetime.datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    events = [
        models.Event(
            title="Kickoff standup",
            description="Sync across both orgs on launch plan",
            start_time=now + datetime.timedelta(hours=2),
            end_time=now + datetime.timedelta(hours=3),
            team_id=cross_team.id,
            created_by_id=users[0].id,
            color="#2f8f5b",
            attendees=[users[0], users[2], users[3]],
        ),
        models.Event(
            title="Design review",
            start_time=now + datetime.timedelta(days=1, hours=4),
            end_time=now + datetime.timedelta(days=1, hours=5),
            organization_id=acme.id,
            created_by_id=users[1].id,
            color="#5b7fdb",
            attendees=[users[0], users[1]],
        ),
    ]
    db.add_all(events)
    db.commit()

    return {"seeded": True}


@app.get("/")
def root():
    return {"status": "ok", "service": "Notebook Calendar API"}
