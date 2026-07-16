import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Override with e.g. DATABASE_URL=sqlite:////data/calendar.db when running in
# Docker with a mounted volume, or a postgres:// URL for a managed database.
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./calendar.db")

connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
