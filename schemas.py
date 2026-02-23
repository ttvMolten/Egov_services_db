from pydantic import BaseModel

class ServiceCreate(BaseModel):
    name: str
    price: int


class OrderStart(BaseModel):
    service_id: int
    branch_id: int
    employee_id: int
    client_name: str
    client_phone: str


class OrderComplete(BaseModel):
    payment_type: str  # CASH | QR


class OrderNotProvided(BaseModel):
    reason: str


class PinAuth(BaseModel):
    pin: str


class EmployeeCreate(BaseModel):
    name: str
    branch_id: int
    pin: str
    role: str = "EMPLOYEE"