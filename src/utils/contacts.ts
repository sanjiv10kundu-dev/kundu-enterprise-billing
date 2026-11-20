/**
 * Web Contact Picker API helper for Android Chrome and supported mobile browsers.
 * Safely falls back on unsupported browsers or when the user cancels selection.
 */

interface ContactInfo {
  name?: string[];
  tel?: string[];
}

interface ContactsManager {
  select: (
    properties: Array<'name' | 'tel' | 'email' | 'address' | 'icon'>,
    options?: { multiple?: boolean }
  ) => Promise<ContactInfo[]>;
}

declare global {
  interface Navigator {
    contacts?: ContactsManager;
  }
}

export type ContactPickResult =
  | { status: 'selected'; name: string; phone: string }
  | { status: 'cancelled' }
  | { status: 'unsupported' };

export function cleanContactPhone(rawPhone: string): string {
  let digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith('0091') && digits.length >= 14) {
    digits = digits.slice(4);
  } else if (digits.startsWith('91') && digits.length >= 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

export function isContactPickerSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    typeof navigator.contacts?.select === 'function'
  );
}

export async function pickPhoneContact(): Promise<ContactPickResult> {
  if (!isContactPickerSupported()) {
    return { status: 'unsupported' };
  }

  try {
    const selected = await navigator.contacts!.select(['name', 'tel'], {
      multiple: false,
    });

    if (!Array.isArray(selected) || selected.length === 0) {
      return { status: 'cancelled' };
    }

    const contact = selected[0];
    const pickedName = (contact.name?.find((n) => n && n.trim().length > 0) ?? '').trim();

    const rawTels = Array.isArray(contact.tel) ? contact.tel.filter(Boolean) : [];
    const cleanedPhones = rawTels.map((t) => cleanContactPhone(t)).filter(Boolean);
    const bestPhone =
      cleanedPhones.find((p) => p.length === 10) ?? cleanedPhones[0] ?? '';

    if (!pickedName && !bestPhone) {
      return { status: 'cancelled' };
    }

    return {
      status: 'selected',
      name: pickedName,
      phone: bestPhone,
    };
  } catch {
    // Handles user cancellation, AbortError, or SecurityError in embedded frames gracefully
    return { status: 'cancelled' };
  }
}
