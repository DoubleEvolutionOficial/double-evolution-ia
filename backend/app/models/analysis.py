from sqlalchemy import Column, DateTime, Float, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    confidence = Column(Float, nullable=False, default=0.0)
    score = Column(Float, nullable=False, default=0.0)
    status = Column(String(64), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    rule_results = relationship("RuleResult", back_populates="analysis", cascade="all, delete-orphan")
