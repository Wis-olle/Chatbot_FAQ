export const STORAGE_KEY = 'hosting-demo.appointments.v1';
const zone = 'Asia/Ho_Chi_Minh';
const slots = Array.from({ length: 16 }, (_, i) => `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
export function vietnamDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
export function availableSlots(date, appointments = [], now = new Date()) {
  if (!validDate(date)) return [];
  return slots.filter(time => {
    const stamp = `${date}T${time}:00+07:00`;
    return new Date(stamp) > now && !appointments.some(item => item.startsAt === stamp);
  });
}
function isAppointment(item) {
  return item && typeof item === 'object' &&
    ['id', 'customerName', 'phone', 'startsAt', 'consultationTopic', 'createdAt'].every(key => typeof item[key] === 'string') &&
    item.id.length > 0 && item.customerName.trim().length > 0 && item.customerName.length <= 80 &&
    /^0[35789]\d{8}$/.test(item.phone) && item.consultationTopic.length <= 500 &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+07:00$/.test(item.startsAt) &&
    validDate(item.startsAt.slice(0, 10)) && slots.includes(item.startsAt.slice(11, 16)) &&
    Number.isFinite(Date.parse(item.createdAt)) && item.timeZone === zone;
}
export function listAppointments(storage = localStorage) {
  let raw;
  try { raw = storage.getItem(STORAGE_KEY); }
  catch { throw new Error('Không thể đọc lịch hẹn. Hãy cho phép trình duyệt lưu dữ liệu.'); }
  if (raw === null) return [];
  try {
    const items = JSON.parse(raw);
    if (!Array.isArray(items) || !items.every(isAppointment) || new Set(items.map(item => item.id)).size !== items.length) throw new Error();
    return [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  } catch { throw new Error('Dữ liệu lịch hẹn không hợp lệ. Dữ liệu cũ được giữ nguyên; hãy kiểm tra bộ nhớ trình duyệt.'); }
}
function save(items, storage) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(items)); }
  catch { throw new Error('Không thể lưu thay đổi. Bộ nhớ có thể đã đầy hoặc bị chặn. Vui lòng thử lại.'); }
}
export function createAppointment(input, storage = localStorage, now = new Date()) {
  const customerName = String(input.customerName ?? '').trim();
  const rawPhone = String(input.phone ?? '').trim();
  const phone = rawPhone.replace(/[\s().-]/g, '').replace(/^\+84/, '0');
  const consultationTopic = String(input.consultationTopic ?? '').trim();
  if (!customerName || customerName.length > 80) throw new Error('Họ tên cần từ 1 đến 80 ký tự.');
  if (!/^[+\d\s().-]+$/.test(rawPhone) || !/^0[35789]\d{8}$/.test(phone)) throw new Error('Nhập số di động Việt Nam hợp lệ (10 số hoặc +84).');
  if (consultationTopic.length > 500) throw new Error('Nội dung tư vấn tối đa 500 ký tự.');
  if (!validDate(input.date) || !slots.includes(input.time)) throw new Error('Chọn ngày hợp lệ và giờ từ 09:00 đến 16:30.');
  const startsAt = `${input.date}T${input.time}:00+07:00`;
  if (new Date(startsAt) <= now) throw new Error('Vui lòng chọn thời gian trong tương lai.');
  const items = listAppointments(storage);
  if (items.some(item => item.startsAt === startsAt)) throw new Error('Khung giờ này đã được đặt. Vui lòng chọn giờ khác.');
  const item = { id: crypto.randomUUID(), customerName, phone, consultationTopic, startsAt, timeZone: zone, createdAt: now.toISOString() };
  // ponytail: localStorage is a single-browser demo; use a transactional backend for shared bookings.
  save([...items, item], storage);
  return item;
}
export function deleteAppointment(id, storage = localStorage) {
  save(listAppointments(storage).filter(item => item.id !== id), storage);
}
