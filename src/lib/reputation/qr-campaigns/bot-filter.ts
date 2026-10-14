const BOT_UA_PATTERNS = [
  /bot/i,
  /crawl/i,
  /spider/i,
  /slurp/i,
  /bingpreview/i,
  /facebookexternalhit/i,
  /facebot/i,
  /twitterbot/i,
  /linkedinbot/i,
  /slackbot/i,
  /discordbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /skypeuripreview/i,
  /embedly/i,
  /quora link preview/i,
  /pinterest/i,
  /vkshare/i,
  /w3c_validator/i,
  /preview/i,
  /uptimerobot/i,
  /pingdom/i,
  /statuscake/i,
  /headlesschrome/i,
  /phantomjs/i,
  /selenium/i,
  /wget/i,
  /curl\//i,
  /python-requests/i,
  /go-http-client/i,
  /java\//i,
  /libwww/i,
  /httpclient/i,
  /okhttp/i,
  /applebot/i,
  /duckduckbot/i,
  /yandex/i,
  /baiduspider/i,
  /semrush/i,
  /ahrefs/i,
  /mj12bot/i,
  /dotbot/i,
  /petalbot/i,
];

export function detectBotOrPreview(userAgent: string | null | undefined): {
  isBot: boolean;
  isPreview: boolean;
} {
  const ua = (userAgent ?? "").trim();
  if (!ua) return { isBot: true, isPreview: false };
  const isPreview = /preview|unfurl|embed|link.?expand|skypeuripreview|slackbot|discordbot|twitterbot|facebookexternalhit/i.test(
    ua
  );
  const isBot = BOT_UA_PATTERNS.some((re) => re.test(ua));
  return { isBot: isBot || isPreview, isPreview };
}

export function categorizeUserAgent(userAgent: string | null | undefined): {
  deviceCategory: string;
  browserCategory: string;
  osCategory: string;
} {
  const ua = userAgent ?? "";
  let deviceCategory = "other";
  if (/ipad|tablet|kindle|silk/i.test(ua)) deviceCategory = "tablet";
  else if (/mobi|iphone|android.+mobile|windows phone/i.test(ua)) deviceCategory = "mobile";
  else if (/windows|macintosh|linux|cros/i.test(ua)) deviceCategory = "desktop";

  let browserCategory = "other";
  if (/edg\//i.test(ua)) browserCategory = "edge";
  else if (/chrome|crios/i.test(ua) && !/edg\//i.test(ua)) browserCategory = "chrome";
  else if (/firefox|fxios/i.test(ua)) browserCategory = "firefox";
  else if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) browserCategory = "safari";

  let osCategory = "other";
  if (/windows/i.test(ua)) osCategory = "windows";
  else if (/android/i.test(ua)) osCategory = "android";
  else if (/iphone|ipad|ios/i.test(ua)) osCategory = "ios";
  else if (/mac os|macintosh/i.test(ua)) osCategory = "macos";
  else if (/linux/i.test(ua)) osCategory = "linux";

  return { deviceCategory, browserCategory, osCategory };
}
