const audienceTypes = audience => audience === 'pre' ? ['pre', 'combo'] : audience === 'mains' ? ['mains', 'combo'] : [audience];
const visibleAudiences = type => type === 'combo' ? ['all', 'pre', 'mains', 'combo'] : ['all', type];
module.exports = { audienceTypes, visibleAudiences };
