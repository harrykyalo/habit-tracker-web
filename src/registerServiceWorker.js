// registerServiceWorker.js
// helpers for service worker registration and push subscription

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerSW() {
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('SW registered', reg);
  } catch (e) {
    console.warn('SW registration failed', e);
  }
}

export async function getRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  return await navigator.serviceWorker.ready;
}

export async function getSubscription() {
  const reg = await getRegistration();
  if (!reg) return null;
  return await reg.pushManager.getSubscription();
}

export async function subscribeToPush(publicKeyBase64) {
  const reg = await getRegistration();
  if (!reg) throw new Error('Service Worker registration not ready');
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKeyBase64),
  });
  return sub;
}

export async function unsubscribeFromPush() {
  const sub = await getSubscription();
  if (sub) await sub.unsubscribe();
}
