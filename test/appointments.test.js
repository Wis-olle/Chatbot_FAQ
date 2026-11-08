import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAppointment, listAppointments, deleteAppointment, availableSlots, vietnamDate, STORAGE_KEY } from '../appointments.js';

const now = new Date('2026-11-03T09:15:00+07:00');
const input = { date: '2026-11-04', time: '09:00', customerName: ' Nguyễn An ', phone: '+84 912 345 678', consultationTopic: 'Tư vấn hosting' };
function memory(value = null) {
  let data = value;
  return { getItem: () => data, setItem: (key, next) => { assert.equal(key, STORAGE_KEY); data = next; } };
}

test('booking survives reading and deleting only the selected appointment', () => {
  const storage = memory();
  assert.deepEqual(listAppointments(storage), []);
  const first = createAppointment(input, storage, now);
  const second = createAppointment({ ...input, time: '09:30' }, storage, now);
  assert.equal(first.customerName, 'Nguyễn An');
  assert.equal(first.phone, '0912345678');
  assert.equal(first.startsAt, '2026-11-04T09:00:00+07:00');
  assert.equal(listAppointments(storage).length, 2);
  deleteAppointment(first.id, storage);
  assert.deepEqual(listAppointments(storage).map(item => item.id), [second.id]);
});

test('invalid inputs and duplicate slot never change saved data', () => {
  const storage = memory();
  for (const changes of [{ date: '2026-02-30' }, { date: 'bad' }, { time: '17:00' }, { time: '09:15' }, { customerName: ' ' }, { phone: '123' }, { phone: '0912345678abc' }, { date: '2026-11-02' }, { consultationTopic: 'x'.repeat(501) }, { customerName: 'x'.repeat(81) }]) {
    assert.throws(() => createAppointment({ ...input, ...changes }, storage, now));
    assert.deepEqual(listAppointments(storage), []);
  }
  createAppointment(input, storage, now);
  assert.throws(() => createAppointment(input, storage, now), /đã được đặt/);
  assert.equal(listAppointments(storage).length, 1);
});

test('storage corruption and write denial are reported without erasing data', () => {
  for (const value of ['broken', '{}', '[{}]', '[null]', '[{"id":1}]']) {
    const storage = memory(value);
    assert.throws(() => listAppointments(storage), /dữ liệu/i);
    assert.throws(() => createAppointment(input, storage, now));
    assert.equal(storage.getItem(), value);
  }
  const denied = { getItem: () => null, setItem: () => { throw new Error('denied'); } };
  assert.throws(() => createAppointment(input, denied, now), /lưu/);
  const blocked = { getItem: () => { throw new Error('denied'); } };
  assert.throws(() => listAppointments(blocked), /đọc/);
});

test('slots obey Vietnam timezone, working hours, future times and occupied slots', () => {
  assert.equal(vietnamDate(new Date('2026-11-03T20:00:00Z')), '2026-11-04');
  assert.equal(availableSlots('2026-11-03', [], now)[0], '09:30');
  assert.equal(availableSlots('2026-11-04', [], now).at(-1), '16:30');
  assert.equal(availableSlots('2026-11-02', [], now).length, 0);
  assert.equal(availableSlots('bad', [], now).length, 0);
  const booked = createAppointment(input, memory(), now);
  assert.ok(!availableSlots('2026-11-04', [booked], now).includes('09:00'));
});
