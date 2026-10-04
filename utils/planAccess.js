// Purchasing another plan must not remove content already purchased.
const mergePlanAccess = (current, purchased) => current === 'combo' || purchased === 'combo'
  || (current === 'pre' && purchased === 'mains') || (current === 'mains' && purchased === 'pre') ? 'combo' : purchased;
module.exports = { mergePlanAccess };
