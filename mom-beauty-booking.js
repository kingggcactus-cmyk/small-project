const slots = [
  "09:00 - 10:30",
  "10:30 - 12:00",
  "12:00 - 13:30",
  "13:30 - 15:00",
  "15:00 - 16:30",
  "16:30 - 18:00"
];

const statusText = {
  pending: "等待確認",
  confirmed: "已確認",
  cancelled: "已取消"
};

const form = document.querySelector("#bookingForm");
const dateInput = document.querySelector("#date");
const slotGrid = document.querySelector("#slotGrid");
const bookingList = document.querySelector("#bookingList");
const summary = document.querySelector("#summary");
const message = document.querySelector("#message");
const memo = document.querySelector("#memo");
const clearDone = document.querySelector("#clearDone");
let selectedSlot = "";
const API_BASE = "/api/bookings";

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function loadBookings() {
  return apiRequest(API_BASE);
}

async function createBooking(booking) {
  return apiRequest(API_BASE, {
    method: "POST",
    body: JSON.stringify(booking)
  });
}

async function updateBookingStatus(id, status) {
  return apiRequest(`${API_BASE}/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

async function clearCancelledBookings() {
  return apiRequest(`${API_BASE}/cancelled`, {
    method: "DELETE"
  });
}

function todayString() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function formatDate(value) {
  const date = new Date(value + "T00:00:00");
  return new Intl.DateTimeFormat("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(date);
}

function isSunday(value) {
  return new Date(value + "T00:00:00").getDay() === 0;
}

function unavailableSlots(bookings) {
  const date = dateInput.value;
  return new Set(
    bookings
      .filter((booking) => booking.date === date && booking.status !== "cancelled")
      .map((booking) => booking.slot)
  );
}

async function renderSlots() {
  const bookings = await loadBookings();
  const unavailable = unavailableSlots(bookings);
  slotGrid.innerHTML = "";

  slots.forEach((slot) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slot";
    button.textContent = slot;
    button.setAttribute("aria-pressed", selectedSlot === slot ? "true" : "false");
    button.disabled = isSunday(dateInput.value) || unavailable.has(slot);
    button.addEventListener("click", async () => {
      selectedSlot = slot;
      await renderSlots();
    });
    slotGrid.append(button);
  });
}

async function renderBookings() {
  const bookings = (await loadBookings()).sort((a, b) => {
    return (a.date + a.slot).localeCompare(b.date + b.slot);
  });

  summary.textContent = `目前 ${bookings.length} 筆預約`;
  bookingList.innerHTML = "";

  if (bookings.length === 0) {
    bookingList.innerHTML = '<div class="empty">還沒有預約。</div>';
    return;
  }

  bookings.forEach((booking) => {
    const item = document.createElement("article");
    item.className = "booking";
    item.innerHTML = `
      <div class="booking-top">
        <div>
          <h3>${escapeHtml(booking.name)}｜${formatDate(booking.date)}</h3>
          <p class="meta">${booking.slot}<br>${escapeHtml(booking.contact)}</p>
        </div>
        <span class="status ${booking.status}">${statusText[booking.status]}</span>
      </div>
      <p class="memo">${escapeHtml(booking.memo || "沒有備註")}</p>
      <div class="actions">
        <button class="action confirm" type="button" data-id="${booking.id}" data-status="confirmed">確認</button>
        <button class="action cancel" type="button" data-id="${booking.id}" data-status="cancelled">取消</button>
      </div>
    `;
    bookingList.append(item);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function initBookingPage() {
  dateInput.min = todayString();
  dateInput.value = todayString();
  await renderSlots();

  dateInput.addEventListener("change", async () => {
    selectedSlot = "";
    await renderSlots();
  });

  document.querySelectorAll(".quick-note").forEach((button) => {
    button.addEventListener("click", () => {
      const note = button.dataset.note;
      memo.value = memo.value ? `${memo.value}、${note}` : note;
      memo.focus();
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSunday(dateInput.value)) {
      alert("星期日不開放預約，請選星期一到星期六。");
      return;
    }

    if (!selectedSlot) {
      alert("請先選擇預約時間。");
      return;
    }

    const bookings = await loadBookings();
    const alreadyTaken = bookings.some((booking) => {
      return booking.date === dateInput.value && booking.slot === selectedSlot && booking.status !== "cancelled";
    });

    if (alreadyTaken) {
      alert("這個時段已經有人預約，請選其他時間。");
      await renderSlots();
      return;
    }

    const newBooking = {
      id: crypto.randomUUID(),
      date: dateInput.value,
      slot: selectedSlot,
      name: form.name.value.trim(),
      contact: form.contact.value.trim(),
      memo: memo.value.trim(),
      status: "pending",
      createdAt: new Date().toISOString()
    };

    await createBooking(newBooking);
    form.reset();
    dateInput.value = todayString();
    selectedSlot = "";
    message.classList.add("show");
    setTimeout(() => message.classList.remove("show"), 4200);
    await renderSlots();
  });
}

async function initAdminPage() {
  let viewMonth = new Date();
  
  const prevMonth = document.querySelector("#prevMonth");
  const nextMonth = document.querySelector("#nextMonth");

  await renderBookings();
  await renderCalendar(viewMonth);

  prevMonth.addEventListener("click", async () => {
    viewMonth.setMonth(viewMonth.getMonth() - 1);
    await renderCalendar(viewMonth);
  });

  nextMonth.addEventListener("click", async () => {
    viewMonth.setMonth(viewMonth.getMonth() + 1);
    await renderCalendar(viewMonth);
  });

  bookingList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-status]");
    if (!button) return;

    await updateBookingStatus(button.dataset.id, button.dataset.status);
    await renderBookings();
    await renderCalendar(viewMonth);
  });

  clearDone.addEventListener("click", async () => {
    await clearCancelledBookings();
    await renderBookings();
    await renderCalendar(viewMonth);
  });
}

async function renderCalendar(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Update header
  const monthName = new Intl.DateTimeFormat("zh-TW", { month: "long", year: "numeric" }).format(viewDate);
  document.querySelector("#calendarMonth").textContent = monthName;

  // Get confirmed bookings
  const bookings = (await loadBookings()).filter((b) => b.status === "confirmed");
  const bookingsByDate = {};

  bookings.forEach((booking) => {
    if (!bookingsByDate[booking.date]) {
      bookingsByDate[booking.date] = [];
    }
    bookingsByDate[booking.date].push(booking);
  });

  // Generate calendar
  const calendarGrid = document.querySelector("#calendarGrid");
  calendarGrid.innerHTML = "";

  // Weekday headers
  const weekdayHeader = document.createElement("div");
  weekdayHeader.className = "calendar-header";
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  weekdays.forEach((day) => {
    const header = document.createElement("div");
    header.className = "calendar-weekday";
    header.textContent = day;
    weekdayHeader.append(header);
  });
  calendarGrid.append(weekdayHeader);

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayString();

  // Previous month days
  const prevMonth = new Date(year, month, 0);
  const daysInPrevMonth = prevMonth.getDate();

  for (let i = daysInPrevMonth - firstDay + 1; i <= daysInPrevMonth; i++) {
    const dayEl = createCalendarDay(i, month - 1, year, null, true);
    calendarGrid.append(dayEl);
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayBookings = bookingsByDate[dateStr] || [];
    const isToday = dateStr === today;
    const dayEl = createCalendarDay(day, month, year, dayBookings, false, isToday);
    calendarGrid.append(dayEl);
  }

  // Next month days
  for (let day = 1; day <= 42 - firstDay - daysInMonth; day++) {
    const dayEl = createCalendarDay(day, month + 1, year, null, true);
    calendarGrid.append(dayEl);
  }
}

function createCalendarDay(day, month, year, bookings, isOtherMonth, isToday) {
  const dayEl = document.createElement("div");
  dayEl.className = "calendar-day";

  if (isOtherMonth) {
    dayEl.classList.add("other-month");
  } else if (isToday) {
    dayEl.classList.add("today");
  }

  const dayNum = document.createElement("div");
  dayNum.className = "day-num";
  dayNum.textContent = day;
  dayEl.append(dayNum);

  if (!isOtherMonth && bookings && bookings.length > 0) {
    const itemsEl = document.createElement("div");
    itemsEl.className = "day-items";

    bookings.forEach((booking) => {
      const item = document.createElement("div");
      item.className = "day-item";
      item.textContent = `${booking.slot.substring(0, 5)} ${booking.name}`;
      itemsEl.append(item);
    });

    dayEl.append(itemsEl);

    dayEl.addEventListener("click", () => {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      showDetailForDate(dateStr, bookings);

      // Update selected state
      document.querySelectorAll(".calendar-day").forEach((d) => {
        d.classList.remove("selected");
      });
      dayEl.classList.add("selected");
    });
  } else if (!isOtherMonth) {
    dayEl.addEventListener("click", () => {
      // Clear detail when clicking empty day
      const detailContent = document.querySelector("#detailContent");
      detailContent.innerHTML = '<div class="empty">此日期沒有預約</div>';
      const detailDate = document.querySelector("#detailDate");
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      detailDate.textContent = formatDate(dateStr);

      // Update selected state
      document.querySelectorAll(".calendar-day").forEach((d) => {
        d.classList.remove("selected");
      });
      dayEl.classList.add("selected");
    });
  }

  return dayEl;
}

function showDetailForDate(dateStr, bookings) {
  const detailDate = document.querySelector("#detailDate");
  const detailContent = document.querySelector("#detailContent");

  detailDate.textContent = formatDate(dateStr);
  detailContent.innerHTML = "";

  if (!bookings || bookings.length === 0) {
    detailContent.innerHTML = '<div class="empty">此日期沒有預約</div>';
    return;
  }

  // Sort bookings by slot
  const sorted = [...bookings].sort((a, b) => {
    return a.slot.localeCompare(b.slot);
  });

  sorted.forEach((booking) => {
    const item = document.createElement("div");
    item.className = "detail-item";
    item.innerHTML = `
      <div class="detail-label">時間</div>
      <div class="detail-value">${booking.slot}</div>

      <div class="detail-label">姓名</div>
      <div class="detail-value">${escapeHtml(booking.name)}</div>

      <div class="detail-label">聯絡方式</div>
      <div class="detail-value">${escapeHtml(booking.contact)}</div>

      <div class="detail-label">備註</div>
      <div class="detail-value">${escapeHtml(booking.memo || "沒有備註")}</div>

      <div class="detail-label">狀態</div>
      <div class="detail-value">
        <span class="status confirmed">已確認</span>
      </div>
    `;
    detailContent.append(item);
  });
}

if (form) {
  initBookingPage();
}

if (bookingList) {
  initAdminPage();
}
