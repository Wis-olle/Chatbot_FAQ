export function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

const stopwords = new Set('toi minh ban cho hoi xin vui long co duoc khong la gi va hay thi nhu the nao mot nhung cac ve voi tu den cua khi bao nhieu dang can muon nhe a o oi lam on nay do con'.split(' '));
export function tokens(value) {
  return [...new Set(normalize(value).split(' ').filter(word => word.length > 1 && !stopwords.has(word)))];
}

export function topicOf(message) {
  const query = normalize(message);
  const rules = [
    ['promotion', /khuyen mai|ma giam|giam gia|coupon|discount/], ['security', /ddos|chong tan cong/],
    ['sla', /uptime|sla|cam ket thoi gian/], ['capacity', /nguoi truy cap|luot truy cap|dong thoi/],
    ['refund', /hoan tien|refund/], ['pricing', /bang gia|gia bao nhieu|gia sao|chi phi|bao nhieu tien|muc gia|gia (hosting|host|vps|ten mien|domain|ssl)|^gia\b/],
    ['backup', /sao luu|backup|khoi phuc|luu (bao lau|trong|may ngay)/], ['migration', /chuyen (website|host|du lieu)|di chuyen|migration/],
    ['upgrade', /nang cap|upgrade/], ['renewal', /gia han|het han|renew/], ['payment', /thanh toan|chuyen khoan|hoa don/],
    ['contact', /lien he|so dien thoai|hotline|dia chi van phong/], ['ssl', /ssl|https|chung chi|tls/],
    ['programming', /lap trinh|ngon ngu|php|python|nodejs|node js|asp net|rust|blockchain/],
    ['support', /ho tro|ticket|ky thuat/], ['domain', /dns|ten mien|domain|whois/],
    ['features', /cpu|ram|dung luong|cau hinh|bang thong|control panel|cpanel/]
  ];
  return rules.find(([, pattern]) => pattern.test(query))?.[0] ?? 'general';
}

export const topicTerms = Object.freeze({
  backup: ['sao luu', 'backup', 'khoi phuc'], ssl: ['ssl', 'https', 'chung chi'],
  migration: ['chuyen website', 'chuyen du lieu', 'migration'], upgrade: ['nang cap'],
  renewal: ['gia han'], pricing: ['gia', 'chi phi'], refund: ['hoan tien'],
  payment: ['thanh toan', 'chuyen khoan'], contact: ['lien he', 'dien thoai'],
  support: ['ho tro', 'ky thuat'], domain: ['ten mien', 'dns'], features: ['cau hinh', 'thong so'],
  programming: ['lap trinh', 'ngon ngu']
});

export function sourceUrl(value) {
  if (typeof value === 'string' && /^\/knowledge\/[a-zA-Z0-9_-]{1,128}$/.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'vinahost.vn' && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}
