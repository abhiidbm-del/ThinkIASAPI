function normalizeMaterialLink(value) {
  const url = new URL(String(value).trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS material link.');
  if (url.hostname === 'drive.google.com') {
    // Preserve folder links and resource keys required by some shared files.
    if (/\/folders\//.test(url.pathname)) return url.toString();
    const id = url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] || url.searchParams.get('id');
    if (id && /^[\w-]+$/.test(id)) {
      const target = new URL(`https://drive.google.com/file/d/${id}/view`);
      if (url.searchParams.has('resourcekey')) target.searchParams.set('resourcekey', url.searchParams.get('resourcekey'));
      return target.toString();
    }
  }
  return url.toString();
}
module.exports = { normalizeMaterialLink };
