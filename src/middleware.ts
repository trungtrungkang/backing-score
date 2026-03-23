import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';
 
export default createMiddleware(routing);
 
export const config = {
  // Match all pathnames except static files and API routes
  matcher: ['/', '/(vi|en|zh-CN|zh-TW|es|fr|de|ja|ko)/:path*', '/((?!_next|api|favicon|icon|apple-icon|.*\\..*).*)']
};
