from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class RuleResult(Base):
    __tablename__ = "rule_results"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"), nullable=False, index=True)
    rule_code = Column(String(32), ForeignKey("rules.code"), nullable=False, index=True)
    matched = Column(Boolean, nullable=False, default=False)
    score = Column(Float, nullable=False, default=0.0)
    reason = Column(String(1024), nullable=True)

    analysis = relationship("Analysis", back_populates="rule_results")
