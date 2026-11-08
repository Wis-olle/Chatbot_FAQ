import { createHash } from 'node:crypto';

export function catalogEntries(items = []) {
  return items.filter(item => item.status === 'active' && item.ownerConfirmed === true).map(item => {
    const question = `Thông tin và giá ${item.name} tại Sen Hosting`;
    const answer = [item.description, ...Object.entries(item.specs ?? {}).map(([key, value]) => `${key}: ${value}`),
      item.price?.display ? `Giá danh mục: ${item.price.display}; ${item.price.billingPeriod ?? ''}.` : '',
      item.price?.renewalDisplay ? `Gia hạn: ${item.price.renewalDisplay}.` : '', item.price?.conditions,
      item.type === 'domain' ? 'Danh mục đuôi tên miền không xác nhận tên miền đầy đủ còn trống.' : ''].filter(Boolean).join('\n');
    return { id: item.id, kind: 'catalog', question, answer, heading: question, title: `Sen Hosting · ${item.name}`,
      service: item.service, serviceLabel: item.serviceLabel ?? item.name, category: item.type, topic: 'pricing',
      aliases: [item.name, `${item.name} giá bao nhiêu`], sourceUrl: item.sourceUrl,
      fetchedAt: item.snapshotAt, updatedAt: item.snapshotAt, companySpecific: true, ownerConfirmed: true,
      reviewStatus: 'sen_approved', reviewMethod: 'owner-requested-crawl-import', requiresConfirmation: false,
      contentHash: createHash('sha256').update(question + '\n' + answer).digest('hex'), catalogItem: item };
  });
}
