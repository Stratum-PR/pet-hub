export function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  let digits = value.replace(/\D/g, '');
  // US numbers stored as 11 digits with leading 1
  if (digits.length === 11 && digits[0] === '1') {
    digits = digits.slice(1);
  }

  // Limit to 10 digits
  const limitedDigits = digits.slice(0, 10);
  
  // Format based on length
  if (limitedDigits.length === 0) {
    return '';
  } else if (limitedDigits.length <= 3) {
    return `(${limitedDigits}`;
  } else if (limitedDigits.length <= 6) {
    return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
  } else {
    return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
  }
}

export function unformatPhoneNumber(value: string): string {
  return value.replace(/\D/g, '');
}

/** Table / read-only display: (XXX) XXX-XXXX when digits exist, otherwise em dash. */
export function formatPhoneNumberDisplay(value: string | null | undefined): string {
  if (value == null || String(value).trim() === '') return '—';
  const formatted = formatPhoneNumber(String(value));
  return formatted || '—';
}
