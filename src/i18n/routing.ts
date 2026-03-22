import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const locales = ['en', 'vi', 'zh-CN', 'zh-TW', 'es', 'fr', 'de', 'ja', 'ko'];

export const routing = defineRouting({
  locales: locales,
  defaultLocale: 'en'
});

export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
