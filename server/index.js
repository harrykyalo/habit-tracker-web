// Minimal server example to receive subscriptions and send pushes (web-push)
const express = require('express');
const bodyParser = require('body-parser');
const webpush = require('web-push');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;

app.use(bodyParser.json());

const subscriptions = new Map();

// configure web-push
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.warn('Warning: VAPID keys not set. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env');
} else {
  webpush.setVapidDetails('mailto:you@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}

app.post('/subscribe', (req, res) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
  subscriptions.set(subscription.endpoint, subscription);
  res.json({ ok: true });
});

app.post('/send', async (req, res) => {
  const { endpoint, payload } = req.body; // if endpoint omitted, broadcast to all
  const message = payload || JSON.stringify({ title: 'Habit Reminder', body: 'Time to do your habit!' });
  try {
    if (endpoint) {
      const sub = subscriptions.get(endpoint);
      if (!sub) return res.status(404).json({ error: 'Subscription not found' });
      await webpush.sendNotification(sub, message);
    } else {
      const promises = [];
      for (const sub of subscriptions.values()) promises.push(webpush.sendNotification(sub, message).catch(err => { console.error('Push failed', err); }));
      await Promise.all(promises);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/vapidPublicKey', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

app.listen(port, () => console.log(`Server listening on ${port}`));
