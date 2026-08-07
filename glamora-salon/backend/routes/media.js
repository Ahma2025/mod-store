const express = require('express');
const multer = require('multer');
const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { DB, query } = require('../database');
const { authenticate } = require('./auth');

const router = express.Router();

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = 'velour-media';
const PUBLIC_URL = process.env.CF_R2_PUBLIC_URL || 'https://pub-9dcfc5eb20b34a25850836bb6afff0b4.r2.dev';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm', 'audio/webm', 'audio/ogg', 'audio/mp4'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  }
});

// Wrapper that converts Multer errors to JSON (prevents HTML 500 responses)
function handleUpload(field) {
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Upload error' });
      next();
    });
  };
}

async function uploadToR2(buffer, filename, mimetype) {
  await R2.send(new PutObjectCommand({ Bucket: BUCKET, Key: filename, Body: buffer, ContentType: mimetype }));
  return `${PUBLIC_URL}/${filename}`;
}

async function deleteFromR2(filename) {
  try { await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: filename })); }
  catch (e) { console.error('R2 delete error:', e.message); }
}

// ---- Salon gallery photos/video ----
router.post('/salon/:id/media', authenticate, handleUpload('file'), async (req, res) => {
  try {
    const salonId = parseInt(req.params.id);
    const stylist = await DB.stylists.findOne(st => st.user_id == req.user.id && st.salon_id == salonId);
    if (!stylist) return res.status(403).json({ error: 'غير مصرح' });
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });

    const isVideo = req.file.mimetype.startsWith('video/');
    const existing = await DB.salon_media.find(m => m.salon_id === salonId);
    const photos = existing.filter(m => m.type === 'photo');
    const videos = existing.filter(m => m.type === 'video');

    if (isVideo && videos.length >= 1) return res.status(400).json({ error: 'يمكن رفع فيديو واحد فقط' });
    if (!isVideo && photos.length >= 4) return res.status(400).json({ error: 'يمكن رفع 4 صور فقط' });

    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `salon_${salonId}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;

    let url;
    if (process.env.CF_ACCOUNT_ID && process.env.CF_R2_ACCESS_KEY_ID) {
      url = await uploadToR2(req.file.buffer, filename, req.file.mimetype);
    } else {
      url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const isCover = !isVideo && photos.length === 0;
    const media = await DB.salon_media.insert({
      salon_id: salonId,
      filename,
      url,
      type: isVideo ? 'video' : 'photo',
      is_cover: isCover ? 1 : 0
    });
    res.status(201).json({ media });
  } catch (e) {
    console.error('Salon media upload error:', e.message, e.stack);
    res.status(500).json({ error: `فشل رفع الملف: ${e.message}` });
  }
});

// ---- Set cover photo ----
router.put('/media/:id/cover', authenticate, async (req, res) => {
  try {
    const mediaId = parseInt(req.params.id);
    const media = await DB.salon_media.findOne(m => m.id === mediaId);
    if (!media) return res.status(404).json({ error: 'الصورة غير موجودة' });
    if (media.type === 'video') return res.status(400).json({ error: 'الفيديو لا يمكن تعيينه كغلاف' });

    const stylist = await DB.stylists.findOne(st => st.user_id == req.user.id && st.salon_id == media.salon_id);
    if (!stylist) return res.status(403).json({ error: 'غير مصرح' });

    await query('UPDATE salon_media SET is_cover=0 WHERE salon_id=$1', [media.salon_id]);
    await query('UPDATE salon_media SET is_cover=1 WHERE id=$1', [mediaId]);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

// ---- Delete media ----
router.delete('/media/:id', authenticate, async (req, res) => {
  try {
    const mediaId = parseInt(req.params.id);
    const media = await DB.salon_media.findOne(m => m.id === mediaId);
    if (!media) return res.status(404).json({ error: 'الملف غير موجود' });

    const stylist = await DB.stylists.findOne(st => st.user_id == req.user.id && st.salon_id == media.salon_id);
    if (!stylist) return res.status(403).json({ error: 'غير مصرح' });

    await deleteFromR2(media.filename);
    await DB.salon_media.remove(m => m.id === mediaId);

    const remaining = await DB.salon_media.find(m => m.salon_id === media.salon_id && m.type === 'photo');
    if (media.is_cover && remaining.length > 0) {
      await query('UPDATE salon_media SET is_cover=1 WHERE id=$1', [remaining[0].id]);
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

// ---- Stylist avatar (by ID, for salon owner uploading team photos) ----
router.post('/stylist/:stylistId/avatar', authenticate, handleUpload('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });

    const stylistId = parseInt(req.params.stylistId);
    const stylist = await DB.stylists.findOne(s => s.id === stylistId);
    if (!stylist) return res.status(404).json({ error: 'كوفيرة غير موجودة' });

    const isOwn = stylist.user_id == req.user.id;
    const isSameSalon = await DB.stylists.findOne(s => s.user_id == req.user.id && s.salon_id == stylist.salon_id);
    if (!isOwn && !isSameSalon) return res.status(403).json({ error: 'غير مصرح' });

    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `stylist_avatar_${stylist.user_id || stylistId}_${Date.now()}${ext}`;

    let url;
    if (process.env.CF_ACCOUNT_ID && process.env.CF_R2_ACCESS_KEY_ID) {
      url = await uploadToR2(req.file.buffer, filename, req.file.mimetype);
    } else {
      url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    await query('UPDATE stylists SET avatar=$1 WHERE id=$2', [url, stylistId]);
    if (stylist.user_id) {
      await query('UPDATE users SET avatar=$1 WHERE id=$2', [url, stylist.user_id]);
    }
    res.json({ avatar: url });
  } catch (e) {
    console.error('Stylist avatar upload error:', e.message, e.stack);
    res.status(500).json({ error: `فشل رفع الصورة: ${e.message}` });
  }
});

// ---- Stylist avatar (self) ----
router.post('/stylist/avatar', authenticate, handleUpload('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });

    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `stylist_avatar_${req.user.id}_${Date.now()}${ext}`;

    let url;
    if (process.env.CF_ACCOUNT_ID && process.env.CF_R2_ACCESS_KEY_ID) {
      url = await uploadToR2(req.file.buffer, filename, req.file.mimetype);
    } else {
      url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    await query('UPDATE users SET avatar=$1 WHERE id=$2', [url, req.user.id]);
    await query('UPDATE stylists SET avatar=$1 WHERE user_id=$2', [url, req.user.id]);
    res.json({ avatar: url });
  } catch (e) {
    console.error('Avatar upload error:', e.message);
    res.status(500).json({ error: `فشل رفع الصورة: ${e.message}` });
  }
});

// ---- Salon profile avatar (cover_url) ----
router.post('/salon/:salonId/avatar', authenticate, handleUpload('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const salonId = parseInt(req.params.salonId);

    const stylist = await DB.stylists.findOne(st => st.user_id == req.user.id && st.salon_id == salonId);
    if (!stylist) return res.status(403).json({ error: 'Not authorized' });

    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `salon_avatar_${salonId}_${Date.now()}${ext}`;

    let url;
    if (process.env.CF_ACCOUNT_ID && process.env.CF_R2_ACCESS_KEY_ID) {
      url = await uploadToR2(req.file.buffer, filename, req.file.mimetype);
    } else {
      url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    await query('UPDATE salons SET cover_url=$1 WHERE id=$2', [url, salonId]);
    res.json({ avatar: url });
  } catch (e) {
    console.error('Salon avatar upload error:', e.message);
    res.status(500).json({ error: `Upload failed: ${e.message}` });
  }
});

// ---- Review photo ----
router.post('/review/photo', authenticate, handleUpload('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });
    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `review_${req.user.id}_${Date.now()}${ext}`;
    let url;
    if (process.env.CF_ACCOUNT_ID && process.env.CF_R2_ACCESS_KEY_ID) {
      url = await uploadToR2(req.file.buffer, filename, req.file.mimetype);
    } else {
      url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: `فشل رفع الصورة: ${e.message}` });
  }
});

// ---- Chat image / voice ----
router.post('/chat/upload', authenticate, handleUpload('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'لم يتم رفع ملف' });
    const isAudio = req.file.mimetype.startsWith('audio/');
    const isImage = req.file.mimetype.startsWith('image/');
    if (!isAudio && !isImage) return res.status(400).json({ error: 'نوع ملف غير مدعوم' });
    const ext = isAudio ? '.webm' : (req.file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[0] || '.jpg');
    const filename = `chat_${req.user.id}_${Date.now()}${ext}`;
    let url;
    if (process.env.CF_ACCOUNT_ID && process.env.CF_R2_ACCESS_KEY_ID) {
      url = await uploadToR2(req.file.buffer, filename, req.file.mimetype);
    } else {
      url = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }
    res.json({ url, msg_type: isAudio ? 'voice' : 'image' });
  } catch (e) {
    res.status(500).json({ error: `فشل رفع الملف: ${e.message}` });
  }
});

// ---- Get salon gallery ----
router.get('/salon/:id/media', async (req, res) => {
  try {
    const salonId = parseInt(req.params.id);
    const media = (await DB.salon_media.find(m => m.salon_id === salonId)).sort((a, b) => b.is_cover - a.is_cover);
    res.json(media);
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

module.exports = router;
