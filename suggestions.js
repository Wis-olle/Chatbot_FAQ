const defaults = Object.freeze([
  'Bạn có thể cho mình một ví dụ thực tế về nội dung vừa trao đổi không?',
  'Mình cần lưu ý những gì khi áp dụng nội dung này?',
  'Bước tiếp theo mình nên làm là gì?',
  'Bạn có thể giải thích chi tiết hơn về chủ đề này không?'
]);

function questionKey(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function relatedSuggestions(items, { fallback = [], message = '' } = {}) {
  const candidates = [...(Array.isArray(items) ? items : []), ...(Array.isArray(fallback) ? fallback : []), ...defaults];
  return candidates.reduce((selected, item) => {
    const value = typeof item === 'string' ? item : item?.question;
    if (selected.length === 3 || typeof value !== 'string') return selected;
    const question = value.trim().replace(/\s+/g, ' ');
    const key = questionKey(question);
    if (!key || question.length > 180 || key === questionKey(message) || selected.some(entry => questionKey(entry.question) === key)) return selected;
    const id = typeof item?.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(item.id) ? item.id : null;
    return [...selected, { ...(id ? { id } : {}), question }];
  }, []);
}
