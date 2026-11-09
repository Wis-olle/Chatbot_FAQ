import prepared from '../sen-hosting/prepared/knowledge.json' with { type: 'json' };
import profile from '../sen-hosting/content/business-profile.json' with { type: 'json' };
import importedCatalog from '../sen-hosting/content/catalog.json' with { type: 'json' };
import { createKnowledge } from '../knowledge.js';
import { catalogEntries } from '../catalog-knowledge.js';

export function createServerlessKnowledge() {
  const entries = [...prepared.entries, ...catalogEntries(importedCatalog.items)]
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return createKnowledge({ entries, brandName: 'Sen Hosting',
    stats: { ...prepared.stats, catalogItems: importedCatalog.items.length },
    businessProfile: { ...profile, catalog: importedCatalog.items } });
}
