/**
 * Coarse User-Agent derivation. The raw User-Agent string is parsed in
 * memory and immediately discarded; only coarse categories are returned.
 */

export interface UaInfo {
  browserFamily: string | null;
  browserVersionMajor: number | null;
  osFamily: string | null;
  deviceClass: "desktop" | "mobile" | "tablet" | "bot" | "unknown";
  isBot: boolean;
}

const BOT_PATTERNS: RegExp[] = [
  /bot\b/i, /crawler/i, /spider/i, /slurp/i, /bingpreview/i,
  /googlebot/i, /bingbot/i, /duckduckbot/i, /baiduspider/i, /yandex/i,
  /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i, /whatsapp/i,
  /telegrambot/i, /applebot/i, /semrush/i, /ahrefsbot/i, /mj12bot/i,
  /headlesschrome/i, /pingdom/i, /uptimerobot/i, /lighthouse/i, /phantomjs/i
];

const BROWSERS: Array<[RegExp, string]> = [
  [/edg(?:e|a|ios)?\/(\d+)/i, "Edge"],
  [/opr\/(\d+)/i, "Opera"],
  [/chrome\/(\d+)/i, "Chrome"],
  [/firefox\/(\d+)/i, "Firefox"],
  [/version\/(\d+).+safari/i, "Safari"],
  [/safari\/(\d+)/i, "Safari"],
  [/msie (\d+)/i, "Internet Explorer"],
  [/trident.*rv:(\d+)/i, "Internet Explorer"]
];

const OS: Array<[RegExp, string]> = [
  [/windows nt/i, "Windows"],
  [/android/i, "Android"],
  [/iphone|ipad|ipod/i, "iOS"],
  [/mac os x/i, "macOS"],
  [/cros/i, "ChromeOS"],
  [/linux/i, "Linux"]
];

/** Parse a User-Agent into coarse categories. Never persist the input. */
export function parseUserAgent(ua: string | undefined | null): UaInfo {
  if (!ua || ua.length > 512) {
    return { browserFamily: null, browserVersionMajor: null, osFamily: null, deviceClass: "unknown", isBot: false };
  }
  const isBot = BOT_PATTERNS.some((re) => re.test(ua));

  let browserFamily: string | null = null;
  let browserVersionMajor: number | null = null;
  for (const [re, name] of BROWSERS) {
    const m = ua.match(re);
    if (m) {
      browserFamily = name;
      browserVersionMajor = m[1] ? Number(m[1]) : null;
      break;
    }
  }

  let osFamily: string | null = null;
  for (const [re, name] of OS) {
    if (re.test(ua)) {
      osFamily = name;
      break;
    }
  }

  let deviceClass: UaInfo["deviceClass"] = "unknown";
  if (isBot) deviceClass = "bot";
  else if (/ipad|tablet/i.test(ua)) deviceClass = "tablet";
  else if (/mobile|iphone|ipod|android.+mobile/i.test(ua)) deviceClass = "mobile";
  else if (osFamily) deviceClass = "desktop";

  return { browserFamily, browserVersionMajor, osFamily, deviceClass, isBot };
}
