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
            <<td class="p-3 text-center">${emp.services_count}</td>
            <td class="p-3 text-center">${emp.total} ₸</td>
            <td class="p-3 text-center">${emp.cash} ₸</td>
            <td class="p-3 text-center">${emp.qr} ₸</td>
        `;

        table.appendChild(row);
    });

    document.getElementById("totalBox").innerHTML = `
        <div class="mt-4 p-4 bg-gray-100 rounded-xl text-lg font-semibold">
            💰 Общая касса: ${data.total_all} ₸ <br>
            <span class="text-green-600">Нал: ${data.cash_all} ₸</span> |
            <span class="text-blue-600">QR: ${data.qr_all} ₸</span>
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
        block.className = "border-b pb-2 mb-2";

        block.innerHTML = `
            <p class="font-semibold">${o.service}</p>
            <p>${o.price} ₸</p>
            <p class="text-sm text-gray-500">
                ${o.status} | ${o.payment_type || "-"}
            </p>
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

document.getElementById("sendReport").onclick = async () => {

    const auth = JSON.parse(localStorage.getItem(AUTH_KEY));
    if (!auth) return;

    const btn = document.getElementById("sendReport");
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

/* ================= LOGOUT ================= */

document.getElementById("logoutBtn").onclick = () => {
    localStorage.removeItem(AUTH_KEY);
    location.href = "index.html";
};

/* ================= INIT ================= */

(async () => {
    await checkAdmin();
    await loadReport();
    setInterval(loadReport, 60000);
})();