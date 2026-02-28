from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse
from datetime import datetime, timedelta
from database import SessionLocal, engine
from models import Base, Employee, Order, Service, Shift
from schemas import (
    PinAuth,
    OrderStart,
    OrderComplete,
    OrderNotProvided,
    ServiceCreate,
    EmployeeCreate
)
from services.auth import login_by_pin
from services.orders import start_order, complete_order, not_provided
from telegram_utils import send_telegram
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

# ================= CORS =================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= DB INIT =================

Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ================= TIME (UTC+5) =================

def get_local_day_range():
    offset = 5
    local_now = datetime.utcnow() + timedelta(hours=offset)
    today_local = local_now.date()

    start_local = datetime.combine(today_local, datetime.min.time())
    end_local = datetime.combine(today_local, datetime.max.time())

    start_utc = start_local - timedelta(hours=offset)
    end_utc = end_local - timedelta(hours=offset)

    return start_utc, end_utc


# ================= ADMIN CHECK =================

def get_current_admin(employee_id: int, db: Session):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()

    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if emp.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Access denied")

    return emp


# ================= HEALTH =================

@app.get("/")
def health():
    return {"status": "ok"}


# ================= AUTH =================

@app.post("/auth/pin")
def auth(data: PinAuth, db: Session = Depends(get_db)):
    return login_by_pin(db, data.pin)


# ================= EMPLOYEES =================

@app.post("/employees")
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
    emp = Employee(
        name=data.name,
        branch_id=data.branch_id,
        pin=data.pin,
        role=data.role
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return {"id": emp.id}


@app.get("/employees")
def get_employees(db: Session = Depends(get_db)):
    employees = db.query(Employee).all()
    return [
        {
            "id": e.id,
            "name": e.name,
            "role": e.role,
            "is_active": e.is_active
        }
        for e in employees
    ]

from fastapi import HTTPException

@app.delete("/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()

    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    db.delete(emp)
    db.commit()

    return {"status": "deleted"}
# ================= SERVICES =================

@app.post("/services")
def create_service(data: ServiceCreate, db: Session = Depends(get_db)):
    s = Service(name=data.name, price=data.price)
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id}


@app.get("/services")
def get_services(db: Session = Depends(get_db)):
    services = db.query(Service).all()
    return [
        {"id": s.id, "name": s.name, "price": s.price}
        for s in services
    ]


# ================= ORDERS =================

@app.post("/orders/start")
def create_order(data: OrderStart, db: Session = Depends(get_db)):
    return start_order(db, data)


@app.post("/orders/{order_id}/complete")
def finish_order(order_id: int, data: OrderComplete, db: Session = Depends(get_db)):
    return complete_order(db, order_id, data.payment_type)


@app.post("/orders/{order_id}/not-provided")
def fail_order(order_id: int, data: OrderNotProvided, db: Session = Depends(get_db)):
    return not_provided(db, order_id, data.reason)
@app.get("/orders/in-progress")
def get_in_progress(employee_id: int, db: Session = Depends(get_db)):

    now = datetime.utcnow()

    orders = db.query(Order).filter(
        Order.status == "IN_PROGRESS",
        Order.employee_id == employee_id
    ).all()

    result = []

    for o in orders:

        minutes = 0
        if o.created_at:
            minutes = int((now - o.created_at).total_seconds() / 60)

        services_names = []

        for os in o.services:
            if os.service:
                services_names.append(os.service.name)

        result.append({
            "order_id": o.id,
            "services": services_names,
            "client_name": o.client_name,
            "minutes_in_progress": minutes
        })

    return result
# ================= SHIFT CLOSE =================
@app.post("/shifts/end")
def end_shift(employee_id: int, db: Session = Depends(get_db)):

    shift = db.query(Shift).filter(
        Shift.employee_id == employee_id,
        Shift.is_active == True
    ).first()

    if not shift:
        return {"error": "No active shift"}

    shift.is_active = False
    shift.ended_at = datetime.utcnow()
    db.commit()

    orders = db.query(Order).filter(
        Order.employee_id == employee_id,
        Order.status == "COMPLETED",
        Order.payment_status == "PAID",
        Order.completed_at >= shift.started_at,
        Order.completed_at <= shift.ended_at
    ).all()

    total = 0
    cash = 0
    qr = 0

    message = "📊 Смена закрыта\n\n"
    message += f"👤 Сотрудник: {shift.employee.name}\n"

    start_local = shift.started_at + timedelta(hours=5)
    end_local = shift.ended_at + timedelta(hours=5)

    message += f"🕒 Смена: {start_local.strftime('%H:%M')} — {end_local.strftime('%H:%M')}\n\n"
    message += "━━━━━━━━━━━━━━\n\n"
    services_count = 0
    for i, o in enumerate(orders, 1):

        if not o.service:
            continue
        
        order_total = sum(os.service.price for os in o.services)
        services_count += len(o.services)

    total += order_total

    if o.payment_type == "CASH":
        cash += order_total
    elif o.payment_type == "QR":
        qr += order_total


        start_time = o.created_at + timedelta(hours=5)
        end_time = o.completed_at + timedelta(hours=5)

        duration = int((o.completed_at - o.created_at).total_seconds() / 60)
        services_names = ", ".join(os.service.name for os in o.services)

        message += (
            f"{i}. {services_names}\n"
            f"Клиент: {o.client_name}\n"
            f"{start_time.strftime('%H:%M')} → {end_time.strftime('%H:%M')} ({duration} мин)\n"
            f"Оплата: {o.payment_type}\n\n"
        )

    message += "━━━━━━━━━━━━━━\n"
    message += f"Услуг: {services_count}\n"
    message += f"💰 Сумма: {total} ₸\n"
    message += f"Нал: {cash} ₸\n"
    message += f"QR: {qr} ₸"

    send_telegram(message)

    return {"status": "ended"}
# ================= ADMIN REPORT =================

@app.get("/admin/report/today")
def admin_report_today(employee_id: int, db: Session = Depends(get_db)):

    get_current_admin(employee_id, db)

    start_utc, end_utc = get_local_day_range()
    employees = db.query(Employee).all()

    result = []
    total_all = 0
    cash_all = 0
    qr_all = 0

    for emp in employees:

        orders = db.query(Order).filter(
            Order.employee_id == emp.id,
            Order.status == "COMPLETED",
            Order.payment_status == "PAID",
            Order.completed_at >= start_utc,
            Order.completed_at <= end_utc
        ).all()

        total = sum(
        sum(os.service.price for os in o.services)
        for o in orders
)
        cash = sum(o.service.price for o in orders if o.payment_type == "CASH" and o.service)
        qr = sum(o.service.price for o in orders if o.payment_type == "QR" and o.service)

        total_all += total
        cash_all += cash
        qr_all += qr

        result.append({
            "employee_id": emp.id,
            "employee": emp.name,
            "orders": len(orders),
            "total": total,
            "cash": cash,
            "qr": qr
        })

    return {
        "date": str((datetime.utcnow() + timedelta(hours=5)).date()),
        "employees": result,
        "total_all": total_all,
        "cash_all": cash_all,
        "qr_all": qr_all
    }
@app.post("/admin/report/today/send")
def send_admin_report(employee_id: int, db: Session = Depends(get_db)):

    get_current_admin(employee_id, db)

    start_utc, end_utc = get_local_day_range()
    employees = db.query(Employee).all()

    message = "📊 Подробный отчёт за сегодня\n\n"

    total_all = 0
    cash_all = 0
    qr_all = 0

    for emp in employees:

        orders = db.query(Order).filter(
            Order.employee_id == emp.id,
            Order.status == "COMPLETED",
            Order.payment_status == "PAID",
            Order.completed_at >= start_utc,
            Order.completed_at <= end_utc
        ).all()

        if not orders:
            continue

        message += f"👤 {emp.name}\n\n"

        emp_total = 0
        emp_cash = 0
        emp_qr = 0

        for i, o in enumerate(orders, 1):

            if not o.service:
                continue

            price = o.service.price
            emp_total += price
            total_all += price

            if o.payment_type == "CASH":
                emp_cash += price
                cash_all += price
            elif o.payment_type == "QR":
                emp_qr += price
                qr_all += price

            start_time = o.created_at + timedelta(hours=5)
            end_time = o.completed_at + timedelta(hours=5)

            duration = int((o.completed_at - o.created_at).total_seconds() / 60)

            message += (
                f"{i}. {o.service.name}\n"
                f"Клиент: {o.client_name}\n"
                f"{start_time.strftime('%H:%M')} → {end_time.strftime('%H:%M')} ({duration} мин)\n"
                f"Оплата: {o.payment_type}\n\n"
            )

        message += (
            f"Итого по {emp.name}:\n"
            f"Услуг: {len(orders)}\n"
            f"Сумма: {emp_total} ₸\n"
            f"Нал: {emp_cash} ₸\n"
            f"QR: {emp_qr} ₸\n"
        )

        message += "\n━━━━━━━━━━━━━━\n\n"

    message += (
        f"💰 Общий итог:\n"
        f"Сумма: {total_all} ₸\n"
        f"Нал: {cash_all} ₸\n"
        f"QR: {qr_all} ₸"
    )

    send_telegram(message)

    return {"status": "sent"}

from models import Service
from database import SessionLocal
from fastapi import Depends
from sqlalchemy.orm import Session

from models import Service
from database import SessionLocal
from fastapi import Depends
from sqlalchemy.orm import Session


@app.post("/admin/seed-services")
def seed_services(db: Session = Depends(get_db)):

    services_data = [
        {"name": "Открытие ЭЦП (физическое лицо)", "price": 1500},
        {"name": "Открытие ЭЦП (юридическое лицо)", "price": 3000},
        {"name": "Прописка", "price": 3500},
        {"name": "Справки ЕГОВ (псих, нарко, не судимость и т.д.)", "price": 700},
        {"name": "Налоговые справки (ПКБ, ПКО и т.д.)", "price": 3000},
        {"name": "Заявка на земельный акт", "price": 6000},
        {"name": "Очередь в детский сад", "price": 3000},
        {"name": "Очередь в детский сад с регистрацией", "price": 5000},
        {"name": "Открытие ИП", "price": 5000},
        {"name": "Открытие ТОО", "price": 15000},
        {"name": "Внесение правового кадастра", "price": 7000},
        {"name": "Утверждение земельного проекта", "price": 7000},
        {"name": "Изменение целевого назначения", "price": 7000},
        {"name": "Медицинский сертификат", "price": 7000},
        {"name": "Удостоверение охотника, тракториста", "price": 5000},
        {"name": "Приобретение оружия", "price": 10000},
        {"name": "Хранение и ношение оружия", "price": 10000},
        {"name": "Технический паспорт недвижимости", "price": 7000},
        {"name": "Прикрепление к поликлинике", "price": 3000},
        {"name": "Перевод со школы к школе", "price": 3000},
        {"name": "Заключение брака", "price": 5000},
        {"name": "Расторжение брака", "price": 7000},
        {"name": "Подача на алименты", "price": 7000},
        {"name": "Все обращения через Е-OTINISH", "price": 5000},
        {"name": "Больничный лист", "price": 2000},
        {"name": "Международные перевозки", "price": 10000},
        {"name": "Приватизация жилья", "price": 15000},
        {"name": "АО КЖК", "price": 10000},
        {"name": "Регистрация в ЕНБЕК.КЗ", "price": 5000},
        {"name": "ЕНБЕК.КЗ, безработица до выплаты", "price": 10000},
        {"name": "РБП, Е-КОНАК", "price": 10000},
        {"name": "ЭСФ регистрация", "price": 5000},
        {"name": "Перевод паспорта", "price": 5000},
        {"name": "Перевод узбекский", "price": 5000},
        {"name": "ЕНПФ-1 Этап", "price": 5000},
        {"name": "ЕНПФ-2 Этап", "price": 5000},
        {"name": "Воинский учет", "price": 5000},
        {"name": "Продление водительского удостоверения", "price": 5000},
        {"name": "Распоряжение имущества", "price": 5000},
        {"name": "Повторное получение свидетельства о рождения", "price": 5000},
        {"name": "Архивный запрос", "price": 5000},
        {"name": "Принятие на 1-ый класс", "price": 5000},
        {"name": "Договор найма", "price": 5000},
        {"name": "Договор найма с подписанием", "price": 7000},
        {"name": "Стоп кредит", "price": 2000},
        {"name": "БМГ", "price": 1500},
        {"name": "Дополнительный отвод", "price": 20000},
        {"name": "Алкогольная лицензия", "price": 20000},
        {"name": "Очередь на землю", "price": 3000},
        {"name": "Очередь на дом", "price": 5000},
        {"name": "Смена руководителя ТОО", "price": 10000},
    ]

    for service in services_data:
        db.add(Service(**service))

    db.commit()

    return {"status": "services added"}

# ================= FRONTEND =================

import os
from fastapi.staticfiles import StaticFiles

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

print("BASE_DIR:", BASE_DIR)
print("FRONTEND_DIR:", FRONTEND_DIR)

app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)