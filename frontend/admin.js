const API = "";
const AUTH_KEY = "auth_user";


/* ================= TOAST ================= */

function showToast(message, type = "success") {

    const toast = document.getElementById("toast");

    if (!toast) return;

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

    let auth = JSON.parse(
        localStorage.getItem(AUTH_KEY)
    );

    if (!auth || auth.role !== "ADMIN") {

        const pin = prompt(
            "Введите PIN администратора"
        );

        if (!pin) {
            location.href = "index.html";
            return;
        }

        const res = await fetch(
            `${API}/auth/pin`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    pin
                })
            }
        );

        if (!res.ok) {
            location.href = "index.html";
            return;
        }

        const data = await res.json();

        if (data.role !== "ADMIN") {
            location.href = "index.html";
            return;
        }

        localStorage.setItem(
            AUTH_KEY,
            JSON.stringify(data)
        );

        auth = data;
    }

    return auth;
}


/* ================= LOAD TODAY REPORT ================= */

async function loadReport() {

    const auth = JSON.parse(
        localStorage.getItem(AUTH_KEY)
    );

    if (!auth) return;

    const res = await fetch(
        `${API}/admin/report/today?employee_id=${auth.employee_id}`
    );

    if (!res.ok) return;

    const data = await res.json();

    const reportDate =
        document.getElementById("reportDate");

    if (reportDate) {
        reportDate.textContent =
            `Дата: ${data.date}`;
    }

    renderReport(data);
}


/* ================= RENDER REPORT ================= */

function renderReport(data) {

    const table =
        document.getElementById("reportTable");

    if (!table) return;

    table.innerHTML = "";

    data.employees.forEach(emp => {

        const row =
            document.createElement("tr");

        row.className =
            "hover:bg-gray-50 cursor-pointer transition";

        /*
         * Сегодняшний отчёт содержит employee_id.
         * Поэтому по клику открываем подробности.
         */
        if (emp.employee_id) {

            row.addEventListener(
                "click",
                () => {
                    openEmployeeReport(
                        emp.employee_id,
                        emp.employee
                    );
                }
            );
        }

        row.innerHTML = `
            <td class="p-3 font-semibold text-blue-600">
                ${emp.employee}
            </td>

            <td class="p-3 text-center">
                ${emp.services_count ?? emp.services ?? 0}
            </td>

            <td class="p-3 text-center">
                ${emp.net_total ?? emp.total ?? 0} ₸
            </td>

            <td class="p-3 text-center">
                ${emp.cash ?? 0} ₸
            </td>

            <td class="p-3 text-center">
                ${emp.qr ?? 0} ₸
            </td>

            <td class="p-3 text-center">
                ${emp.transfer ?? 0} ₸
            </td>

            ${
                emp.employee_id
                    ? `
                        <td class="p-3 text-center">
                            <button
                                onclick="event.stopPropagation(); deactivateEmployee(${emp.employee_id})"
                                class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded">
                                Уволить
                            </button>
                        </td>
                    `
                    : ""
            }
        `;

        table.appendChild(row);
    });


    /* ================= TOTAL BOX ================= */

    const totalBox =
        document.getElementById("totalBox");

    if (!totalBox) return;

    const gross =
        data.total_all ?? 0;

    const refunds =
        data.refunds_all ?? 0;

    const net =
        data.net_all ?? data.total_all ?? 0;

    const cash =
        data.cash_all ?? 0;

    const qr =
        data.qr_all ?? 0;

    const transfer =
        data.transfer_all ?? 0;


    totalBox.innerHTML = `
        <div class="mt-4 p-5 bg-gray-100 rounded-xl">

            <div class="text-lg font-semibold mb-3">
                📊 Финансовый итог
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">

                <div class="bg-white rounded-xl p-4 shadow-sm">
                    <div class="text-sm text-gray-500">
                        💰 Продажи
                    </div>

                    <div class="text-xl font-bold">
                        ${gross} ₸
                    </div>
                </div>


                <div class="bg-white rounded-xl p-4 shadow-sm">

                    <div class="text-sm text-gray-500">
                        ↩️ Возвраты
                    </div>

                    <div class="text-xl font-bold text-red-600">
                        ${refunds} ₸
                    </div>

                </div>


                <div class="bg-white rounded-xl p-4 shadow-sm">

                    <div class="text-sm text-gray-500">
                        💵 Чистая касса
                    </div>

                    <div class="text-2xl font-bold text-green-600">
                        ${net} ₸
                    </div>

                </div>

            </div>


            <div class="mt-4 pt-4 border-t">

                <div class="font-semibold mb-2">
                    Способы оплаты
                </div>

                <div class="flex flex-wrap gap-4">

                    <span class="text-green-600">
                        Нал: ${cash} ₸
                    </span>

                    <span class="text-blue-600">
                        QR: ${qr} ₸
                    </span>

                    <span class="text-purple-600">
                        Перевод: ${transfer} ₸
                    </span>

                </div>

            </div>

        </div>
    `;
}


/* ================= EMPLOYEE DETAILS ================= */

async function openEmployeeReport(
    employeeId,
    employeeName
) {

    const auth =
        JSON.parse(
            localStorage.getItem(AUTH_KEY)
        );

    if (!auth) return;


    const res = await fetch(
        `${API}/admin/employee/today?employee_id=${auth.employee_id}&target_employee_id=${employeeId}`
    );


    if (!res.ok) {

        showToast(
            "Не удалось загрузить отчёт",
            "error"
        );

        return;
    }


    const data =
        await res.json();


    const modal =
        document.getElementById("modal");

    const modalTitle =
        document.getElementById("modalTitle");

    const modalContent =
        document.getElementById("modalContent");


    modalTitle.textContent =
        `Отчёт: ${employeeName}`;

    modalContent.innerHTML = "";


    if (!data.orders.length) {

        modalContent.innerHTML =
            `<p class="text-gray-500">
                Нет заказов
            </p>`;
    }


    data.orders.forEach(o => {

        const block =
            document.createElement("div");

        block.className =
            "border-b pb-4 mb-4";


        const refund =
            o.refund ?? 0;

        const netPrice =
            o.net_price ??
            Math.max(
                0,
                (o.price ?? 0) - refund
            );


        block.innerHTML = `

            <div class="mb-3">

                <p class="font-semibold text-lg">
                    ${o.service || "Без названия"}
                </p>


                <p class="text-sm text-gray-500">
                    Заказ #${o.order_id}
                </p>


                <p class="text-sm text-gray-500">
                    ${o.status}
                    |
                    ${o.payment_type || "-"}
                </p>


                ${
                    o.client_name
                        ? `
                            <p class="text-sm text-gray-500">
                                Клиент: ${o.client_name}
                            </p>
                          `
                        : ""
                }


                <div class="mt-3">

                    <p>
                        💰 Продажа:
                        <strong>
                            ${o.price ?? 0} ₸
                        </strong>
                    </p>


                    ${
                        refund > 0
                            ? `
                                <p class="text-red-600">
                                    ↩️ Возврат:
                                    <strong>
                                        ${refund} ₸
                                    </strong>
                                </p>
                              `
                            : ""
                    }


                    <p class="text-green-600 font-semibold">
                        💵 После возврата:
                        ${netPrice} ₸
                    </p>

                </div>

            </div>


            ${
                o.status === "COMPLETED"
                    ? `
                        <div class="flex flex-wrap gap-2">

                            ${
                                netPrice > 0
                                    ? `
                                        <button
                                            onclick="refundOrder(
                                                ${o.order_id},
                                                ${netPrice},
                                                '${o.payment_type || "CASH"}'
                                            )"
                                            class="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg">
                                            ↩️ Возврат
                                        </button>
                                      `
                                    : `
                                        <span class="bg-gray-200 text-gray-600 px-3 py-2 rounded-lg">
                                            Возвращено полностью
                                        </span>
                                      `
                            }


                            <button
                                onclick="correctOrder(${o.order_id})"
                                class="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg">
                                ✏️ Корректировка
                            </button>

                        </div>
                      `
                    : ""
            }

        `;

        modalContent.appendChild(block);
    });


    /* ================= EMPLOYEE TOTALS ================= */

    const totals =
        document.createElement("div");

    totals.className =
        "mt-5 p-4 bg-gray-100 rounded-xl";


    totals.innerHTML = `

        <div class="font-semibold text-lg mb-3">
            Финансовый итог
        </div>


        <p>
            💰 Продажи:
            ${data.total ?? 0} ₸
        </p>


        <p class="text-red-600">
            ↩️ Возвраты:
            ${data.refunds ?? 0} ₸
        </p>


        <p class="text-green-600 font-bold">
            💵 Чистая выручка:
            ${data.net_total ?? data.total ?? 0} ₸
        </p>


        <div class="mt-2 pt-2 border-t">

            <p>
                Нал:
                ${data.cash ?? 0} ₸
            </p>

            <p>
                QR:
                ${data.qr ?? 0} ₸
            </p>

            <p>
                Перевод:
                ${data.transfer ?? 0} ₸
            </p>

        </div>

    `;

    modalContent.appendChild(totals);


    modal.classList.remove("hidden");
    modal.classList.add("flex");
}


/* ================= CLOSE MODAL ================= */

function closeModal() {

    const modal =
        document.getElementById("modal");

    if (!modal) return;

    modal.classList.add("hidden");
    modal.classList.remove("flex");
}


/* ================= SEND TELEGRAM ================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const btn =
            document.getElementById("sendReport");

        if (btn) {

            btn.onclick =
                async () => {

                    const auth =
                        JSON.parse(
                            localStorage.getItem(AUTH_KEY)
                        );

                    if (!auth) return;

                    btn.disabled = true;


                    const res =
                        await fetch(
                            `${API}/admin/report/today/send?employee_id=${auth.employee_id}`,
                            {
                                method: "POST"
                            }
                        );


                    if (res.ok) {

                        showToast(
                            "Отчёт отправлен в Telegram"
                        );

                    } else {

                        showToast(
                            "Ошибка отправки",
                            "error"
                        );
                    }


                    btn.disabled = false;
                };
        }
    }
);


/* ================= RESET TODAY ================= */

const resetButton =
    document.getElementById("resetToday");

if (resetButton) {

    resetButton.onclick =
        async () => {

            if (
                !confirm(
                    "Вы уверены? Это сбросит сегодняшний отчёт."
                )
            ) {
                return;
            }


            const auth =
                JSON.parse(
                    localStorage.getItem(AUTH_KEY)
                );

            if (!auth) return;


            const res =
                await fetch(
                    `${API}/admin/reset/today?employee_id=${auth.employee_id}`,
                    {
                        method: "POST"
                    }
                );


            if (res.ok) {

                showToast(
                    "День сброшен"
                );

                await loadReport();

            } else {

                showToast(
                    "Ошибка сброса",
                    "error"
                );
            }
        };
}


/* ================= PERIOD REPORT ================= */

async function loadPeriodReport() {

    const auth =
        JSON.parse(
            localStorage.getItem(AUTH_KEY)
        );

    if (!auth) return;


    const start =
        document.getElementById("startDate").value;

    const end =
        document.getElementById("endDate").value;


    if (!start || !end) {

        showToast(
            "Выбери даты",
            "error"
        );

        return;
    }


    const res =
        await fetch(
            `${API}/admin/report/period?employee_id=${auth.employee_id}&start_date=${start}&end_date=${end}`
        );


    if (!res.ok) {

        showToast(
            "Ошибка загрузки отчёта",
            "error"
        );

        return;
    }


    const data =
        await res.json();


    renderReport(data);
}


/* ================= DEACTIVATE EMPLOYEE ================= */

async function deactivateEmployee(id) {

    if (
        !confirm(
            "Уволить сотрудника?"
        )
    ) {
        return;
    }


    const res =
        await fetch(
            `${API}/employees/${id}/deactivate`,
            {
                method: "POST"
            }
        );


    if (res.ok) {

        showToast(
            "Сотрудник уволен"
        );

        await loadReport();

    } else {

        showToast(
            "Ошибка",
            "error"
        );
    }
}


/* ================= REFUND ================= */

async function refundOrder(
    orderId,
    maxRefund,
    originalPaymentType = "CASH"
) {

    const auth =
        JSON.parse(
            localStorage.getItem(AUTH_KEY)
        );

    if (!auth) return;


    const amountInput =
        prompt(
            `Сумма возврата для заказа #${orderId}\n\nОстаток для возврата: ${maxRefund} ₸`,
            maxRefund
        );


    if (amountInput === null) return;


    const amount =
        Number(amountInput);


    if (
        !Number.isInteger(amount) ||
        amount <= 0
    ) {

        showToast(
            "Введите корректную сумму",
            "error"
        );

        return;
    }


    if (amount > maxRefund) {

        showToast(
            "Сумма возврата больше остатка",
            "error"
        );

        return;
    }


    const reason =
        prompt(
            "Причина возврата:"
        );


    if (
        !reason ||
        !reason.trim()
    ) {

        showToast(
            "Укажите причину возврата",
            "error"
        );

        return;
    }


    const paymentTypeInput =
        prompt(
            "Способ возврата:\n\nCASH — наличные\nQR — QR\nTRANSFER — перевод",
            originalPaymentType
        );


    if (!paymentTypeInput) return;


    const paymentType =
        paymentTypeInput
            .trim()
            .toUpperCase();


    if (
        ![
            "CASH",
            "QR",
            "TRANSFER"
        ].includes(paymentType)
    ) {

        showToast(
            "Неверный способ возврата",
            "error"
        );

        return;
    }


    if (
        !confirm(
            `Оформить возврат?\n\n` +
            `Заказ: #${orderId}\n` +
            `Сумма: ${amount} ₸\n` +
            `Способ: ${paymentType}\n` +
            `Причина: ${reason}`
        )
    ) {
        return;
    }


    const res =
        await fetch(
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


    const data =
        await res.json();


    if (!res.ok) {

        showToast(
            data.detail ||
            "Ошибка возврата",
            "error"
        );

        return;
    }


    showToast(
        `Возврат ${amount} ₸ оформлен`
    );


    closeModal();


    await loadReport();
}


/* ================= CORRECTION MODAL ================= */

function createCorrectionModal() {

    let modal =
        document.getElementById(
            "correctionModal"
        );

    if (modal) return modal;


    modal =
        document.createElement("div");

    modal.id =
        "correctionModal";

    modal.className =
        "fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50 p-4";


    modal.innerHTML = `

        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">

            <div class="flex justify-between items-center p-5 border-b">

                <h2
                    id="correctionTitle"
                    class="text-xl font-bold">
                    ✏️ Корректировка
                </h2>

                <button
                    id="closeCorrectionBtn"
                    class="text-gray-500 hover:text-gray-800 text-2xl">
                    ×
                </button>

            </div>


            <div class="p-5 overflow-y-auto max-h-[70vh]">

                <label class="block text-sm font-semibold mb-2">
                    Новая услуга
                </label>

                <select
                    id="correctionService"
                    class="w-full border border-gray-300 rounded-xl p-3 mb-5">
                </select>


                <label class="block text-sm font-semibold mb-2">
                    Новая цена
                </label>

                <input
                    id="correctionPrice"
                    type="number"
                    min="0"
                    class="w-full border border-gray-300 rounded-xl p-3 mb-5"
                />


                <label class="block text-sm font-semibold mb-2">
                    Причина корректировки
                </label>

                <textarea
                    id="correctionReason"
                    rows="4"
                    placeholder="Укажите причину..."
                    class="w-full border border-gray-300 rounded-xl p-3">
                </textarea>

            </div>


            <div class="flex justify-end gap-3 p-5 border-t">

                <button
                    id="cancelCorrectionBtn"
                    class="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300">
                    Отмена
                </button>

                <button
                    id="saveCorrectionBtn"
                    class="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white">
                    Сохранить
                </button>

            </div>

        </div>

    `;


    document.body.appendChild(modal);


    document
        .getElementById("closeCorrectionBtn")
        .onclick = () => {

            modal.classList.add("hidden");
            modal.classList.remove("flex");
        };


    document
        .getElementById("cancelCorrectionBtn")
        .onclick = () => {

            modal.classList.add("hidden");
            modal.classList.remove("flex");
        };


    return modal;
}


/* ================= CORRECTION ================= */

async function correctOrder(orderId) {

    const auth =
        JSON.parse(
            localStorage.getItem(AUTH_KEY)
        );

    if (!auth) return;


    const servicesRes =
        await fetch(
            `${API}/services`
        );


    if (!servicesRes.ok) {

        showToast(
            "Не удалось загрузить услуги",
            "error"
        );

        return;
    }


    const services =
        await servicesRes.json();


    if (!services.length) {

        showToast(
            "Список услуг пуст",
            "error"
        );

        return;
    }


    const modal =
        createCorrectionModal();


    const select =
        document.getElementById(
            "correctionService"
        );

    const priceInput =
        document.getElementById(
            "correctionPrice"
        );

    const reasonInput =
        document.getElementById(
            "correctionReason"
        );


    select.innerHTML = "";


    services.forEach(service => {

        const option =
            document.createElement("option");

        option.value =
            service.id;

        option.textContent =
            `${service.name} — ${service.price} ₸`;

        option.dataset.price =
            service.price;

        select.appendChild(option);
    });


    const updatePrice =
        () => {

            const selected =
                select.options[
                    select.selectedIndex
                ];

            if (!selected) return;

            priceInput.value =
                selected.dataset.price;
        };


    select.onchange =
        updatePrice;


    updatePrice();


    document.getElementById(
        "correctionTitle"
    ).textContent =
        `✏️ Корректировка заказа #${orderId}`;


    reasonInput.value = "";


    modal.classList.remove("hidden");
    modal.classList.add("flex");


    const saveBtn =
        document.getElementById(
            "saveCorrectionBtn"
        );


    /*
     * Убираем старый обработчик,
     * чтобы при повторном открытии
     * запрос не отправлялся несколько раз.
     */

    saveBtn.onclick =
        async () => {

            const newServiceId =
                Number(select.value);


            const newPrice =
                Number(priceInput.value);


            const reason =
                reasonInput.value.trim();


            if (
                !Number.isInteger(newPrice) ||
                newPrice < 0
            ) {

                showToast(
                    "Введите корректную цену",
                    "error"
                );

                return;
            }


            if (!reason) {

                showToast(
                    "Укажите причину корректировки",
                    "error"
                );

                return;
            }


            const selectedService =
                services.find(
                    service =>
                        service.id === newServiceId
                );


            if (!selectedService) {

                showToast(
                    "Услуга не найдена",
                    "error"
                );

                return;
            }


            if (
                !confirm(
                    `Изменить заказ #${orderId}?\n\n` +
                    `Новая услуга: ${selectedService.name}\n` +
                    `Новая цена: ${newPrice} ₸\n` +
                    `Причина: ${reason}`
                )
            ) {
                return;
            }


            saveBtn.disabled = true;


            const res =
                await fetch(
                    `${API}/orders/${orderId}/correction?employee_id=${auth.employee_id}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            new_service_id:
                                newServiceId,

                            new_price:
                                newPrice,

                            reason:
                                reason
                        })
                    }
                );


            const data =
                await res.json();


            saveBtn.disabled = false;


            if (!res.ok) {

                showToast(
                    data.detail ||
                    "Ошибка корректировки",
                    "error"
                );

                return;
            }


            modal.classList.add("hidden");
            modal.classList.remove("flex");


            showToast(
                "Заказ скорректирован"
            );


            closeModal();


            await loadReport();
        };
}


/* ================= SERVICES MANAGEMENT ================= */

async function loadServices() {

    const res =
        await fetch(
            `${API}/services`
        );


    if (!res.ok) {

        showToast(
            "Ошибка загрузки услуг",
            "error"
        );

        return;
    }


    const services =
        await res.json();


    const table =
        document.getElementById(
            "servicesTable"
        );


    if (!table) return;


    table.innerHTML = "";


    services.forEach(service => {

        const row =
            document.createElement("tr");


        const nameCell =
            document.createElement("td");

        nameCell.className =
            "p-3 font-medium";

        nameCell.textContent =
            service.name;


        const priceCell =
            document.createElement("td");

        priceCell.className =
            "p-3 text-center font-semibold";

        priceCell.textContent =
            `${service.price} ₸`;


        const actionCell =
            document.createElement("td");

        actionCell.className =
            "p-3 text-center";


        const button =
            document.createElement("button");

        button.className =
            "bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded-lg";

        button.textContent =
            "✏️ Изменить";


        button.onclick =
            () => {

                changeServicePrice(
                    service.id,
                    service.name,
                    service.price
                );
            };


        actionCell.appendChild(
            button
        );


        row.appendChild(
            nameCell
        );

        row.appendChild(
            priceCell
        );

        row.appendChild(
            actionCell
        );


        table.appendChild(
            row
        );
    });
}


/* ================= CHANGE SERVICE PRICE ================= */

async function changeServicePrice(
    serviceId,
    serviceName,
    currentPrice
) {

    const newPrice =
        prompt(
            `Изменить цену:\n${serviceName}\n\nТекущая цена: ${currentPrice} ₸`,
            currentPrice
        );


    if (newPrice === null) return;


    const price =
        Number(newPrice);


    if (
        !Number.isInteger(price) ||
        price < 0
    ) {

        showToast(
            "Введите корректную цену",
            "error"
        );

        return;
    }


    const res =
        await fetch(
            `${API}/services/${serviceId}/price?price=${price}`,
            {
                method: "PUT"
            }
        );


    if (!res.ok) {

        showToast(
            "Не удалось изменить цену",
            "error"
        );

        return;
    }


    showToast(
        "Цена успешно изменена"
    );


    await loadServices();
}


/* ================= LOGOUT ================= */

const logoutBtn =
    document.getElementById(
        "logoutBtn"
    );


if (logoutBtn) {

    logoutBtn.onclick =
        () => {

            localStorage.removeItem(
                AUTH_KEY
            );

            location.href =
                "index.html";
        };
}


/* ================= INIT ================= */

(async () => {

    await checkAdmin();

    await loadReport();

    await loadServices();

    setInterval(
        loadReport,
        60000
    );

})();