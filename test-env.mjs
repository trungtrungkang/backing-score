import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';
setupDevPlatform().then(platform => {
  console.log("PLATFORM IS:", Object.keys(platform.env)); 
}).catch(console.error);
