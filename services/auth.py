from fastapi import HTTPException
from sqlalchemy.orm import Session
from models import Employee, Shift
from datetime import datetime


def login_by_pin(db: Session, pin: str):

    # Ищем сотрудника (БЕЗ фильтра is_active, чтобы различать ошибки)
    employee = db.query(Employee).filter(
        Employee.pin == pin
    ).first()

    if not employee:
        raise HTTPException(status_code=401, detail="Неверный PIN")

    # 🔥 Проверка активности (ВАЖНО)
    if not employee.is_active:
        raise HTTPException(status_code=403, detail="Сотрудник уволен")

    # Проверяем активную смену
    active_shift = db.query(Shift).filter(
        Shift.employee_id == employee.id,
        Shift.is_active == True
    ).first()

    # Если активной смены нет — создаём новую
    if not active_shift:
        new_shift = Shift(
            employee_id=employee.id,
            started_at=datetime.utcnow(),
            is_active=True
        )
        db.add(new_shift)
        db.commit()
        db.refresh(new_shift)

    return {
        "employee_id": employee.id,
        "name": employee.name,
        "role": employee.role
    }