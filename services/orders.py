from sqlalchemy.orm import Session
from models import Order, Service, Employee, Shift, OrderService
import datetime


def start_order(db: Session, data):

    # 🔥 Определяем список услуг
    if hasattr(data, "service_ids") and data.service_ids:
        service_ids = data.service_ids
    else:
        service_ids = [data.service_id]

    # Проверяем сотрудника
    employee = db.query(Employee).filter(Employee.id == data.employee_id).first()

    if not employee or not employee.is_active:
        return {"error": "Invalid employee"}

    # Проверяем активную смену
    active_shift = db.query(Shift).filter(
        Shift.employee_id == data.employee_id,
        Shift.is_active == True
    ).first()

    if not active_shift:
        return {"error": "No active shift"}

    # Проверяем услуги
    services = db.query(Service).filter(Service.id.in_(service_ids)).all()

    if not services or len(services) != len(service_ids):
        return {"error": "Invalid services"}

    # 🔥 Первая услуга — в Order (для совместимости)
    main_service = services[0]

    order = Order(
        service_id=main_service.id,
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

    # 🔥 Если услуг больше одной — добавляем в связующую таблицу
    for service in services:
        order_service = OrderService(
            order_id=order.id,
            service_id=service.id
        )
        db.add(order_service)

    db.commit()

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