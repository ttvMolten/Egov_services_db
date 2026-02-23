from database import SessionLocal
from models import Employee

employees_data = [
    {"name": "Багдат", "branch_id": 1, "pin": "7777", "role": "EMPLOYEE"},
    {"name": "Жасулан", "branch_id": 1, "pin": "6543", "role": "EMPLOYEE"},
    {"name": "Айман", "branch_id": 1, "pin": "1213", "role": "EMPLOYEE"},
    {"name": "Айкоркем", "branch_id": 1, "pin": "3342", "role": "EMPLOYEE"},
    {"name": "Admin", "branch_id": 1, "pin": "7132", "role": "ADMIN"},
]

def seed():
    db = SessionLocal()

    for emp in employees_data:
        exists = db.query(Employee).filter(Employee.pin == emp["pin"]).first()

        if not exists:
            db.add(Employee(
                name=emp["name"],
                branch_id=emp["branch_id"],
                pin=emp["pin"],
                role=emp["role"],
                is_active=True
            ))

    db.commit()
    db.close()
    print("Employees seeded successfully")

if __name__ == "__main__":
    seed()