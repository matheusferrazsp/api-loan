import webPush from 'web-push';
import dotenv from 'dotenv';

dotenv.config();

const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (!publicVapidKey || !privateVapidKey) {
  console.warn('⚠️  VAPID keys not found in .env. Web Push Notifications will not work.');
} else {
  // Using a dummy mailto since this is required by VAPID protocol
  webPush.setVapidDetails('mailto:suporte@veroflux.com.br', publicVapidKey, privateVapidKey);
}

export { webPush };
