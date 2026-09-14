from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import get_db
from .models import Item, Order
from .schemas import ItemOut, OrderOut

app = FastAPI(title="OrderOps AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/items", response_model=list[ItemOut])
def list_items(db: Session = Depends(get_db)):
    return db.query(Item).all()


@app.get("/orders", response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db)):
    return db.query(Order).order_by(Order.created_at.desc()).all()
