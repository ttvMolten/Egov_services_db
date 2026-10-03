from sqlalchemy.orm import Session
from models import (
    Order,
    Service,
    Employee,
    Shift,
    OrderService,
    OrderRefund,
    OrderCorrection
)
import datetime


# ================= START ORDER =================

def start_order(db: Session, data):

    # Определяем список услуг
    if hasattr(data, "service_ids") and data.service_ids:
        service_ids = data.service_ids
    else:
        service_ids = [data.service_id]

    # Проверяем сотрудника
    employee = db.query(Employee).filter(
        Employee.id == data.employee_id
    ).first()

    if not employee or not employee.is_active:
        return {"error": "Invalid employee"}

    # Проверяем активную смену
    active_shift = db.query(Shift).filter(
        Shift.employee_id == data.employee_id,
        Shift.is_active == True
    ).first()

    if not active_shift:
        return {"error": "No active shift"}

    # Проверяем существование услуг
    services = db.query(Service).filter(
        Service.id.in_(set(service_ids))
    ).all()

    if not services:
        return {"error": "Invalid services"}

    # Первая услуга — в Order для совместимости
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

    # Добавляем ВСЕ услуги.
    # Дубликаты сохраняются.
    # Цена сохраняется на момент создания заказа.
    for service_id in service_ids:

        service = db.query(Service).filter(
            Service.id == service_id
        ).first()

        if not service:
            continue

        order_service = OrderService(
            order_id=order.id,
            service_id=service_id,
            price=service.price
        )

        db.add(order_service)

    db.commit()

    return {"order_id": order.id}


# ================= COMPLETE ORDER =================

def complete_order(
    db: Session,
    order_id: int,
    payment_type: str
):

    ALLOWED_PAYMENTS = [
        "CASH",
        "QR",
        "TRANSFER"
    ]

    order = db.query(Order).filter(
        Order.id == order_id
    ).first()

    if not order or order.status != "IN_PROGRESS":
        return {"error": "Invalid order"}

    payment_type = payment_type.upper()

    if payment_type not in ALLOWED_PAYMENTS:
        return {"error": "Invalid payment type"}

    order.status = "COMPLETED"
    order.payment_status = "PAID"
    order.payment_type = payment_type
    order.completed_at = datetime.datetime.utcnow()

    db.commit()

    return {"status": "completed"}


# ================= NOT PROVIDED =================

def not_provided(
    db: Session,
    order_id: int,
    reason: str
):

    order = db.query(Order).filter(
        Order.id == order_id
    ).first()

    if not order or order.status != "IN_PROGRESS":
        return {"error": "Invalid order"}

    order.status = "NOT_PROVIDED"
    order.not_provided_reason = reason
    order.completed_at = datetime.datetime.utcnow()

    db.commit()

    return {"status": "not_provided"}


# ================= REFUND =================

def create_refund(
    db: Session,
    order_id: int,
    employee_id: int,
    amount: int,
    payment_type: str,
    reason: str
):

    order = db.query(Order).filter(
        Order.id == order_id
    ).first()

    if not order:
        return {"error": "Order not found"}

    if order.status != "COMPLETED":
        return {
            "error": "Only completed orders can be refunded"
        }

    if order.payment_status != "PAID":
        return {"error": "Order is not paid"}

    if amount <= 0:
        return {"error": "Invalid refund amount"}

    payment_type = payment_type.upper()

    if payment_type not in [
        "CASH",
        "QR",
        "TRANSFER"
    ]:
        return {"error": "Invalid payment type"}

    # Проверяем существующие возвраты
    existing_refunds = db.query(OrderRefund).filter(
        OrderRefund.order_id == order_id
    ).all()

    already_refunded = sum(
        refund.amount
        for refund in existing_refunds
    )

    # Считаем первоначальную стоимость заказа
    order_total = sum(
        os.price
        for os in order.services
    )

    # Нельзя вернуть больше стоимости заказа
    if already_refunded + amount > order_total:
        return {
            "error": "Refund amount exceeds order total"
        }

    refund = OrderRefund(
        order_id=order_id,
        processed_by_employee_id=employee_id,
        amount=amount,
        payment_type=payment_type,
        reason=reason
    )

    db.add(refund)
    db.commit()
    db.refresh(refund)

    return {
        "status": "refunded",
        "refund_id": refund.id,
        "amount": refund.amount
    }


# ================= CORRECTION =================

def create_correction(
    db: Session,
    order_id: int,
    employee_id: int,
    new_service_id: int,
    new_price: int,
    reason: str
):

    order = db.query(Order).filter(
        Order.id == order_id
    ).first()

    if not order:
        return {"error": "Order not found"}

    if order.status != "COMPLETED":
        return {
            "error": "Only completed orders can be corrected"
        }

    if new_price < 0:
        return {"error": "Invalid price"}

    new_service = db.query(Service).filter(
        Service.id == new_service_id
    ).first()

    if not new_service:
        return {"error": "New service not found"}

    if not order.services:
        return {"error": "Order has no services"}

    # Пока корректируем первую услугу заказа
    order_service = order.services[0]

    old_service_id = order_service.service_id
    old_price = order_service.price

    difference = new_price - old_price

    correction = OrderCorrection(
        order_id=order_id,
        corrected_by_employee_id=employee_id,
        old_service_id=old_service_id,
        new_service_id=new_service_id,
        old_price=old_price,
        new_price=new_price,
        difference=difference,
        reason=reason
    )

    # Обновляем услугу заказа
    order_service.service_id = new_service_id
    order_service.price = new_price

    # Обновляем основную услугу заказа
    order.service_id = new_service_id

    db.add(correction)
    db.commit()
    db.refresh(correction)

    return {
        "status": "corrected",
        "correction_id": correction.id,
        "old_price": old_price,
        "new_price": new_price,
        "difference": difference
    }