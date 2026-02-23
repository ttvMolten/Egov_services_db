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

        result.append({
            "order_id": o.id,
            "service": o.service.name if o.service else "",
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

    total = sum(o.service.price for o in orders if o.service)
    cash = sum(o.service.price for o in orders if o.payment_type == "CASH" and o.service)
    qr = sum(o.service.price for o in orders if o.payment_type == "QR" and o.service)

    send_telegram(
        f"📊 Смена закрыта\n\n"
        f"Сотрудник: {shift.employee.name}\n"
        f"Услуг: {len(orders)}\n"
        f"Сумма: {total} ₸\n"
        f"Нал: {cash} ₸\n"
        f"QR: {qr} ₸"
    )

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

        total = sum(o.service.price for o in orders if o.service)
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

    message = "📊 Отчёт за сегодня\n\n"

    total_all = 0

    for emp in employees:
        orders = db.query(Order).filter(
            Order.employee_id == emp.id,
            Order.status == "COMPLETED",
            Order.payment_status == "PAID",
            Order.completed_at >= start_utc,
            Order.completed_at <= end_utc
        ).all()

        total = sum(o.service.price for o in orders if o.service)
        total_all += total

        message += (
            f"{emp.name}\n"
            f"Услуг: {len(orders)}\n"
            f"Сумма: {total} ₸\n\n"
        )

    message += f"💰 Общая касса: {total_all} ₸"

    send_telegram(message)

    return {"status": "sent"}

# ================= FRONTEND =================

# BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")

# # app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")