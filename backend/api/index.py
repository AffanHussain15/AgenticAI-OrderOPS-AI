"""Vercel serverless entry point.

Vercel turns every file under `api/` into a function and detects the ASGI
`app` symbol below. The project root is pushed onto sys.path first because the
function executes from inside this directory, so `app/` would not otherwise be
importable.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: E402  (path setup must run first)

__all__ = ["app"]
