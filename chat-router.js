import { normalize, topicOf } from './knowledge-text.js';

const company = /\bsen\s*hosting\b|ben (ban|minh|em)|cong ty (ban|minh)|dich vu cua|goi cua|tai khoan (cua )?(toi|minh)|hoa don (cua )?(toi|minh)/;
const commerce = /bao gia|bang gia|gia bao nhieu|gia sao|bao nhieu tien|chi phi|phi (dang ky|gia han)|khuyen mai|ma giam|hoan tien|thanh toan|chuyen khoan|so dien thoai|hotline|dia chi van phong|lien he|cam ket|uptime|sla|don hang|trang thai (goi|dich vu|hoa don)/;
const definition = /la gi|khac nhau|phan biet|tai sao|vi sao|nguyen ly|hoat dong nhu the nao/;
const howto = /^(cach|huong dan|lam sao de|lam the nao de|can kiem tra|can chuan bi|can luu y)\b/;

function currentRoute(message) {
  const query = normalize(message);
  if (company.test(query) || commerce.test(query)) return 'business';
  if (definition.test(query) || howto.test(query)) return 'general';
  if (/dat lich|gap nhan vien|nguoi that|hen tu van|gui ticket/.test(query)) return 'business';
  if (/(sao luu|backup).*(bao nhieu|may lan|bao lau|co khong|khong|the nao)|luu (bao lau|may ngay)|co (mien phi|ho tro)|duoc (tang|mien phi)|gia han|nang cap (goi|hosting|vps)/.test(query)) return 'business';
  if (/\b(hosting|host|vps|email|ssl|ten mien)\b/.test(query) && /\b(cpu|ram|dung luong|bang thong|cau hinh|control panel|cpanel)\b/.test(query) && !definition.test(query)) return 'business';
  if (/\b(hosting|vps|email|ssl)\b/.test(query) && /\b(co ho tro|co mien phi|ho tro|gia|bao nhieu)\b/.test(query) && !/gia re la gi/.test(query)) return 'business';
  return 'general';
}

export function classifyChat({ message, history = [] } = {}) {
  const route = currentRoute(message);
  const query = normalize(message);
  const followup = /^(con|the|vay|goi do|dich vu do|bao lau|may lan|co mien phi|gia bao nhieu)\b/.test(query);
  const lastUser = [...history].reverse().find(turn => turn.role === 'user');
  return { route: route === 'business' || (followup && lastUser && currentRoute(lastUser.text) === 'business') ? 'business' : 'general', topic: topicOf(message) };
}
