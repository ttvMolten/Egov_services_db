from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship, declarative_base
import datetime

Base = declarative_base()


# ===== Employee =====
class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    pin = Column(String, unique=True, nullable=False)
    role = Column(String, default="EMPLOYEE", nullable=False)
    branch_id = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)

    orders = relationship("Order", back_populates="employee")
    shifts = relationship("Shift", back_populates="employee")


# ===== Service =====
class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    price = Column(Integer, nullable=False)

    orders = relationship("Order", back_populates="service")


# ===== Shift =====
class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)

    employee = relationship("Employee", back_populates="shifts")


# ===== Order =====
class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)

    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)

    branch_id = Column(Integer, nullable=False)

    client_name = Column(String, nullable=False)
    client_phone = Column(String, nullable=False)

    status = Column(String, nullable=False)  # IN_PROGRESS / COMPLETED / NOT_PROVIDED
    payment_type = Column(String, nullable=True)
    payment_status = Column(String, default="NOT_PAID", nullable=False)

    not_provided_reason = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    service = relationship("Service", back_populates="orders")
    employee = relationship("Employee", back_populates="orders")