from app.database import Base, engine


def init_db() -> None:
    """Create all database tables for development."""
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("Database schema created successfully.")
