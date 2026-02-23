from sqlalchemy.orm import Session
from models import Order, Service, Employee, Shift
import datetime


def start_order(db: Session, data):

    service = db.query(Service).filter(Service.id == data.service_id).first()
    employee = db.query(Employee).filter(Employee.id == data.employee_id).first()

    if not service or not employee or not employee.is_active:
        return {"error": "Invalid service or employee"}

    active_shift = db.query(Shift).filter(
        Shift.employee_id == data.employee_id,
        Shift.is_active == True
    ).first()

    if not active_shift:
        return {"error": "No active shift"}

    order = Order(
        service_id=service.id,
        employee_id=data.employee_id,
        branch_id=data.branch_id,
        client_name=data.client_name,
        client_phone=data.client_phone,
        status="IN_PROGRESS",
        payment_status="NOT_PAID"
    )

    db.add(order)
    db.commit()
    db.refresh(order)

    return {"order_id": order.id}


def complete_order(db: Session, order_id: int, payment_type: str):

    order = db.query(Order).filter(Order.id == order_id).first()

    if not order or order.status != "IN_PROGRESS":
        return {"error": "Invalid order"}

    order.status = "COMPLETED"
    order.payment_status = "PAID"
    order.payment_type = payment_type.upper()
    order.completed_at = datetime.datetime.utcnow()

    db.commit()

    return {"status": "completed"}


def not_provided(db: Session, order_id: int, reason: str):

    order = db.query(Order).filter(Order.id == order_id).first()

    if not order or order.status != "IN_PROGRESS":
        return {"error": "Invalid order"}

    order.status = "NOT_PROVIDED"
    order.not_provided_reason = reason
    order.completed_at = datetime.datetime.utcnow()

    db.commit()

    return {"status": "not_provided"}