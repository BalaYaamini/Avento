// Sreenidhi University email restriction helpers.
// Allowed: @suh.edu.in and any subdomain (@cse.suh.edu.in, @aiml.suh.edu.in, @ds.suh.edu.in, @sap.suh.edu.in, ...)
export const isSuhEmail = (email) => {
  const e = String(email || '').toLowerCase().trim();
  const at = e.lastIndexOf('@');
  if (at === -1 || at === e.length - 1) return false;
  const domain = e.slice(at + 1);
  return domain === 'suh.edu.in' || domain.endsWith('.suh.edu.in');
};

export const SUH_ONLY_MESSAGE = 'Only Sreenidhi University students (@suh.edu.in) can register for this event.';
