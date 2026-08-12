'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// ── Firebase Admin init ──────────────────────────────────────────────────────

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // dotenv stores \n as literal \\n — this fixes it
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

// ── Express setup ────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// ── Auth middleware ──────────────────────────────────────────────────────────

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    req.decodedToken = await admin.auth().verifyIdToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function requireAdmin(req, res, next) {
  const uid = req.decodedToken.uid;
  const userDoc = await db.collection('users').doc(uid).get();

  if (!userDoc.exists) {
    return res.status(403).json({ error: 'User not found' });
  }

  const data = userDoc.data();
  if (data.role !== 'admin' || data.disabled) {
    return res.status(403).json({ error: 'Forbidden: admin only' });
  }

  req.adminUser = data;
  next();
}

// ── POST /api/users ──────────────────────────────────────────────────────────

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['admin', 'editor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const userRecord = await admin.auth().createUser({ email, password });

    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      name,
      role,
      disabled: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ uid: userRecord.uid, email });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    console.error('Create user error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
