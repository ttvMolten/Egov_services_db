const API = "";
const AUTH_KEY = "auth_user";

/* ================= DOM ================= */

const pinScreen = document.getElementById("pinScreen");
const appScreen = document.getElementById("appScreen");

const pinBtn = document.getElementById("pinBtn");
const pinInput = document.getElementById("pinInput");
const pinError = document.getElementById("pinError");

const employeeName = document.getElementById("employeeName");
const logoutBtn = document.getElementById("logoutBtn");

const serviceSelect = document.getElementById("serviceSelect");
const clientName = document.getElementById("clientName");
const clientPhone = document.getElementById("clientPhone");
const startBtn = document.getElementById("startBtn");
const statusMsg = document.getElementById("statusMsg");
const inProgressList = document.getElementById("inProgressList");
const addServiceBtn = document.getElementById("addServiceBtn");
const selectedServicesContainer = document.getElementById("selectedServices");

let selectedServices = [];
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

/* ================= LOGIN ================= */

async function loginByPin() {
    const pin = pinInput.value.trim();
    if (!pin) return;

    const res = await fetch(`${API}/auth/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
    });

    if (!res.ok) {
        pinError.textContent = "Неверный PIN";
        return;
    }

    const data = await res.json();

    if (data.role !== "EMPLOYEE") {
        pinError.textContent = "Нет доступа";
        return;
    }

    localStorage.setItem(AUTH_KEY, JSON.stringify(data));
    showApp();
}

/* ================= SHOW APP ================= */

function showApp() {
    const auth = JSON.parse(localStorage.getItem(AUTH_KEY));
    if (!auth) return;

    pinScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");

    employeeName.textContent = `👤 ${auth.name}`;

    loadServices();
    loadInProgress();
}

/* ================= SERVICES ================= */

async function loadServices() {
    const res = await fetch(`${API}/services`);
    const services = await res.json();

    serviceSelect.innerHTML = "";

    services.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = `${s.name} — ${s.price} ₸`;
        serviceSelect.appendChild(opt);
    });
}

/* ================= START ORDER ================= */


startBtn.onclick = async () => {

    const auth = JSON.parse(localStorage.getItem(AUTH_KEY));
    if (!auth) return;

    const name = clientName.value.trim();
    const phone = clientPhone.value.trim();

    if (!selectedServices.length || !name || !phone) {
        showToast("Добавьте хотя бы одну услугу", "error");
        return;
    }

    startBtn.disabled = true;

    const res = await fetch(`${API}/orders/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            service_ids: selectedServices,
            branch_id: 1,
            employee_id: auth.employee_id,
            client_name: name,
            client_phone: phone
        })
    });

    const data = await res.json();

    if (data.order_id) {
        showToast("Услуги начаты");

        clientName.value = "";
        clientPhone.value = "";
        selectedServices = [];
        renderSelectedServices();

        loadInProgress();
    } else {
        showToast(data.error || "Ошибка", "error");
    }

    startBtn.disabled = false;
};

/* ================= IN PROGRESS ================= */

async function loadInProgress() {

    const auth = JSON.parse(localStorage.getItem(AUTH_KEY));
    if (!auth) return;

    inProgressList.innerHTML = "";

    const res = await fetch(`${API}/orders/in-progress?employee_id=${auth.employee_id}`);
    const orders = await res.json();

    if (!orders.length) {
        inProgressList.innerHTML =
            `<p class="text-gray-500 text-sm">Нет активных услуг</p>`;
        return;
    }

    orders.forEach(o => {

        // безопасный вывод
        const servicesText = o.services
            ? o.services.join(", ")
            : o.service;

        const card = document.createElement("div");
        card.className =
            "bg-white p-4 rounded-xl shadow space-y-3 transform transition hover:scale-[1.02]";

        card.innerHTML = `
            <div class="flex justify-between">
                <div>
                    <p class="font-semibold">${servicesText}</p>
                    <p class="text-sm text-gray-500">${o.client_name}</p>
                </div>
                <div class="text-sm">
                    ⏱ ${o.minutes_in_progress} мин
                </div>
            </div>

            <div class="flex gap-2">
                <button class="flex-1 bg-green-600 text-white py-2 rounded"
                    onclick="completeOrder(${o.order_id}, 'CASH')">
                    💵 Нал
                </button>

                <button class="flex-1 bg-blue-600 text-white py-2 rounded"
                    onclick="completeOrder(${o.order_id}, 'QR')">
                    📱 QR
                </button>

                <button class="flex-1 bg-red-600 text-white py-2 rounded"
                    onclick="failOrder(${o.order_id})">
                    ❌ Не оказана
                </button>
            </div>
        `;

        inProgressList.appendChild(card);
    });
}

/* ================= COMPLETE ================= */

async function completeOrder(orderId, type) {

    if (!confirm("Подтвердить завершение?")) return;

    await fetch(`${API}/orders/${orderId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_type: type })
    });

    showToast("Услуга завершена");
    loadInProgress();
}

/* ================= FAIL ================= */

async function failOrder(orderId) {

    const reason = prompt("Причина:");
    if (!reason) return;

    await fetch(`${API}/orders/${orderId}/not-provided`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
    });

    showToast("Отмечено как не оказано", "error");
    loadInProgress();
}

/* ================= LOGOUT ================= */

logoutBtn.onclick = async () => {

    const auth = JSON.parse(localStorage.getItem(AUTH_KEY));
    if (!auth) return;

    if (!confirm("Закрыть смену?")) return;

    await fetch(`${API}/shifts/end?employee_id=${auth.employee_id}`, {
        method: "POST"
    });

    localStorage.removeItem(AUTH_KEY);
    location.reload();
};

addServiceBtn.onclick = () => {
    const serviceId = Number(serviceSelect.value);

    if (!serviceId) return;

    // проверка чтобы не добавлять повторно
    if (selectedServices.includes(serviceId)) {
        showToast("Услуга уже добавлена", "error");
        return;
    }

    selectedServices.push(serviceId);

    renderSelectedServices();
};


function renderSelectedServices() {
    selectedServicesContainer.innerHTML = "";

    selectedServices.forEach(id => {

        const option = serviceSelect.querySelector(`option[value="${id}"]`);
        const name = option ? option.textContent : "Услуга";

        const item = document.createElement("div");
        item.className =
            "flex justify-between items-center bg-gray-100 px-3 py-2 rounded";

        item.innerHTML = `
            <span>${name}</span>
            <button class="text-red-600 text-sm"
                onclick="removeService(${id})">
                ✖
            </button>
        `;

        selectedServicesContainer.appendChild(item);
    });
}


function removeService(id) {
    selectedServices = selectedServices.filter(s => s !== id);
    renderSelectedServices();
}

/* ================= INIT ================= */

pinBtn.onclick = loginByPin;

if (localStorage.getItem(AUTH_KEY)) {
    showApp();
}

setInterval(loadInProgress, 60000);