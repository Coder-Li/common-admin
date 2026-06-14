export interface UserSessionDeviceSummary {
  browser: string;
  os: string;
  deviceType: string;
}

export function summarizeUserAgent(
  userAgent?: string | null,
): UserSessionDeviceSummary {
  if (!userAgent) {
    return unknownDeviceSummary();
  }

  return {
    browser: detectBrowser(userAgent),
    os: detectOs(userAgent),
    deviceType: detectDeviceType(userAgent),
  };
}

function unknownDeviceSummary(): UserSessionDeviceSummary {
  return {
    browser: 'Unknown browser',
    os: 'Unknown OS',
    deviceType: 'Unknown device',
  };
}

function detectBrowser(userAgent: string): string {
  if (/Edg\//i.test(userAgent)) {
    return 'Edge';
  }

  if (/Firefox\//i.test(userAgent)) {
    return 'Firefox';
  }

  if (/Chrome\//i.test(userAgent) && !/Chromium\//i.test(userAgent)) {
    return 'Chrome';
  }

  if (/Safari\//i.test(userAgent) && /Version\//i.test(userAgent)) {
    return 'Safari';
  }

  return 'Unknown browser';
}

function detectOs(userAgent: string): string {
  if (/iPad|iPhone|iPod/i.test(userAgent)) {
    return 'iOS';
  }

  if (/Android/i.test(userAgent)) {
    return 'Android';
  }

  if (/Mac OS X|Macintosh/i.test(userAgent)) {
    return 'macOS';
  }

  if (/Windows/i.test(userAgent)) {
    return 'Windows';
  }

  if (/Linux/i.test(userAgent)) {
    return 'Linux';
  }

  return 'Unknown OS';
}

function detectDeviceType(userAgent: string): string {
  if (/iPad|Tablet/i.test(userAgent)) {
    return 'Tablet';
  }

  if (/Mobile|iPhone|Android/i.test(userAgent)) {
    return 'Mobile';
  }

  if (/Macintosh|Windows|Linux/i.test(userAgent)) {
    return 'Desktop';
  }

  return 'Unknown device';
}
