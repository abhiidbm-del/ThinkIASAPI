const audienceTypes = audience => {
  if (audience === 'all') return ['pre', 'mains', 'combo'];
  if (audience === 'pre') return ['pre', 'combo'];
  if (audience === 'mains') return ['mains', 'combo'];
  return [audience || 'fresh'];
};

const visibleAudiences = type => {
  if (type === 'combo') return ['all', 'pre', 'mains', 'combo'];
  if (type === 'pre') return ['all', 'pre'];
  if (type === 'mains') return ['all', 'mains'];
  return ['fresh'];
};

module.exports = { audienceTypes, visibleAudiences };
