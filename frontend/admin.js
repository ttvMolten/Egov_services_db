const API = "";
const AUTH_KEY = "auth_user";

/* ================= TOAST ================= */

function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    toast.textContent = message;

    toast.className =
        "fixed top-5 right-5 px-6 py-3 rounded-xl shadow-lg transition";

    if (type === "success") {
        toast.classList.add("bg-green-600", "text-white");
    } else {
        toast.classList.add("bg-red-600", "text-white");
    }

    toast.classList.remove("hidden");

    setTimeout(() => {
        toast.classList.add("hidden");
    }, 2500);
}

/* ================= AUTH CHECK ================= */

async function checkAdmin() {
    let auth = JSON.parse(localStorage.getItem(AUTH_KEY));

    if (!auth || auth.role !== "ADMIN") {

        const pin = prompt("Введите PIN администратора");
        if (!pin) {
            location.href = "index.html";
            return;
        }

        const res = await fetch(`${API}/auth/pin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin })
        });

        if (!res.ok) {
            location.href = "index.html";
            return;
        }

        const data = await res.json();

        if (data.role !== "ADMIN") {
            location.href = "index.html";
            return;
        }

        localStorage.setItem(AUTH_KEY, JSON.stringify(data));
        auth = data;
    }

    return auth;
}

/* ================= LOAD REPORT ================= */

async function loadReport() {

    const auth = JSON.parse(localStorage.getItem(AUTH_KEY));
    if (!auth) return;

    const res = await fetch(`${API}/admin/report/today?employee_id=${auth.employee_id}`);

    if (!res.ok) return;

    const data = await res.json();

    document.getElementById("reportDate").textContent =
        `Дата: ${data.date}`;

    const table = document.getElementById("reportTable");
    table.innerHTML = "";

    data.employees.forEach(emp => {

        const row = document.createElement("tr");
        row.className =
            "hover:bg-gray-50 cursor-pointer transition";

        row.addEventListener("click", () => {
            openEmployeeReport(emp.employee_id, emp.employee);
        });

        row.innerHTML = `
    <td class="p-3 font-semibold text-blue-600">${emp.employee}</td>
    <td class="p-3 text-center">${emp.services_count}</td>
    <td class="p-3 text-center">${emp.total} ₸</td>
    <td class="p-3 text-center">${emp.cash} ₸</td>
    <td class="p-3 text-center">${emp.qr} ₸</td>
    <td class="p-3 text-center">${emp.transfer} ₸</td>

    <td class="p-3 text-center">
        <button onclick="deactivateEmployee(${emp.employee_id})"
            class="bg-red-500 text-white px-3 py-1 rounded">
            Уволить
        </button>
    </td>
`;

        table.appendChild(row);
    });

    document.getElementById("totalBox").innerHTML = `
        <div class="mt-4 p-4 bg-gray-100 rounded-xl text-lg font-semibold">
            💰 Общая касса: ${data.total_all} ₸ <br>
            <span class="text-green-600">Нал: ${data.cash_all} ₸</span> |
            <span class="text-blue-600">QR: ${data.qr_all} ₸</span>
            <span class="text-blue-600">Перевод: ${data.transfer_all} ₸</span>
        </div>
    `;
}

/* ================= EMPLOYEE DETAILS ================= */

async function openEmployeeReport(employeeId, employeeName) {

    const auth = JSON.parse(localStorage.getItem(AUTH_KEY));

    const res = await fetch(
        `${API}/admin/employee/today?employee_id=${auth.employee_id}&target_employee_id=${employeeId}`
    );

    if (!res.ok) return;

    const data = await res.json();

    const modal = document.getElementById("modal");
    const modalTitle = document.getElementById("modalTitle");
    const modalContent = document.getElementById("modalContent");

    modalTitle.textContent = `Отчёт: ${employeeName}`;
    modalContent.innerHTML = "";

    if (!data.orders.length) {
        modalContent.innerHTML = `<p class="text-gray-500">Нет заказов</p>`;
    }

   data.orders.forEach(o => {

    const block = document.createElement("div");
    block.className = "border-b pb-3 mb-3";

    block.innerHTML = `
        <div class="mb-2">
            <p class="font-semibold">${o.service}</p>

            <p class="text-lg font-bold">
                ${o.price} ₸
            </p>

            <p class="text-sm text-gray-500">
                Заказ #${o.order_id}
                |
                ${o.status}
                |
                ${o.payment_type || "-"}
            </p>

            ${
                o.client_name
                    ? `<p class="text-sm text-gray-500">
                        Клиент: ${o.client_name}
                       </p>`
                    : ""
            }
        </div>

        ${
            o.status === "COMPLETED"
                ? `
                    <div class="flex gap-2">
                        <button
                            onclick="refundOrder(${o.order_id}, ${o.price})"
                            class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg">
                            ↩️ Возврат
                        </button>

                        <button
                            onclick="correctOrder(${o.order_id})"
                            class="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg">
                            ✏️ Корректировка
                        </button>
                    </div>
                  `
                : ""
        }
    `;

    modalContent.appendChild(block);
});

    const totals = document.createElement("div");
    totals.className = "mt-4 font-semibold";

    totals.innerHTML = `
        Итого: ${data.total} ₸ <br>
        Нал: ${data.cash} ₸ <br>
        QR: ${data.qr} ₸
    `;

    modalContent.appendChild(totals);

    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function closeModal() {
    const modal = document.getElementById("modal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}

/* ================= SEND TELEGRAM ================= */

document.addEventListener("DOMContentLoaded", () => {

    const btn = document.getElementById("sendReport");
    if (!btn) return;

    btn.onclick = async () => {

        const auth = JSON.parse(localStorage.getItem(AUTH_KEY));
        if (!auth) return;

        btn.disabled = true;

        const res = await fetch(
            `${API}/admin/report/today/send?employee_id=${auth.employee_id}`,
            { method: "POST" }
        );

        if (res.ok) {
            showToast("Отчёт отправлен в Telegram");
        } else {
            showToast("Ошибка отправки", "error");
        }

        btn.disabled = false;
    };

});
document.getElementById("resetToday").onclick = async () => {

    if (!confirm("Вы уверены? Это сбросит сегодняшний отчёт.")) return;

    const auth = JSON.parse(localStorage.getItem(AUTH_KEY));

    await fetch(
        `${API}/admin/reset/today?employee_id=${auth.employee_id}`,
        { method: "POST" }
    );

    showToast("День сброшен");
    loadReport();
};
async function loadPeriodReport() {

    const auth = JSON.parse(localStorage.getItem(AUTH_KEY));

    const start = document.getElementById("startDate").value;
    const end = document.getElementById("endDate").value;

    if (!start || !end) {
        showToast("Выбери даты", "error");
        return;
    }

    const res = await fetch(
        `${API}/admin/report/period?employee_id=${auth.employee_id}&start_date=${start}&end_date=${end}`
    );

    const data = await res.json();

    renderReport(data);
}
function renderReport(data) {

    const table = document.getElementById("reportTable");
    table.innerHTML = "";

    data.employees.forEach(emp => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td class="p-3 font-semibold text-blue-600">${emp.employee}</td>
           <td class="p-3 text-center">${emp.services || emp.services_count}</td>
            <td class="p-3 text-center">${emp.total} ₸</td>
            <td class="p-3 text-center">${emp.cash} ₸</td>
            <td class="p-3 text-center">${emp.qr} ₸</td>
            <td class="p-3 text-center">${emp.transfer || 0} ₸</td>
        `;

        table.appendChild(row);
    });

    document.getElementById("totalBox").innerHTML = `
        <div class="mt-4 p-4 bg-gray-100 rounded-xl text-lg font-semibold">
            💰 Общая касса: ${data.total_all} ₸ <br>
            <span class="text-green-600">Нал: ${data.cash_all} ₸</span> |
            <span class="text-blue-600">QR: ${data.qr_all} ₸</span> |
            <span class="text-purple-600">Перевод: ${data.transfer_all || 0} ₸</span>
        </div>
    `;
}

async function deactivateEmployee(id) {

    if (!confirm("Уволить сотрудника?")) return;

    const res = await fetch(`${API}/employees/${id}/deactivate`, {
        method: "POST"
    });

    if (res.ok) {
        showToast("Сотрудник уволен");
        loadEmployees(); // обновить список
    } else {
        showToast("Ошибка", "error");
    }
}
/* ================= REFUND ================= */

async function refundOrder(orderId, orderPrice) {

    const auth = JSON.parse(localStorage.getItem(AUTH_KEY));

    if (!auth) return;

    const amountInput = prompt(
        `Сумма возврата для заказа #${orderId}\n\nМаксимум: ${orderPrice} ₸`,
        orderPrice
    );

    if (amountInput === null) return;

    const amount = Number(amountInput);

    if (!Number.isInteger(amount) || amount <= 0) {
        showToast("Введите корректную сумму", "error");
        return;
    }

    if (amount > orderPrice) {
        showToast("Сумма возврата больше стоимости заказа", "error");
        return;
    }

    const reason = prompt(
        "Причина возврата:"
    );

    if (!reason || !reason.trim()) {
        showToast("Укажите причину возврата", "error");
        return;
    }

    const paymentTypeInput = prompt(
        "Способ возврата:\n\nCASH — наличные\nQR — QR\nTRANSFER — перевод",
        "CASH"
    );

    if (!paymentTypeInput) return;

    const paymentType = paymentTypeInput.toUpperCase();

    if (!["CASH", "QR", "TRANSFER"].includes(paymentType)) {
        showToast("Неверный способ возврата", "error");
        return;
    }

    if (!confirm(
        `Оформить возврат?\n\n` +
        `Заказ: #${orderId}\n` +
        `Сумма: ${amount} ₸\n` +
        `Способ: ${paymentType}\n` +
        `Причина: ${reason}`
    )) {
        return;
    }

    const res = await fetch(
        `${API}/orders/${orderId}/refund?employee_id=${auth.employee_id}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                amount: amount,
                payment_type: paymentType,
                reason: reason.trim()
            })
        }
    );

    const data = await res.json();

    if (!res.ok) {
        showToast(
            data.detail || "Ошибка возврата",
            "error"
        );
        return;
    }

    showToast(`Возврат ${amount} ₸ оформлен`);

    closeModal();
    await loadReport();
}
/* ================= CORRECTION ================= */

async function correctOrder(orderId) {

    const auth = JSON.parse(localStorage.getItem(AUTH_KEY));

    if (!auth) return;

    const servicesRes = await fetch(`${API}/services`);

    if (!servicesRes.ok) {
        showToast("Не удалось загрузить услуги", "error");
        return;
    }

    const services = await servicesRes.json();

    let serviceList = "Выберите новую услугу:\n\n";

    services.forEach(service => {
        serviceList +=
            `${service.id} — ${service.name} — ${service.price} ₸\n`;
    });

    const serviceIdInput = prompt(serviceList);

    if (serviceIdInput === null) return;

    const newServiceId = Number(serviceIdInput);

    const selectedService = services.find(
        service => service.id === newServiceId
    );

    if (!selectedService) {
        showToast("Услуга не найдена", "error");
        return;
    }

    const priceInput = prompt(
        `Новая цена для:\n${selectedService.name}`,
        selectedService.price
    );

    if (priceInput === null) return;

    const newPrice = Number(priceInput);

    if (!Number.isInteger(newPrice) || newPrice < 0) {
        showToast("Введите корректную цену", "error");
        return;
    }

    const reason = prompt(
        "Причина корректировки:"
    );

    if (!reason || !reason.trim()) {
        showToast("Укажите причину корректировки", "error");
        return;
    }

    if (!confirm(
        `Изменить заказ #${orderId}?\n\n` +
        `Новая услуга: ${selectedService.name}\n` +
        `Новая цена: ${newPrice} ₸\n` +
        `Причина: ${reason}`
    )) {
        return;
    }

    const res = await fetch(
        `${API}/orders/${orderId}/correction?employee_id=${auth.employee_id}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                new_service_id: newServiceId,
                new_price: newPrice,
                reason: reason.trim()
            })
        }
    );

    const data = await res.json();

    if (!res.ok) {
        showToast(
            data.detail || "Ошибка корректировки",
            "error"
        );
        return;
    }

    showToast("Заказ скорректирован");

    closeModal();
    await loadReport();
}
/* ================= LOGOUT ================= */

document.getElementById("logoutBtn").onclick = () => {
    localStorage.removeItem(AUTH_KEY);
    location.href = "index.html";
};

/* ================= SERVICES MANAGEMENT ================= */

async function loadServices() {

    const res = await fetch(`${API}/services`);

    if (!res.ok) {
        showToast("Ошибка загрузки услуг", "error");
        return;
    }

    const services = await res.json();

    const table = document.getElementById("servicesTable");
    table.innerHTML = "";

    services.forEach(service => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td class="p-3 font-medium">
                ${service.name}
            </td>

            <td class="p-3 text-center font-semibold">
                ${service.price} ₸
            </td>

            <td class="p-3 text-center">
                <button
                    onclick="changeServicePrice(${service.id}, '${service.name.replace(/'/g, "\\'")}', ${service.price})"
                    class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded-lg">
                    ✏️ Изменить
                </button>
            </td>
        `;

        table.appendChild(row);
    });
}


async function changeServicePrice(serviceId, serviceName, currentPrice) {

    const newPrice = prompt(
        `Изменить цену:\n${serviceName}\n\nТекущая цена: ${currentPrice} ₸`,
        currentPrice
    );

    if (newPrice === null) return;

    const price = Number(newPrice);

    if (!Number.isInteger(price) || price < 0) {
        showToast("Введите корректную цену", "error");
        return;
    }

    const res = await fetch(
        `${API}/services/${serviceId}/price?price=${price}`,
        {
            method: "PUT"
        }
    );

    if (!res.ok) {
        showToast("Не удалось изменить цену", "error");
        return;
    }

    showToast("Цена успешно изменена");

    await loadServices();
}
/* ================= INIT ================= */

(async () => {
    await checkAdmin();
    await loadReport();
    await loadServices();

    setInterval(loadReport, 60000);
})();