/**
 * Helper to safely extract human-readable error messages from arbitrary
 * error objects, Microsoft Graph responses, Microsoft Entra ID errors,
 * or network failures. Prevents '[object Object]' from ever being rendered.
 */
export function extractErrorMessage(err: unknown, fallback: string = 'An unexpected error occurred'): string {
  if (!err) return fallback;

  if (typeof err === 'string') {
    if (err === '[object Object]' || err === '{}' || !err.trim()) {
      return fallback;
    }
    return err;
  }

  if (typeof err === 'object') {
    const obj = err as Record<string, any>;

    // 1. Microsoft OAuth error_description (e.g. AADSTS50011: The redirect URI...)
    if (typeof obj.error_description === 'string' && obj.error_description.trim()) {
      return obj.error_description;
    }

    // 2. Microsoft Graph nested error: { error: { code, message } }
    if (obj.error && typeof obj.error === 'object') {
      if (typeof obj.error.message === 'string' && obj.error.message.trim()) {
        const code = typeof obj.error.code === 'string' ? `[${obj.error.code}] ` : '';
        return `${code}${obj.error.message}`;
      }
      if (typeof obj.error.code === 'string') {
        return obj.error.code;
      }
    }

    // 3. String error property: { error: "invalid_grant" }
    if (typeof obj.error === 'string' && obj.error.trim() && obj.error !== '[object Object]') {
      return obj.error;
    }

    // 4. Standard Error object .message
    if (typeof obj.message === 'string' && obj.message.trim() && obj.message !== '[object Object]') {
      return obj.message;
    }

    // 5. Nested details object
    if (obj.details && typeof obj.details === 'object') {
      const nested = extractErrorMessage(obj.details, '');
      if (nested && nested !== fallback && nested !== '[object Object]') {
        return nested;
      }
    }

    // 6. JSON serialization fallback
    try {
      const serialized = JSON.stringify(err, null, 2);
      if (serialized && serialized !== '{}' && serialized !== '[]') {
        return serialized;
      }
    } catch {
      // Ignore serialization failure
    }
  }

  return fallback;
}
