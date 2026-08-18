const express = require('express');
const { DB, query } = require('../database');
const { authenticate } = require('./auth');

const router = express.Router();

// GET /api/beauty/profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await DB.users.findById(req.user.id);
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

    const baseSystem = `أنتِ "جوري" 🌹 — مستشارة الجمال الذكية في تطبيق صالون نسائي فاخر اسمه Velour. اسمك جوري، وإذا سألتك الزبونة عن اسمك أو حابة تعرّفي عن نفسك، قولي إنك جوري مستشارة جمالها. تتحدثين مع الزبونة بالعربية بأسلوب دافئ وصديق، مثل صديقة خبيرة في التجميل تهتم فيها.

شخصيتك ونبرتك (مهمة جداً):
- كوني دافئة ومُجامِلة بسخاء! امدحي جمالها بصدق وبشكل يرفع ثقتها ويفرّحها: "ما شاء الله شو حلوة 😍"، "عيونك ساحرة"، "بشرتك ناعمة وحلوة كتير"، "إطلالتك تجنّن"، "أنتِ جميلة طبيعياً وبس رح نبرز جمالك أكتر". خلّيها تحس إنها أميرة.
- بالغي بالمجاملة بشكل لطيف ومبهج ودلوع (بدون ابتذال) — الهدف تنبسط الزبونة وتحس بجمالها وترجع تحكي معك.
- ابدئي ردك عادةً بمجاملة صادقة، وطعّمي كلامك بإطراء بين النصائح، واختمي بكلمة تشجيعية حلوة.
- بس تذكّري: المجاملة **إضافة فوق** النصيحة الحقيقية، مش بديل عنها — لا تنسي أبداً شغلك الأساسي: التحليل الدقيق والنصيحة العملية المفيدة.

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

    // load active product catalog so the AI can recommend real products (shown as cards)
    let catalog = [];
    try { catalog = (await DB.beauty_products.find(p => p.is_active !== 0)) || []; } catch { catalog = []; }
    let system = baseSystem;
    if (catalog.length) {
      const list = catalog.map(p => {
        let tg = ''; try { tg = (JSON.parse(p.tags || '[]') || []).join('، '); } catch {}
        return `#${p.id} [${p.category}] ${p.name}${p.brand ? (' - ' + p.brand) : ''}${tg ? (' (يناسب: ' + tg + ')') : ''}`;
      }).join('\n');
      system += `\n\nكتالوج منتجات الصالون المتاحة:\n${list}\n\nإذا نصحتِ بمنتجات محددة من هذا الكتالوج فقط، أنهي ردك بسطر مستقل بالضبط بهذا الشكل: [[PRODUCTS: 3, 7]] يحتوي أرقام المنتجات المناسبة من الكتالوج (بحد أقصى 4). لا تخترعي أرقاماً غير موجودة. إذا لا يوجد منتج مناسب أو السؤال لا يخص المنتجات، لا تضيفي هذا السطر.`;
    }

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

    // Stream tokens to the client as plain text so the reply "types" live.
    // effort:'low' cuts thinking latency dramatically for a chat advisor.
    // A trailing \x1e frame carries the products JSON after the visible text.
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    // The API can return a transient "overloaded_error". Retry with a small backoff,
    // falling back to a lighter model, but only while we haven't streamed anything yet.
    const MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-sonnet-5'];
    let buf = '';       // full text so far
    let sent = 0;       // chars already written to client
    let started = false;
    let lastErr = null;

    for (let attempt = 0; attempt < MODELS.length; attempt++) {
      try {
        const params = { model: MODELS[attempt], max_tokens: 2000, system, messages: anthMessages };
        if (MODELS[attempt].startsWith('claude-opus')) params.output_config = { effort: 'low' };
        const stream = client.messages.stream(params);
        stream.on('text', (delta) => {
          if (!started) { started = true; if (res.flushHeaders) res.flushHeaders(); }
          buf += delta;
          // never emit the [[PRODUCTS ...]] marker: hold back from '[[' onward,
          // otherwise flush everything except the last char (a '[' may split across deltas)
          const mIdx = buf.indexOf('[[');
          const flushEnd = mIdx >= 0 ? mIdx : Math.max(sent, buf.length - 1);
          if (flushEnd > sent) { res.write(buf.slice(sent, flushEnd)); sent = flushEnd; }
        });
        await stream.finalMessage();
        lastErr = null;
        break; // success
      } catch (e) {
        lastErr = e;
        // if we already emitted text we can't safely restart — stop here
        if (started || sent > 0 || buf.length > 0) break;
        const msg = (e && e.message) || '';
        const retriable = e.status === 429 || e.status === 529 || /overload|rate|timeout|econnreset|503|502/i.test(msg);
        if (attempt < MODELS.length - 1 && retriable) { await new Promise(r => setTimeout(r, 500 * (attempt + 1))); continue; }
        break;
      }
    }

    // Never produced anything → stream a friendly, in-bubble message instead of failing hard.
    if (lastErr && sent === 0 && buf.length === 0) {
      console.error('beauty chat overloaded after retries:', lastErr.message);
      if (res.flushHeaders) res.flushHeaders();
      res.write('🌷 عذراً حبيبتي، أنا مشغولة شوي هلأ. بعتيلي رسالتك مرة ثانية بعد لحظات وبكون جاهزة إلك 💕');
      res.write('\x1e' + JSON.stringify({ products: [] }));
      return res.end();
    }

    // strip the marker, resolve products, flush any remaining visible text
    let full = buf;
    let products = [];
    const mk = full.match(/\[\[\s*PRODUCTS\s*:\s*([0-9,\s]+)\]\]/i);
    if (mk) {
      const ids = mk[1].split(',').map(s => parseInt(s.trim(), 10)).filter(n => n);
      products = catalog.filter(p => ids.includes(p.id)).slice(0, 4).map(p => ({
        id: p.id, category: p.category, name: p.name, brand: p.brand,
        image_url: p.image_url, description: p.description, how_to_use: p.how_to_use, price: p.price,
      }));
      full = full.replace(mk[0], '').trim();
    }
    if (full.length > sent) res.write(full.slice(sent));
    res.write('\x1e' + JSON.stringify({ products }));
    res.end();
  } catch (e) {
    console.error('beauty chat error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: 'حدث خطأ، جربي مرة ثانية' });
    else { try { res.end(); } catch {} }
  }
});

// ===== Beauty product catalog (managed by stylists, recommended by the AI) =====

// GET /api/beauty/products — the caller's product list. Stylists see only their own salon's.
router.get('/products', authenticate, async (req, res) => {
  try {
    let all = (await DB.beauty_products.find(p => p.is_active !== 0)) || [];
    if (req.user.role === 'stylist') {
      const stylist = await DB.stylists.findOne(s => s.user_id === req.user.id);
      all = stylist ? all.filter(p => p.salon_id === stylist.salon_id) : [];
    }
    all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(all);
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

// GET /api/beauty/salon/:salonId/products — a salon's shop (active products, for customers)
router.get('/salon/:salonId/products', authenticate, async (req, res) => {
  try {
    const salonId = parseInt(req.params.salonId, 10);
    const all = (await DB.beauty_products.find(p => p.is_active !== 0 && p.salon_id === salonId)) || [];
    all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(all);
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

// POST /api/beauty/products — add a product (stylists only; auto-linked to their salon)
router.post('/products', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'stylist' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const { category, name, brand = '', image_url = null, tags = [], description = '', how_to_use = '', price = null, stock = 0 } = req.body;
    if (!category || !name) return res.status(400).json({ error: 'الفئة والاسم مطلوبان' });
    const stylist = await DB.stylists.findOne(s => s.user_id === req.user.id);
    const salon_id = stylist ? stylist.salon_id : null;
    const tagsStr = Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : '[]');
    const p = await DB.beauty_products.insert({ salon_id, category, name, brand, image_url, tags: tagsStr, description, how_to_use, price, stock: parseInt(stock) || 0 });
    res.json(p);
  } catch (e) {
    console.error('add product error:', e.message);
    res.status(500).json({ error: 'خطأ في الإضافة' });
  }
});

// PUT /api/beauty/products/:id — update a product (restock/edit; stylists only)
router.put('/products/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'stylist' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const id = parseInt(req.params.id, 10);
    const existing = await DB.beauty_products.findOne(p => p.id === id);
    if (!existing) return res.status(404).json({ error: 'المنتج غير موجود' });
    if (req.user.role !== 'admin') {
      const stylist = await DB.stylists.findOne(s => s.user_id === req.user.id);
      if (!stylist || existing.salon_id !== stylist.salon_id) return res.status(403).json({ error: 'غير مصرح' });
    }
    const patch = {};
    const b = req.body;
    if (b.stock !== undefined) patch.stock = Math.max(0, parseInt(b.stock) || 0);
    if (b.price !== undefined) patch.price = b.price === null || b.price === '' ? null : parseFloat(b.price);
    if (b.name !== undefined) patch.name = String(b.name).trim();
    if (b.description !== undefined) patch.description = String(b.description);
    if (b.how_to_use !== undefined) patch.how_to_use = String(b.how_to_use);
    if (b.category !== undefined) patch.category = b.category;
    if (b.brand !== undefined) patch.brand = String(b.brand);
    if (b.image_url !== undefined) patch.image_url = b.image_url;
    if (b.tags !== undefined) patch.tags = Array.isArray(b.tags) ? JSON.stringify(b.tags) : (b.tags || '[]');
    await DB.beauty_products.update(p => p.id === id, patch);
    res.json({ ok: true, ...patch });
  } catch (e) {
    console.error('update product error:', e.message);
    res.status(500).json({ error: 'خطأ في التعديل' });
  }
});

// DELETE /api/beauty/products/:id — remove a product (stylists only)
router.delete('/products/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'stylist' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const id = parseInt(req.params.id, 10);
    await DB.beauty_products.remove(p => p.id === id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'خطأ في الحذف' });
  }
});

// POST /api/beauty/stylist-assistant — AI business+craft assistant for stylists (Opus 5)
router.post('/stylist-assistant', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'stylist' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'هذه الميزة للكوافيرات فقط' });
    }
    const { messages } = req.body;
    if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'لا توجد رسائل' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'خدمة الذكاء الاصطناعي غير متاحة حالياً' });

    // ---- build a real business snapshot for this stylist's salon ----
    let snapshot = '';
    try {
      const stylist = await DB.stylists.findOne(s => s.user_id === req.user.id);
      const salonId = stylist && stylist.salon_id;
      if (salonId) {
        const bookings = (await DB.bookings.find(b => b.salon_id === salonId)) || [];
        const services = (await DB.services.find(s => s.salon_id === salonId)) || [];
        const ratings = (await DB.salon_ratings.find(r => r.salon_id === salonId)) || [];
        const products = (await DB.beauty_products.find(p => p.is_active !== 0)) || [];
        const now = Date.now();
        const day = 86400000;
        const pdate = (b) => new Date(b.booking_date || b.created_at).getTime();
        const done = bookings.filter(b => b.status === 'completed');
        const revenueAll = done.reduce((s, b) => s + Number(b.total_price || 0), 0);
        const monthB = bookings.filter(b => pdate(b) >= now - 30 * day);
        const revenueMonth = monthB.filter(b => b.status === 'completed').reduce((s, b) => s + Number(b.total_price || 0), 0);

        const svcCount = {};
        bookings.forEach(b => { if (b.service_id) svcCount[b.service_id] = (svcCount[b.service_id] || 0) + 1; });
        const topSvc = Object.entries(svcCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([id, c]) => { const s = services.find(x => String(x.id) === String(id)); return `${s ? (s.name_ar || s.name) : ('#' + id)} (${c} حجز)`; });

        const dowNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const dow = {};
        bookings.forEach(b => { const d = new Date(b.booking_date || b.created_at); if (!isNaN(d)) dow[d.getDay()] = (dow[d.getDay()] || 0) + 1; });
        const busyDays = Object.entries(dow).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([d, c]) => `${dowNames[d]} (${c})`);
        const quietDays = dowNames.map((n, i) => [n, dow[i] || 0]).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([n, c]) => `${n} (${c})`);

        const lastByClient = {};
        bookings.forEach(b => { if (b.client_id) { const t = pdate(b); if (!lastByClient[b.client_id] || t > lastByClient[b.client_id]) lastByClient[b.client_id] = t; } });
        const lapsed = Object.values(lastByClient).filter(t => t < now - 60 * day).length;
        const avgRating = ratings.length ? (ratings.reduce((s, r) => s + Number(r.stars || 0), 0) / ratings.length).toFixed(1) : 'لا يوجد';

        snapshot = `\n\nبيانات صالونك الفعلية (استندي عليها في نصائح العمل والأرقام):
- إجمالي الحجوزات: ${bookings.length} | آخر 30 يوم: ${monthB.length}
- الدخل الإجمالي (حجوزات مكتملة): ${revenueAll} ₪ | آخر 30 يوم: ${revenueMonth} ₪
- أكثر الخدمات طلباً: ${topSvc.join('، ') || 'لا يوجد بيانات'}
- أكثر الأيام ازدحاماً: ${busyDays.join('، ') || 'لا يوجد'} | أهدأ الأيام (فرصة لعروض): ${quietDays.join('، ')}
- زبونات لم يرجعن منذ 60+ يوم (فرصة استرجاع): ${lapsed}
- متوسط تقييم الصالون: ${avgRating}
- عدد منتجات كتالوج المستشار الذكي: ${products.length}`;
      } else {
        snapshot = '\n\nملاحظة: لا يوجد صالون مرتبط بحسابك بعد، لذا لا تتوفر أرقام. ساعديها في الأسئلة التقنية والتسويقية وردود الزبونات.';
      }
    } catch (e) { snapshot = ''; }

    const system = `أنتِ "جوري" 🌹 — المساعِدة الذكية في تطبيق Velour لإدارة صالونات التجميل. اسمك جوري، وإذا سألتك عن اسمك عرّفي عن نفسك باسمك. أنتِ مساعِدة أعمال + خبيرة تجميل محترفة، تساعدين صاحبة الصالون تدير وتكبّر شغلها. تحدثي بالعربية بأسلوب عملي وودود ومحترف.

أدوارك الأربعة:
1) 📊 مستشارة أعمال: حللي أرقام صالونها وأعطيها نصائح عملية تزيد دخلها — استرجاع الزبونات اللي ما رجعوا، ملء الأيام الهادئة بعروض، التركيز على أكثر الخدمات طلباً، واقتراح بيع منتجات (upsell).
2) 💬 مساعِدة ردود: إذا طلبت، اكتبيلها ردوداً دافئة ومهنية لرسائل زبوناتها.
3) 🎨 مستشارة تقنية: جاوبي أسئلتها المهنية — فورمولات صبغة، تصحيح لون، علاجات شعر/بشرة، نسب خلط، حلول للمشاكل التقنية.
4) 📣 مولّدة محتوى تسويقي: اكتبي عروضاً، كابشنات إنستغرام، وصف خدمات، وأفكار حملات موسمية.

قواعد:
- استندي على أرقامها الفعلية (تحت) عند نصائح العمل، وكوني محددة وعملية بخطوات قابلة للتنفيذ — لا نصائح عامة.
- ردود مرتبة بنقاط وإيموجي. لا تستخدمي جداول (tables) لأن الرد يظهر بفقاعة محادثة على الجوال.
- إذا كان طلبها غير واضح، اسأليها أي دور تريد المساعدة به.${snapshot}`;

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const trimmed = messages.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }));

    // stream the reply live (effort:'low' for snappy first token)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    // retry transient overloads with a lighter fallback model, only while nothing streamed yet
    const MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-sonnet-5'];
    let started = false, lastErr = null;
    for (let attempt = 0; attempt < MODELS.length; attempt++) {
      try {
        const params = { model: MODELS[attempt], max_tokens: 2000, system, messages: trimmed };
        if (MODELS[attempt].startsWith('claude-opus')) params.output_config = { effort: 'low' };
        const stream = client.messages.stream(params);
        stream.on('text', (delta) => { if (!started) { started = true; if (res.flushHeaders) res.flushHeaders(); } res.write(delta); });
        await stream.finalMessage();
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (started) break;
        const msg = (e && e.message) || '';
        const retriable = e.status === 429 || e.status === 529 || /overload|rate|timeout|econnreset|503|502/i.test(msg);
        if (attempt < MODELS.length - 1 && retriable) { await new Promise(r => setTimeout(r, 500 * (attempt + 1))); continue; }
        break;
      }
    }
    if (lastErr && !started) {
      console.error('stylist assistant overloaded after retries:', lastErr.message);
      if (res.flushHeaders) res.flushHeaders();
      res.write('🌷 عذراً، أنا مشغولة شوي هلأ — جرّبي تبعتي رسالتك مرة ثانية بعد لحظات.');
    }
    res.end();
  } catch (e) {
    console.error('stylist assistant error:', e.message);
    if (!res.headersSent) res.status(500).json({ error: 'حدث خطأ، جربي مرة ثانية' });
    else { try { res.end(); } catch {} }
  }
});

module.exports = router;
