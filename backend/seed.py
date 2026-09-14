"""Seeds the items table with the same catalog used by the frontend mock."""
from app.database import SessionLocal
from app.models import Item

CATALOG = [
    {"name": "Red T-Shirt", "category": "apparel", "price": 20, "stock": 0},
    {"name": "Blue T-Shirt", "category": "apparel", "price": 20, "stock": 25},
    {"name": "Black Hoodie", "category": "apparel", "price": 45, "stock": 0},
    {"name": "Grey Hoodie", "category": "apparel", "price": 45, "stock": 12},
    {"name": "Wireless Mouse", "category": "electronics", "price": 30, "stock": 8},
    {"name": "Wireless Keyboard", "category": "electronics", "price": 55, "stock": 0},
    {"name": "USB Keyboard", "category": "electronics", "price": 35, "stock": 14},
]


def seed():
    db = SessionLocal()
    try:
        if db.query(Item).count() > 0:
            print("Items already seeded, skipping.")
            return
        db.add_all([Item(**row) for row in CATALOG])
        db.commit()
        print(f"Seeded {len(CATALOG)} items.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
