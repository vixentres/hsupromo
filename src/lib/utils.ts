export function formatRut(rut: string): string {
  if (!rut) return '';
  let value = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (value.length < 2) return value;
  const dv = value.slice(-1);
  let body = value.slice(0, -1);
  let formattedBody = '';
  while (body.length > 3) {
    formattedBody = '.' + body.slice(-3) + formattedBody;
    body = body.slice(0, -3);
  }
  formattedBody = body + formattedBody;
  return `${formattedBody}-${dv}`;
}

export function formatPhone(phone: string): string {
  if (!phone) return '';
  let value = phone.replace(/[^0-9+]/g, '');
  if (!value.startsWith('+')) {
    if (value.startsWith('569')) value = '+' + value;
    else if (value.startsWith('9') && value.length === 9) value = '+56' + value;
    else value = '+569' + value;
  }
  return value;
}

export function formatIg(ig: string): string {
  if (!ig) return '';
  return ig.replace(/@/g, '').trim();
}
