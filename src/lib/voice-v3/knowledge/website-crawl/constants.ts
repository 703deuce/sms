export const MAX_USEFUL_PAGES = 100;

export const CRAWL_EXCLUDE_PATH_PREFIXES = [
  "/wp-admin",
  "/wp-login",
  "/login",
  "/logout",
  "/cart",
  "/checkout",
  "/account",
  "/feed",
  "/search",
  "/tag/",
  "/author/",
];

export const HIGH_PRIORITY_PATH_HINTS = [
  "",
  "/",
  "/about",
  "/services",
  "/service",
  "/pricing",
  "/rates",
  "/faq",
  "/frequently-asked-questions",
  "/locations",
  "/service-area",
  "/areas-we-serve",
  "/contact",
  "/hours",
  "/emergency",
  "/financing",
  "/warranty",
  "/policies",
];

export const LOW_PRIORITY_PATH_HINTS = ["/blog", "/news", "/press", "/tag/", "/author/"];
