from fastapi import HTTPException
from sqlalchemy.orm import Session
from models import Employee, Shift
from datetime import datetime


def login_by_pin(db: Session, pin: str):

    try:
        pin = str(pin).strip()
    except:
        raise HTTPException(status_code=400, detail="Ошибка PIN")

    print("Введён PIN:", pin)

    try:
        employees = db.query(Employee).all()
    except Exception as e:
        print("DB ERROR:", e)
        raise HTTPException(status_code=500, detail="Ошибка базы")

    employee = None

    for e in employees:
        try:
            db_pin = str(e.pin).strip() if e.pin is not None else ""
        except:
            db_pin = ""

        print("DB:", e.id, e.name, db_pin, e.is_active)

        if db_pin == pin and e.is_active:
            employee = e
            break

    if not employee:
        raise HTTPException(status_code=401, detail="Неверный PIN")

    # 🔥 Проверка смены (тоже защищаем)
    try:
        active_shift = db.query(Shift).filter(
            Shift.employee_id == employee.id,
            Shift.is_active == True
        ).first()
    except Exception as e:
        print("SHIFT ERROR:", e)
        raise HTTPException(status_code=500, detail="Ошибка смены")

    if not active_shift:
        try:
            new_shift = Shift(
                employee_id=employee.id,
                started_at=datetime.utcnow(),
                is_active=True
            )
            db.add(new_shift)
            db.commit()
            db.refresh(new_shift)
        except Exception as e:
            print("CREATE SHIFT ERROR:", e)
            raise HTTPException(status_code=500, detail="Ошибка создания смены")

    return {
        "employee_id": employee.id,
        "name": employee.name,
        "role": employee.role
    }