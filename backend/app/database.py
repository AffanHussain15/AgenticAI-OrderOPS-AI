import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Failing here beats defaulting to localhost, which on a hosted deploy
    # surfaces as a connection-refused error that looks like a network fault.
    raise RuntimeError(
        "DATABASE_URL is not set. Locally: copy backend/.env.example to "
        "backend/.env and fill it in. On a hosted deploy: set it as an "
        "environment variable."
    )

# pool_pre_ping discards connections the database closed while idle, which
# hosted Postgres does aggressively. On serverless each invocation is its own
# short-lived process, so SQLAlchemy should not pool on top of the provider's
# own pooler (use the pooled connection string there).
engine_kwargs = {"pool_pre_ping": True}
if os.getenv("VERCEL") or os.getenv("SERVERLESS"):
    engine_kwargs["poolclass"] = NullPool

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
