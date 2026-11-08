import { availableSlots, createAppointment, deleteAppointment, listAppointments, vietnamDate } from './appointments.js';

const formatDate = stamp => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'full', timeStyle: 'short' }).format(new Date(stamp));
const errorText = error => error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';

export function mountBooking(dialog, topic = '', onSaved = () => {}) {
  dialog.innerHTML = `
    <div class="dialog-header"><div><span class="eyebrow">MỘT CUỘC TRÒ CHUYỆN HỮU ÍCH</span><h2>Đặt lịch tư vấn</h2></div><button class="icon-button close-dialog" type="button" aria-label="Đóng đặt lịch">×</button></div>
    <p class="dialog-intro">Dành 30 phút cùng tư vấn viên để tìm giải pháp phù hợp với website của bạn.</p>
    <form class="booking-form">
      <div class="form-grid"><label class="field">Ngày tư vấn<input name="date" type="date" required></label><label class="field">Giờ tư vấn (UTC+7)<select name="time" required><option value="">Chọn giờ</option></select></label></div>
      <div class="form-grid"><label class="field">Họ và tên<input name="customerName" autocomplete="name" maxlength="80" placeholder="Nguyễn An" required></label><label class="field">Số điện thoại<input name="phone" type="tel" autocomplete="tel" maxlength="24" placeholder="0912 345 678" required></label></div>
      <label class="field">Bạn muốn trao đổi về điều gì?<textarea name="consultationTopic" maxlength="500" rows="3" placeholder="Chọn gói hosting, chuyển website…"></textarea></label>
      <p class="notice">Lịch mẫu: mỗi ngày, 09:00–17:00, giờ Việt Nam. Lịch chỉ lưu trên trình duyệt này; chưa gửi đến nhân viên.</p>
      <p class="error" role="alert" hidden></p>
      <div class="actions"><button type="button" class="secondary-button cancel-booking">Để sau</button><button type="submit" class="primary-button">Xác nhận đặt lịch</button></div>
    </form>`;
  const form = dialog.querySelector('form');
  const date = form.elements.namedItem('date');
  const time = form.elements.namedItem('time');
  const error = form.querySelector('.error');
  form.elements.namedItem('consultationTopic').value = topic.slice(0, 500);
  date.min = vietnamDate();
  date.value = date.min;
  function updateSlots() {
    const selected = time.value;
    time.replaceChildren(new Option('Chọn giờ', ''));
    try {
      const available = availableSlots(date.value, listAppointments());
      available.forEach(slot => time.add(new Option(slot, slot)));
      if (available.includes(selected)) time.value = selected;
      error.hidden = true;
      if (!available.length) { error.textContent = 'Ngày này không còn giờ phù hợp. Vui lòng chọn ngày khác.'; error.hidden = false; }
    } catch (cause) { error.textContent = errorText(cause); error.hidden = false; }
  }
  date.onchange = updateSlots;
  updateSlots();
  dialog.querySelector('.close-dialog').onclick = () => dialog.close();
  dialog.querySelector('.cancel-booking').onclick = () => dialog.close();
  form.onsubmit = event => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const appointment = createAppointment(Object.fromEntries(new FormData(form)));
      dialog.innerHTML = `<div class="booking-success"><span class="success-mark" aria-hidden="true">✓</span><span class="eyebrow">ĐÃ LƯU TRÊN TRÌNH DUYỆT</span><h2>Lịch hẹn đã sẵn sàng.</h2><p class="saved-date"></p><p class="saved-name"></p><p class="notice">Đây là lịch hẹn demo, chưa gửi đến nhân viên. Bạn có thể xem và xóa lịch tại mục Lịch hẹn trên trình duyệt này.</p><div class="actions"><button class="primary-button" type="button">Tiếp tục trò chuyện</button><a class="secondary-button" href="#admin">Xem lịch hẹn</a></div></div>`;
      dialog.querySelector('.saved-date').textContent = formatDate(appointment.startsAt);
      dialog.querySelector('.saved-name').textContent = `${appointment.customerName} · ${appointment.phone}`;
      dialog.querySelector('button').onclick = () => dialog.close();
      dialog.querySelector('a').onclick = () => dialog.close();
      dialog.querySelector('button').focus();
      onSaved();
    } catch (cause) {
      error.textContent = errorText(cause);
      error.hidden = false;
      submit.disabled = false;
    }
  };
  dialog.setAttribute('aria-label', 'Đặt lịch tư vấn');
  if (!dialog.open) dialog.showModal();
}

export function renderAdmin(container) {
  container.innerHTML = `<div class="admin-heading"><div><span class="eyebrow">QUẢN TRỊ DEMO</span><h1>Lịch hẹn tư vấn</h1><p>Các cuộc hẹn được lưu trên trình duyệt hiện tại.</p></div><button type="button" class="secondary-button refresh-appointments">Làm mới</button></div><p class="notice">Dữ liệu cục bộ, không đồng bộ giữa các thiết bị. Xóa những lịch bạn đã xử lý.</p><p class="error" role="alert" hidden></p><div class="appointment-list"></div>`;
  container.querySelector('.refresh-appointments').onclick = () => renderAdmin(container);
  const error = container.querySelector('.error');
  const list = container.querySelector('.appointment-list');
  try {
    const items = listAppointments();
    if (!items.length) {
      list.innerHTML = '<div class="empty"><span aria-hidden="true">◇</span><h2>Chưa có lịch hẹn nào</h2><p>Khi bạn đặt lịch tư vấn, thông tin sẽ xuất hiện ở đây.</p><a href="#chat" class="primary-button">Về trang tư vấn</a></div>';
      return;
    }
    for (const item of items) {
      const card = document.createElement('article');
      card.className = 'appointment';
      const details = document.createElement('div');
      const name = document.createElement('h2');
      name.textContent = item.customerName;
      const when = document.createElement('p');
      when.textContent = formatDate(item.startsAt);
      const phone = document.createElement('p');
      phone.textContent = `Điện thoại: ${item.phone}`;
      const topic = document.createElement('p');
      topic.textContent = item.consultationTopic || 'Tư vấn hosting và tên miền';
      details.append(name, when, phone, topic);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'delete-button';
      button.textContent = 'Xóa lịch đã xử lý';
      button.onclick = () => {
        if (!confirm(`Xóa lịch của ${item.customerName} vào ${formatDate(item.startsAt)}?`)) return;
        try { deleteAppointment(item.id); renderAdmin(container); }
        catch (cause) { error.textContent = errorText(cause); error.hidden = false; }
      };
      card.append(details, button);
      list.append(card);
    }
  } catch (cause) { error.textContent = errorText(cause); error.hidden = false; }
}
