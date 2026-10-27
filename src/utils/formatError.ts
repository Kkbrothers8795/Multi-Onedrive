/**
 * Utility to safely extract human-friendly error messages from arbitrary
 * error objects, Microsoft Graph API responses, Microsoft Entra ID errors,
 * or network failures. Prevents '[object Object]' from ever being rendered.
 */

export interface DetailedError {
  userFriendlyMessage: string;
  code?: string;
  technicalDetails?: string;
}

const COMMON_GRAPH_ERRORS: Record<string, string> = {
  InvalidAuthenticationToken: 'Authentication token has expired or is invalid. Please reconnect your account.',
  unauthenticated: 'Your Microsoft session has timed out. Please sign in again.',
  accessDenied: 'Access denied: You do not have permission to access or modify this resource.',
  itemNotFound: 'The requested file or folder was not found on Microsoft OneDrive.',
  nameAlreadyExists: 'An item with this name already exists in this folder.',
  quotaLimitReached: 'OneDrive storage quota limit reached. Free up space or upgrade storage.',
  resourceModified: 'The resource has been modified by another user. Refreshing file list.',
  serviceNotAvailable: 'Microsoft Graph API is temporarily busy or undergoing maintenance.',
  activityLimitReached: 'Microsoft Graph rate limit reached. MultiDrive will retry shortly.',
  notAllowed: 'This operation is not permitted by your Microsoft 365 organization policies.',
  malwareDetected: 'Microsoft 365 detected a potential security threat in this file and blocked the action.',
};

const COMMON_AAD_ERRORS: Record<string, string> = {
  AADSTS50011: 'Redirect URI mismatch: Your current domain must be added to Azure App Registration.',
  AADSTS7000215: 'Invalid client secret: Verify the secret value in Certificates & secrets.',
  AADSTS700016: 'Application not found: Verify the Azure Client ID (Application ID).',
  AADSTS7000218: 'Client secret required: This application is configured as a confidential client.',
  AADSTS65001: 'Consent required: An administrator must consent to the requested Microsoft Graph permissions.',
  AADSTS50076: 'Multi-Factor Authentication (MFA) required by your tenant administrator.',
};

export function parseDetailedError(err: unknown, fallback: string = 'An unexpected error occurred'): DetailedError {
  if (!err) {
    return { userFriendlyMessage: fallback };
  }

  // If already a plain string
  if (typeof err === 'string') {
    if (err === '[object Object]' || err === '{}' || !err.trim()) {
      return { userFriendlyMessage: fallback };
    }

    // Check for AAD error codes inside string
    for (const [code, desc] of Object.entries(COMMON_AAD_ERRORS)) {
      if (err.includes(code)) {
        return { userFriendlyMessage: desc, code, technicalDetails: err };
      }
    }
    // Check for Graph error codes
    for (const [code, desc] of Object.entries(COMMON_GRAPH_ERRORS)) {
      if (err.includes(code)) {
        return { userFriendlyMessage: desc, code, technicalDetails: err };
      }
    }

    return { userFriendlyMessage: err, technicalDetails: err };
  }

  if (typeof err === 'object') {
    const obj = err as Record<string, any>;
    let code: string | undefined = undefined;
    let rawMessage: string = '';
    let details: string | undefined = undefined;

    // 1. Microsoft OAuth error_description (e.g. AADSTS50011...)
    if (typeof obj.error_description === 'string' && obj.error_description.trim()) {
      rawMessage = obj.error_description;
    }
    // 2. Microsoft Graph structured error: { error: { code, message, innerError } }
    else if (obj.error && typeof obj.error === 'object') {
      code = typeof obj.error.code === 'string' ? obj.error.code : undefined;
      rawMessage = typeof obj.error.message === 'string' ? obj.error.message : '';
      if (obj.error.innerError) {
        try {
          details = JSON.stringify(obj.error.innerError, null, 2);
        } catch {}
      }
    }
    // 3. String error property
    else if (typeof obj.error === 'string' && obj.error.trim() && obj.error !== '[object Object]') {
      rawMessage = obj.error;
    }
    // 4. Standard Error object .message
    else if (typeof obj.message === 'string' && obj.message.trim() && obj.message !== '[object Object]') {
      rawMessage = obj.message;
    }

    // Check if code was in details
    if (!code && obj.code && typeof obj.code === 'string') {
      code = obj.code;
    }

    // Map recognized error code to user-friendly message
    if (code && COMMON_GRAPH_ERRORS[code]) {
      return {
        userFriendlyMessage: COMMON_GRAPH_ERRORS[code],
        code,
        technicalDetails: rawMessage || details || JSON.stringify(err),
      };
    }

    // Check for AADSTS errors
    for (const [aadCode, desc] of Object.entries(COMMON_AAD_ERRORS)) {
      if (rawMessage.includes(aadCode)) {
        return {
          userFriendlyMessage: desc,
          code: aadCode,
          technicalDetails: rawMessage,
        };
      }
    }

    if (rawMessage && rawMessage !== '[object Object]') {
      return {
        userFriendlyMessage: rawMessage,
        code,
        technicalDetails: details,
      };
    }

    // 5. Nested details object
    if (obj.details) {
      return parseDetailedError(obj.details, fallback);
    }

    // 6. JSON serialization fallback
    try {
      const serialized = JSON.stringify(err, null, 2);
      if (serialized && serialized !== '{}' && serialized !== '[]') {
        return { userFriendlyMessage: fallback, technicalDetails: serialized };
      }
    } catch {}
  }

  return { userFriendlyMessage: fallback };
}

export function extractErrorMessage(err: unknown, fallback: string = 'An unexpected error occurred'): string {
  const parsed = parseDetailedError(err, fallback);
  return parsed.userFriendlyMessage;
}
