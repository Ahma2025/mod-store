const express = require('express');
const { DB, query } = require('../database');
const { authenticate } = require('./auth');

const router = express.Router();

// GET /api/beauty/profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await DB.users.findOne(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'مستخدم غير موجود' });
    const formulas = await DB.color_formulas.find(f => f.client_id === req.user.id);
    res.json({
      hair_color: user.hair_color,
      hair_texture: user.hair_texture,
      skin_tone: user.skin_tone,
      face_shape: user.face_shape,
      allergies: user.allergies,
      color_notes: user.color_notes,
      last_color_date: user.last_color_date,
      next_reminder_date: user.next_reminder_date,
      preferences: (() => { try { return JSON.parse(user.preferences_json || '{}'); } catch { return {}; } })(),
      color_formulas: formulas.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

// PUT /api/beauty/profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { hair_color, hair_texture, skin_tone, face_shape, allergies, color_notes, last_color_date, next_reminder_date, preferences } = req.body;
    const prefs = preferences ? JSON.stringify(preferences) : undefined;
    const fields = { hair_color, hair_texture, skin_tone, face_shape, allergies, color_notes, last_color_date, next_reminder_date };
    if (prefs !== undefined) fields.preferences_json = prefs;

    const sets = Object.entries(fields).filter(([, v]) => v !== undefined).map(([k], i) => `${k}=$${i + 2}`);
    const vals = Object.entries(fields).filter(([, v]) => v !== undefined).map(([, v]) => v);
    if (!sets.length) return res.json({ ok: true });

    await query(`UPDATE users SET ${sets.join(',')} WHERE id=$1`, [req.user.id, ...vals]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'خطأ في الحفظ' });
  }
});

// GET /api/beauty/recommendations  — salons based on booking history
router.get('/recommendations', authenticate, async (req, res) => {
  try {
    const bookings = await DB.bookings.find(b => b.client_id === req.user.id && b.status === 'completed');
    const visitedSalonIds = [...new Set(bookings.map(b => b.salon_id))];

    // Count service categories booked
    const catCount = {};
    for (const b of bookings) {
      if (b.service_id) {
        const svc = await DB.services.findOne(s => s.id === b.service_id);
        if (svc?.category) catCount[svc.category] = (catCount[svc.category] || 0) + 1;
      }
    }
    const topCats = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c);

    const allSalons = await DB.salons.find(s => s.is_active !== 0 && !visitedSalonIds.includes(s.id));
    // Score each salon by matching categories
    const scored = allSalons.map(s => {
      const cats = (() => { try { return JSON.parse(s.categories || '[]'); } catch { return []; } })();
      const score = topCats.reduce((n, c) => n + (cats.includes(c) ? 1 : 0), 0);
      return { ...s, score };
    }).filter(s => s.score > 0 || topCats.length === 0).sort((a, b) => b.score - a.score || b.rating - a.rating).slice(0, 6);

    res.json({ top_categories: topCats, salons: scored });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

// GET /api/beauty/you-might-like  — services similar to past bookings
router.get('/you-might-like', authenticate, async (req, res) => {
  try {
    const bookings = await DB.bookings.find(b => b.client_id === req.user.id);
    const bookedServiceIds = new Set(bookings.map(b => b.service_id));
    const bookedCats = new Set();
    for (const id of bookedServiceIds) {
      const svc = await DB.services.findOne(s => s.id === id);
      if (svc?.category) bookedCats.add(svc.category);
    }
    if (!bookedCats.size) {
      // No history — return top-rated services
      const svcs = await DB.services.find(s => s.is_active !== 0);
      return res.json(svcs.sort((a, b) => b.price - a.price).slice(0, 8));
    }
    const similar = await DB.services.find(s => s.is_active !== 0 && bookedCats.has(s.category) && !bookedServiceIds.has(s.id));
    res.json(similar.slice(0, 8));
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

// POST /api/beauty/ai-hairstyle  — AI analysis via Claude vision
router.post('/ai-hairstyle', authenticate, async (req, res) => {
  try {
    const { image_base64, face_shape } = req.body;

    if (!process.env.ANTHROPIC_API_KEY) {
      // Fallback: rule-based suggestions by face shape
      return res.json(getFallbackSuggestions(face_shape || 'oval'));
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `أنتِ خبيرة تصفيف شعر محترفة. انظري إلى صورة هذه الزبونة وحددي:
1. شكل الوجه (بيضاوي/مستدير/مربع/قلب/مستطيل/ماسي)
2. اقترحي 3 تسريحات شعر مناسبة لشكل وجهها بالعربية
3. اقترحي 2 لون شعر يناسبها

أجيبي بـ JSON فقط بهذا الشكل:
{"face_shape":"...","hairstyles":[{"name":"...","description":"...","why":"..."},...],"colors":[{"name":"...","arabic_name":"...","why":"..."},...]}`;

    const messages = [];
    if (image_base64) {
      const mediaType = image_base64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      const b64data = image_base64.replace(/^data:image\/\w+;base64,/, '');
      messages.push({
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64data } },
          { type: 'text', text: prompt }
        ]
      });
    } else {
      messages.push({ role: 'user', content: `${prompt}\n\nشكل الوجه المُدخل: ${face_shape || 'بيضاوي'}` });
    }

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 3000, // Opus 5 يشغّل التفكير تلقائياً ويشارك ميزانية max_tokens — نرفعها لضمان اكتمال الرد
      messages,
    });

    // Opus 5 يعيد بلوك تفكير قبل النص، فنبحث عن بلوك النص بدل أخذ أول عنصر
    const text = (response.content.find(b => b.type === 'text') || {}).text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.json(getFallbackSuggestions(face_shape || 'oval'));
    res.json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error('AI hairstyle error:', e.message);
    res.json(getFallbackSuggestions('oval'));
  }
});

function getFallbackSuggestions(shape) {
  const map = {
    oval: { face_shape: 'بيضاوي', hairstyles: [
      { name: 'لوب كلاسيكي', description: 'شعر متوسط يصل إلى الكتفين', why: 'الوجه البيضاوي يناسبه أي تسريحة' },
      { name: 'بوب قصير', description: 'تسريحة بوب بخصلات متدرجة', why: 'يبرز ملامح الوجه المتناسقة' },
      { name: 'تلاحم طويل', description: 'شعر طويل مع خصلات أمامية', why: 'يُعطي إطالة جميلة للوجه' },
    ]},
    round: { face_shape: 'مستدير', hairstyles: [
      { name: 'لايرز متدرجة', description: 'طبقات متدرجة تبدأ من الذقن', why: 'يضيف طولاً ويقلل عرض الوجه' },
      { name: 'فرق جانبي', description: 'شعر بفرق على الجانب', why: 'يكسر تناسق الدائرة ويطيل الوجه' },
      { name: 'كيرلي ميديم', description: 'تجعيد خفيف متوسط الطول', why: 'يُخفف استدارة الوجه' },
    ]},
    square: { face_shape: 'مربع', hairstyles: [
      { name: 'أمواج ناعمة', description: 'موجات ناعمة وخصلات جانبية', why: 'يُلطّف حدة الوجه' },
      { name: 'شعر طويل', description: 'شعر مستقيم طويل مع لايرز', why: 'يُطيل الوجه ويُخفف زوايا الفك' },
      { name: 'بيكسي ناعم', description: 'قصة بيكسي بخصلات أمامية', why: 'يُبرز عيونك ويُخفف ثقل الفك' },
    ]},
    heart: { face_shape: 'قلب', hairstyles: [
      { name: 'بوب متوسط', description: 'بوب يصل للكتف', why: 'يُوازن اتساع الجبهة مع ضيق الذقن' },
      { name: 'لايرز جانبية', description: 'خصلات جانبية تملأ منطقة الفك', why: 'يُضيف حجماً أسفل الوجه' },
      { name: 'باني منخفض', description: 'باني فضفاض على الخد', why: 'يُوزن ملامح الوجه بشكل جميل' },
    ]},
  };
  return map[shape] || map.oval;
}

// POST /api/beauty/schedule-reminder  — set reminder for color
router.post('/schedule-reminder', authenticate, async (req, res) => {
  try {
    const { weeks = 6 } = req.body;
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + weeks * 7);
    const dateStr = reminderDate.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    await query(`UPDATE users SET last_color_date=$1, next_reminder_date=$2 WHERE id=$3`, [today, dateStr, req.user.id]);
    res.json({ ok: true, reminder_date: dateStr });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

// POST /api/beauty/chat — conversational AI beauty advisor (Opus 5, vision, multi-turn)
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { messages, image_base64 } = req.body;
    if (!Array.isArray(messages) || !messages.length) {
      return res.status(400).json({ error: 'لا توجد رسائل' });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'خدمة الذكاء الاصطناعي غير متاحة حالياً' });
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const system = `أنتِ "مستشارة الجمال" الذكية في تطبيق صالون نسائي فاخر اسمه Velour. تتحدثين مع الزبونة بالعربية بأسلوب دافئ وصديق، مثل صديقة خبيرة في التجميل تهتم فيها.

تخصصك يغطي أربعة مجالات:
- 💅 الأظافر: أشكال وألوان ومانيكير ونيل آرت يناسبها
- 💄 المكياج: ألوان وتقنيات تبرز جمالها حسب ملامحها ولون بشرتها
- 💇 الشعر: قصات وألوان وتسريحات تناسب شكل وجهها ونوع شعرها
- 🧴 البشرة: تحليل نوع البشرة، روتين عناية، ومنتجات مناسبة

قواعد مهمة:
- إذا أرسلت الزبونة صورة، حللي ملامحها بدقة (شكل الوجه، لون البشرة، نوع/لون الشعر، حالة الأظافر) واذكري ملاحظاتك بلطف قبل النصائح.
- أعطي نصائح شخصية ومحددة لها هي بالذات، واشرحي دائماً "ليش" هذا يناسبها.
- كوني عملية: خطوات واضحة قابلة للتنفيذ.
- ردودك مرتبة ومركزة (نقاط وإيموجي)، دافئة لكن ليست طويلة مملة.
- التنسيق: استخدمي نقاط بسيطة (-) و**تعريض** للكلمات المهمة فقط. لا تستخدمي جداول (tables) أبداً لأن الرد يظهر في فقاعة محادثة ضيقة على الجوال — استبدلي أي جدول بقائمة نقاط.
- إذا سألت عن شيء خارج مجال الجمال، أعيديها بلطف لتخصصك.
- عند المناسب، شجعيها بلطف على حجز موعد في الصالون.`;

    // keep the last 12 turns to bound cost/latency
    const trimmed = messages.slice(-12);
    const anthMessages = trimmed.map((m, i) => {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      // attach the image only to the most recent user turn
      if (image_base64 && i === trimmed.length - 1 && role === 'user') {
        const mediaType = image_base64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
        const b64 = image_base64.replace(/^data:image\/\w+;base64,/, '');
        return {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
            { type: 'text', text: String(m.content || 'حللي صورتي وأعطيني نصائح.') },
          ],
        };
      }
      return { role, content: String(m.content || '') };
    });

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2000,
      output_config: { effort: 'medium' },
      system,
      messages: anthMessages,
    });

    const reply = (response.content.find(b => b.type === 'text') || {}).text
      || 'عذراً، ما قدرت أرد الآن. جربي مرة ثانية.';
    res.json({ reply });
  } catch (e) {
    console.error('beauty chat error:', e.message);
    res.status(500).json({ error: 'حدث خطأ، جربي مرة ثانية' });
  }
});

module.exports = router;
