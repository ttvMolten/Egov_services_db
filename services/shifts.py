from sqlalchemy.orm import Session
from models import Shift, Order
from datetime import datetime


def close_shift(db: Session, employee_id: int):

    # Ищем активную смену
    shift = db.query(Shift).filter(
        Shift.employee_id == employee_id,
        Shift.is_active == True
    ).first()

    if not shift:
        return None

    # Закрываем смену
    shift.is_active = False
    shift.ended_at = datetime.utcnow()
    db.commit()

    # Получаем все завершённые заказы за эту смену
    orders = db.query(Order).filter(
        Order.employee_id == employee_id,
        Order.status == "COMPLETED",
        Order.payment_status == "PAID",
        Order.completed_at != None,
        Order.completed_at >= shift.started_at,
        Order.completed_at <= shift.ended_at
    ).all()

    # Неоказанные
    not_provided = db.query(Order).filter(
        Order.employee_id == employee_id,
        Order.status == "NOT_PROVIDED",
        Order.completed_at != None,
        Order.completed_at >= shift.started_at,
        Order.completed_at <= shift.ended_at
    ).all()


    total = sum(
    os.price
    for o in orders
    for os in o.services
)

    cash = sum(
    os.price
    for o in orders
    if o.payment_type == "CASH"
    for os in o.services
)

    qr = sum(
    os.price
    for o in orders
    if o.payment_type == "QR"
    for os in o.services
)

    return {
        "employee": shift.employee.name,
        "shift_id": shift.id,
        "total_orders": len(orders),
        "total_amount": total,
        "cash": cash,
        "qr": qr,
        "not_provided": len(not_provided)
    }