import { normalize, tokens } from './knowledge-text.js';

function serviceType(text) {
  const query = normalize(text);
  if (/\b(vps|n8n|automation)\b/.test(query)) return 'vps';
  if (/\bemail\b|thu dien tu/.test(query)) return 'email';
  if (/ten mien|\bdomain\b/.test(query)) return 'domain';
  if (/\b(hosting|host|website|blog)\b/.test(query)) return 'hosting';
  if (/\b(ssl|https|chung chi)\b/.test(query)) return 'ssl';
  return null;
}

export function isConcretePolicy(message) {
  // “Tự động hóa đơn hàng” describes automation, not a request for an invoice.
  const query = normalize(message).replace(/\btu dong hoa\b/g, 'automation');
  return /hoan tien|hoa don|ngan hang|uptime|\bsla\b|(?:sao luu|backup).*(?:bao nhieu|may lan|bao lau)/.test(query);
}

export function isRecommendation(message) {
  const query = normalize(message);
  if (isConcretePolicy(message)) return false;
  return /tu van|de xuat|goi y|phu hop|hop voi|chon|nen dung|nen mua|nao.*hop|goi nao|loai nao|nhu cau/.test(query);
}

const questions = {
  domain: ['Gợi ý tên miền theo thương hiệu của mình', 'So sánh .com, .vn và .com.vn cho nhu cầu này', 'Cần kiểm tra gì trước khi đăng ký tên miền?'],
  hosting: ['So sánh các gói phù hợp với website của mình', 'Chọn hosting cho lượng truy cập dự kiến', 'Tính chi phí theo chu kỳ đăng ký'],
  vps: ['So sánh cấu hình VPS cho nhu cầu này', 'Ước lượng tài nguyên cho ứng dụng của mình', 'Chọn VPS có dễ nâng cấp về sau không?'],
  email: ['Chọn gói email theo số nhân viên', 'So sánh dung lượng hộp thư phù hợp', 'Cách dùng email theo tên miền hiện có'],
  ssl: ['Chọn loại SSL cho website của mình', 'So sánh SSL cho một tên miền và nhiều tên miền', 'Cần chuẩn bị gì khi cài SSL?']
};

function selectItems(profile, type, userStatements) {
  const catalog = Array.isArray(profile?.catalog) ? profile.catalog : profile?.catalog?.items ?? [];
  const wanted = tokens(userStatements.join(' '));
  const eligible = catalog.filter(item => item.status === 'active' && item.ownerConfirmed === true && (!type || item.type === type));
  return [...eligible].sort((a, b) => {
    const score = item => wanted.filter(word => normalize(`${item.name} ${item.description} ${(item.useCases ?? []).join(' ')}`).split(' ').includes(word)).length;
    return score(b) - score(a);
  }).slice(0, type === 'domain' ? 18 : 12).map(item => structuredClone(item));
}

export function buildConsultation({ message, history = [] }, { profile = {} } = {}) {
  const statements = [...history.filter(turn => turn.role === 'user').map(turn => turn.text), message];
  const type = serviceType(message) ?? [...statements].reverse().map(serviceType).find(Boolean) ?? null;
  const purpose = [...statements].reverse().find(text => /shop|cua hang|ban |cong ty|khach hang|n8n|tu dong|blog|kinh doanh|thuong hieu/.test(normalize(text))) ?? '';
  const items = selectItems(profile, type, statements);
  return {
    intent: isRecommendation(message) ? 'recommendation' : 'facts',
    needs: { serviceType: type, purpose, userStatements: statements },
    catalog: { status: items.length ? 'ready' : 'missing', items },
    availability: { checked: false, provider: null },
    constraints: [
      'Tiếp tục tư vấn theo nhu cầu và lịch sử người dùng, kể cả khi danh mục thiếu; không dừng ở một câu báo thiếu dữ liệu.',
      'Chỉ gọi sản phẩm là Sen Hosting đang có khi nằm trong danh mục được cung cấp. Không dùng lời model trước đó làm thông tin hàng đang bán.',
      'Giá, cấu hình và chu kỳ phải giữ đúng dữ liệu từng sản phẩm; giá snapshot không phải báo giá đã xác nhận hiện tại.',
      'Tên miền đầy đủ do bạn gợi ý là ý tưởng chưa kiểm tra còn trống; việc có bán đuôi tên miền không xác nhận tên cụ thể khả dụng.',
      'Không hỏi lại thông tin khách đã nói. Đưa tiêu chí và một vài lựa chọn cụ thể kèm lý do, rồi hỏi tối đa một câu để tiến thêm bước.',
      'Đề xuất là định hướng cần kiểm chứng theo lượng truy cập, đơn hàng hay workflow thực tế; không hứa hiệu năng, khả năng nâng cấp hay hỗ trợ đi kèm nếu danh mục không ghi rõ.'
    ],
    suggestions: (questions[type] ?? ['Mình nên bắt đầu từ đâu với nhu cầu này?', 'So sánh các lựa chọn phù hợp', 'Tính ngân sách cho website của mình']).map(question => ({ question }))
  };
}
