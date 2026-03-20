from fastapi import HTTPException
from sqlalchemy.orm import Session
from models import Employee, Shift
from datetime import datetime


def login_by_pin(db: Session, pin: str):

    pin = pin.strip()  # убираем пробелы

    print("Введён PIN:", pin)

    employees = db.query(Employee).all()

    employee = None

    for e in employees:
        print("DB:", e.id, e.name, e.pin, e.is_active)

        if str(e.pin) == pin and e.is_active:
            employee = e
            break

    if not employee:
        raise HTTPException(status_code=401, detail="Неверный PIN")

    # Проверка смены
    active_shift = db.query(Shift).filter(
        Shift.employee_id == employee.id,
        Shift.is_active == True
    ).first()

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