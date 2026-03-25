import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

function deepMerge(target: any, source: any) {
  const result = { ...target };
  for (const key of Object.keys(source || {})) {
    if (source[key] instanceof Object && !Array.isArray(source[key]) && target[key]) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  const defaultMessages = (await import(`../../messages/en.json`)).default;
  const localeMessages = locale === "en"
    ? defaultMessages
    : (await import(`../../messages/${locale}.json`)).default;

  const messages = deepMerge(defaultMessages, localeMessages) as typeof defaultMessages;

  return {
    locale,
    messages
  };
});
