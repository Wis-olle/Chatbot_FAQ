import { createApiHandler } from '../api-handler.js';
import { createServerlessKnowledge } from '../knowledge.js';

export default createApiHandler({ knowledge: createServerlessKnowledge(), env: process.env });
export const config = {
  path: ['/api/status', '/api/knowledge', '/knowledge/*'],
  rateLimit: { windowLimit: 240, windowSize: 60, aggregateBy: ['ip', 'domain'] }
};
