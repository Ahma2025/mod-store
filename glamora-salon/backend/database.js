const { Pool } = require('pg');

const _dbUrl = process.env.DATABASE_URL || '';
const _noSsl = _dbUrl.includes('railway.internal') || _dbUrl.includes('localhost') || _dbUrl.includes('127.0.0.1') || _dbUrl.includes('sslmode=disable');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: _noSsl ? false : { rejectUnauthorized: false },
  max: parseInt(process.env.PG_POOL_MAX || '30', 10),   // was default 10 → bottleneck under load
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const query = (text, params) => pool.query(text, params);

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'client',
      loyalty_points INTEGER DEFAULT 0,
      avatar TEXT,
      fcm_token TEXT,
      fcm_platform TEXT,
      fcm_updated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS salons (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      phone TEXT DEFAULT '',
      cover_emoji TEXT DEFAULT '💅',
      rating NUMERIC(3,1) DEFAULT 0,
      reviews_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      latitude NUMERIC(10,7),
      longitude NUMERIC(10,7)
    );

    CREATE TABLE IF NOT EXISTS salon_hours (
      id SERIAL PRIMARY KEY,
      salon_id INTEGER REFERENCES salons(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      open_time TEXT DEFAULT '09:00',
      close_time TEXT DEFAULT '20:00',
      is_closed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS stylists (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      salon_id INTEGER REFERENCES salons(id) ON DELETE CASCADE,
      name TEXT,
      phone TEXT DEFAULT '',
      email TEXT,
      bio TEXT DEFAULT '',
      specialties TEXT DEFAULT '[]',
      experience_years INTEGER DEFAULT 1,
      rating NUMERIC(3,1) DEFAULT 0,
      reviews_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      salon_id INTEGER REFERENCES salons(id) ON DELETE CASCADE,
      stylist_id INTEGER REFERENCES stylists(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      name_ar TEXT,
      category TEXT,
      duration_minutes INTEGER DEFAULT 60,
      price NUMERIC(10,2) NOT NULL,
      description TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      client_id INTEGER REFERENCES users(id),
      stylist_id INTEGER REFERENCES stylists(id),
      service_id INTEGER REFERENCES services(id),
      salon_id INTEGER REFERENCES salons(id),
      booking_date TEXT NOT NULL,
      booking_time TEXT NOT NULL,
      notes TEXT,
      total_price NUMERIC(10,2),
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'unpaid'
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      booking_id INTEGER REFERENCES bookings(id),
      client_id INTEGER REFERENCES users(id),
      stylist_id INTEGER REFERENCES stylists(id),
      rating INTEGER,
      comment TEXT
    );

    CREATE TABLE IF NOT EXISTS salon_ratings (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ,
      salon_id INTEGER REFERENCES salons(id) ON DELETE CASCADE,
      client_id INTEGER REFERENCES users(id),
      stars INTEGER,
      comment TEXT DEFAULT '',
      UNIQUE(salon_id, client_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      sender_id INTEGER REFERENCES users(id),
      receiver_id INTEGER REFERENCES users(id),
      booking_id INTEGER REFERENCES bookings(id),
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS color_formulas (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      client_id INTEGER REFERENCES users(id),
      stylist_id INTEGER REFERENCES stylists(id),
      formula TEXT,
      color_name TEXT,
      notes TEXT,
      visit_date TEXT
    );

    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      user_id INTEGER REFERENCES users(id),
      points INTEGER,
      type TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS stylist_availability (
      id SERIAL PRIMARY KEY,
      stylist_id INTEGER REFERENCES stylists(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      is_off INTEGER DEFAULT 0,
      start_time TEXT DEFAULT '09:00',
      end_time TEXT DEFAULT '17:00',
      shift2_enabled INTEGER DEFAULT 0,
      shift2_start TEXT,
      shift2_end TEXT,
      UNIQUE(stylist_id, day_of_week)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      user_id INTEGER REFERENCES users(id),
      title TEXT,
      body TEXT,
      type TEXT,
      booking_id INTEGER,
      is_read INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS salon_media (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      salon_id INTEGER REFERENCES salons(id) ON DELETE CASCADE,
      filename TEXT,
      url TEXT,
      type TEXT DEFAULT 'photo',
      is_cover INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS stylist_blocked_slots (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      stylist_id INTEGER REFERENCES stylists(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      reason TEXT DEFAULT ''
    );
  `);

  // Safe migrations — add columns that may not exist in older deployments
  const migrations = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_platform TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_updated_at TIMESTAMPTZ`,
    `ALTER TABLE salons ADD COLUMN IF NOT EXISTS cover_url TEXT`,
    `ALTER TABLE salons ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7)`,
    `ALTER TABLE salons ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7)`,
    `ALTER TABLE stylists ADD COLUMN IF NOT EXISTS avatar TEXT`,
    `ALTER TABLE salons ADD COLUMN IF NOT EXISTS categories TEXT DEFAULT '[]'`,
    `ALTER TABLE salons ADD COLUMN IF NOT EXISTS is_verified INTEGER DEFAULT 0`,
    `ALTER TABLE salons ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE salons ADD COLUMN IF NOT EXISTS revenue_reset_at TIMESTAMPTZ`,
    `ALTER TABLE salon_ratings ADD COLUMN IF NOT EXISTS cleanliness_rating INTEGER`,
    `ALTER TABLE salon_ratings ADD COLUMN IF NOT EXISTS punctuality_rating INTEGER`,
    `ALTER TABLE salon_ratings ADD COLUMN IF NOT EXISTS result_rating INTEGER`,
    `ALTER TABLE salon_ratings ADD COLUMN IF NOT EXISTS before_photo TEXT`,
    `ALTER TABLE salon_ratings ADD COLUMN IF NOT EXISTS after_photo TEXT`,
    `ALTER TABLE salon_ratings ADD COLUMN IF NOT EXISTS reply_text TEXT`,
    `ALTER TABLE salon_ratings ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS msg_type TEXT DEFAULT 'text'`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS hair_color TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS hair_texture TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS skin_tone TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS face_shape TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS allergies TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS color_notes TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences_json TEXT DEFAULT '{}'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_color_date TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS next_reminder_date TEXT`,
    `CREATE TABLE IF NOT EXISTS salon_offers (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      salon_id INTEGER REFERENCES salons(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      discount_percent INTEGER DEFAULT 0,
      valid_until TEXT,
      is_active INTEGER DEFAULT 1
    )`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_ids TEXT`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_duration INTEGER`,
    `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2)`,
    `CREATE TABLE IF NOT EXISTS salon_inventory (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      salon_id INTEGER REFERENCES salons(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity NUMERIC(10,2) DEFAULT 0,
      unit TEXT DEFAULT 'قطعة',
      low_threshold INTEGER DEFAULT 2
    )`,
    `CREATE TABLE IF NOT EXISTS beauty_products (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      salon_id INTEGER,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      brand TEXT DEFAULT '',
      image_url TEXT,
      tags TEXT DEFAULT '[]',
      description TEXT DEFAULT '',
      how_to_use TEXT DEFAULT '',
      price NUMERIC(10,2),
      is_active INTEGER DEFAULT 1
    )`,
    // deep-link target for a notification (booking_id / order_id / sender user_id / salon_id)
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS ref_id INTEGER`,
    // ===== product shop =====
    `ALTER TABLE beauty_products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0`,
    `ALTER TABLE salons ADD COLUMN IF NOT EXISTS delivery_prices TEXT`,   // JSON {west_bank,jerusalem,inside}
    `CREATE TABLE IF NOT EXISTS product_orders (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      salon_id INTEGER REFERENCES salons(id) ON DELETE CASCADE,
      client_id INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'pending',
      items TEXT DEFAULT '[]',
      subtotal NUMERIC(10,2) DEFAULT 0,
      delivery_method TEXT DEFAULT 'pickup',
      delivery_region TEXT,
      delivery_fee NUMERIC(10,2) DEFAULT 0,
      total NUMERIC(10,2) DEFAULT 0,
      customer_name TEXT,
      customer_phone TEXT,
      city TEXT,
      address TEXT,
      notes TEXT DEFAULT ''
    )`,
    // ===== performance indexes (huge win once queries filter in SQL) =====
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_salon ON bookings(salon_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_stylist_date ON bookings(stylist_id, booking_date)`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_stylists_salon ON stylists(salon_id)`,
    `CREATE INDEX IF NOT EXISTS idx_stylists_user ON stylists(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_services_salon ON services(salon_id)`,
    `CREATE INDEX IF NOT EXISTS idx_salon_media_salon ON salon_media(salon_id)`,
    `CREATE INDEX IF NOT EXISTS idx_salon_ratings_salon ON salon_ratings(salon_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reviews_stylist ON reviews(stylist_id)`,
    `CREATE INDEX IF NOT EXISTS idx_salon_ratings_client ON salon_ratings(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_salon_hours_salon ON salon_hours(salon_id)`,
    `CREATE INDEX IF NOT EXISTS idx_beauty_products_salon ON beauty_products(salon_id)`,
    `CREATE INDEX IF NOT EXISTS idx_product_orders_salon ON product_orders(salon_id)`,
    `CREATE INDEX IF NOT EXISTS idx_product_orders_client ON product_orders(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_stylist_availability_stylist ON stylist_availability(stylist_id)`,
    `CREATE INDEX IF NOT EXISTS idx_blocked_slots_stylist ON stylist_blocked_slots(stylist_id)`,
  ];
  for (const m of migrations) {
    try { await pool.query(m); } catch (e) { /* column/index may already exist */ }
  }

  console.log('[DB] PostgreSQL schema ready');
}

// Helper: convert pg rows to plain objects with integers where needed
function row(r) { return r || null; }
function rows(r) { return r || []; }

const DB = {
  users: {
    insert: async (data) => {
      const { name, phone, email = null, password_hash, role = 'client', loyalty_points = 0, avatar = null, fcm_token = null, fcm_platform = null } = data;
      const r = await query(
        `INSERT INTO users (name,phone,email,password_hash,role,loyalty_points,avatar,fcm_token,fcm_platform) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [name, phone, email, password_hash, role, loyalty_points, avatar, fcm_token, fcm_platform]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM users');
      return rows(r.rows).filter(filter);
    },
    findOne: async (filter) => {
      const r = await query('SELECT * FROM users');
      return rows(r.rows).find(filter) || null;
    },
    // ⚡ indexed lookups — use these on hot paths instead of full-table scans
    findById: async (id) => {
      const r = await query('SELECT * FROM users WHERE id=$1', [id]);
      return row(r.rows[0]);
    },
    findByPhone: async (phone) => {
      const r = await query('SELECT * FROM users WHERE phone=$1', [phone]);
      return row(r.rows[0]);
    },
    update: async (filter, data) => {
      const r = await query('SELECT * FROM users');
      const matched = rows(r.rows).filter(filter);
      for (const u of matched) {
        const fields = Object.keys(data).map((k, i) => `${k}=$${i + 2}`).join(',');
        await query(`UPDATE users SET ${fields} WHERE id=$1`, [u.id, ...Object.values(data)]);
      }
    },
    updateOne: async (filter, data) => {
      const r = await query('SELECT * FROM users');
      const u = rows(r.rows).find(filter);
      if (!u) return;
      const fields = Object.keys(data).map((k, i) => `${k}=$${i + 2}`).join(',');
      await query(`UPDATE users SET ${fields} WHERE id=$1`, [u.id, ...Object.values(data)]);
    },
  },

  salons: {
    insert: async (data) => {
      const { name, description = '', address, city, phone = '', cover_emoji = '💅', rating = 0, reviews_count = 0 } = data;
      const r = await query(
        `INSERT INTO salons (name,description,address,city,phone,cover_emoji,rating,reviews_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [name, description, address, city, phone, cover_emoji, rating, reviews_count]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM salons');
      return rows(r.rows).filter(filter);
    },
    findOne: async (filter) => {
      const r = await query('SELECT * FROM salons');
      return rows(r.rows).find(filter) || null;
    },
    update: async (filter, data) => {
      const r = await query('SELECT * FROM salons');
      const matched = rows(r.rows).filter(filter);
      for (const s of matched) {
        const fields = Object.keys(data).map((k, i) => `${k}=$${i + 2}`).join(',');
        await query(`UPDATE salons SET ${fields} WHERE id=$1`, [s.id, ...Object.values(data)]);
      }
    },
  },

  salon_hours: {
    insert: async (data) => {
      const { salon_id, day_of_week, open_time = '09:00', close_time = '20:00', is_closed = 0 } = data;
      const r = await query(
        `INSERT INTO salon_hours (salon_id,day_of_week,open_time,close_time,is_closed) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [salon_id, day_of_week, open_time, close_time, is_closed]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM salon_hours');
      return rows(r.rows).filter(filter);
    },
    upsert: async (salon_id, day_of_week, data) => {
      const { open_time, close_time, is_closed } = data;
      await query(
        `INSERT INTO salon_hours (salon_id,day_of_week,open_time,close_time,is_closed) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING`,
        [salon_id, day_of_week, open_time, close_time, is_closed]
      );
      await query(
        `UPDATE salon_hours SET open_time=$3, close_time=$4, is_closed=$5 WHERE salon_id=$1 AND day_of_week=$2`,
        [salon_id, day_of_week, open_time, close_time, is_closed]
      );
    },
  },

  stylists: {
    insert: async (data) => {
      const { user_id = null, salon_id, name = null, phone = '', email = null, bio = '', specialties = '[]', experience_years = 1, rating = 0, reviews_count = 0, is_active = 1 } = data;
      const r = await query(
        `INSERT INTO stylists (user_id,salon_id,name,phone,email,bio,specialties,experience_years,rating,reviews_count,is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [user_id, salon_id, name, phone, email, bio, specialties, experience_years, rating, reviews_count, is_active]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM stylists');
      return rows(r.rows).filter(filter);
    },
    findOne: async (filter) => {
      const r = await query('SELECT * FROM stylists');
      return rows(r.rows).find(filter) || null;
    },
    update: async (filter, data) => {
      const r = await query('SELECT * FROM stylists');
      const matched = rows(r.rows).filter(filter);
      for (const s of matched) {
        const fields = Object.keys(data).map((k, i) => `${k}=$${i + 2}`).join(',');
        await query(`UPDATE stylists SET ${fields} WHERE id=$1`, [s.id, ...Object.values(data)]);
      }
    },
  },

  services: {
    insert: async (data) => {
      const { salon_id, stylist_id = null, name, name_ar = null, category = null, duration_minutes = 60, price, description = '', is_active = 1 } = data;
      const r = await query(
        `INSERT INTO services (salon_id,stylist_id,name,name_ar,category,duration_minutes,price,description,is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [salon_id, stylist_id, name, name_ar, category, duration_minutes, price, description, is_active]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM services');
      return rows(r.rows).filter(filter);
    },
    findOne: async (filter) => {
      const r = await query('SELECT * FROM services');
      return rows(r.rows).find(filter) || null;
    },
    update: async (filter, data) => {
      const r = await query('SELECT * FROM services');
      const matched = rows(r.rows).filter(filter);
      for (const s of matched) {
        const fields = Object.keys(data).map((k, i) => `${k}=$${i + 2}`).join(',');
        await query(`UPDATE services SET ${fields} WHERE id=$1`, [s.id, ...Object.values(data)]);
      }
    },
  },

  bookings: {
    insert: async (data) => {
      const { client_id, stylist_id, service_id, service_ids = null, salon_id, booking_date, booking_time, notes = null, total_price, total_duration = null, status = 'pending', payment_status = 'unpaid' } = data;
      const r = await query(
        `INSERT INTO bookings (client_id,stylist_id,service_id,service_ids,salon_id,booking_date,booking_time,notes,total_price,total_duration,status,payment_status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [client_id, stylist_id, service_id, service_ids, salon_id, booking_date, booking_time, notes, total_price, total_duration, status, payment_status]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM bookings');
      return rows(r.rows).filter(filter);
    },
    findOne: async (filter) => {
      const r = await query('SELECT * FROM bookings');
      return rows(r.rows).find(filter) || null;
    },
    update: async (filter, data) => {
      const r = await query('SELECT * FROM bookings');
      const matched = rows(r.rows).filter(filter);
      for (const b of matched) {
        const fields = Object.keys(data).map((k, i) => `${k}=$${i + 2}`).join(',');
        await query(`UPDATE bookings SET ${fields} WHERE id=$1`, [b.id, ...Object.values(data)]);
      }
    },
  },

  reviews: {
    insert: async (data) => {
      const { booking_id = null, client_id, stylist_id, rating, comment = null } = data;
      const r = await query(
        `INSERT INTO reviews (booking_id,client_id,stylist_id,rating,comment) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [booking_id, client_id, stylist_id, rating, comment]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM reviews');
      return rows(r.rows).filter(filter);
    },
  },

  salon_ratings: {
    insert: async (data) => {
      const { salon_id, client_id, stars, comment = '' } = data;
      const r = await query(
        `INSERT INTO salon_ratings (salon_id,client_id,stars,comment) VALUES ($1,$2,$3,$4)
         ON CONFLICT (salon_id,client_id) DO UPDATE SET stars=$3, comment=$4, updated_at=NOW() RETURNING *`,
        [salon_id, client_id, stars, comment]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM salon_ratings');
      return rows(r.rows).filter(filter);
    },
    findOne: async (filter) => {
      const r = await query('SELECT * FROM salon_ratings');
      return rows(r.rows).find(filter) || null;
    },
    update: async (filter, data) => {
      const r = await query('SELECT * FROM salon_ratings');
      const matched = rows(r.rows).filter(filter);
      for (const sr of matched) {
        const fields = Object.keys(data).map((k, i) => `${k}=$${i + 2}`).join(',');
        await query(`UPDATE salon_ratings SET ${fields} WHERE id=$1`, [sr.id, ...Object.values(data)]);
      }
    },
  },

  messages: {
    insert: async (data) => {
      const { sender_id, receiver_id, booking_id = null, content, is_read = 0 } = data;
      const r = await query(
        `INSERT INTO messages (sender_id,receiver_id,booking_id,content,is_read) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [sender_id, receiver_id, booking_id, content, is_read]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM messages');
      return rows(r.rows).filter(filter);
    },
    update: async (filter, data) => {
      const r = await query('SELECT * FROM messages');
      const matched = rows(r.rows).filter(filter);
      for (const m of matched) {
        const fields = Object.keys(data).map((k, i) => `${k}=$${i + 2}`).join(',');
        await query(`UPDATE messages SET ${fields} WHERE id=$1`, [m.id, ...Object.values(data)]);
      }
    },
  },

  color_formulas: {
    insert: async (data) => {
      const { client_id, stylist_id, formula, color_name, notes = null, visit_date } = data;
      const r = await query(
        `INSERT INTO color_formulas (client_id,stylist_id,formula,color_name,notes,visit_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [client_id, stylist_id, formula, color_name, notes, visit_date]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM color_formulas');
      return rows(r.rows).filter(filter);
    },
  },

  loyalty_transactions: {
    insert: async (data) => {
      const { user_id, points, type, description } = data;
      const r = await query(
        `INSERT INTO loyalty_transactions (user_id,points,type,description) VALUES ($1,$2,$3,$4) RETURNING *`,
        [user_id, points, type, description]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM loyalty_transactions');
      return rows(r.rows).filter(filter);
    },
  },

  stylist_availability: {
    insert: async (data) => {
      const { stylist_id, day_of_week, is_off = 0, start_time = '09:00', end_time = '17:00', shift2_enabled = 0, shift2_start = null, shift2_end = null } = data;
      const r = await query(
        `INSERT INTO stylist_availability (stylist_id,day_of_week,is_off,start_time,end_time,shift2_enabled,shift2_start,shift2_end)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (stylist_id,day_of_week) DO UPDATE
         SET is_off=$3,start_time=$4,end_time=$5,shift2_enabled=$6,shift2_start=$7,shift2_end=$8 RETURNING *`,
        [stylist_id, day_of_week, is_off, start_time, end_time, shift2_enabled, shift2_start, shift2_end]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM stylist_availability');
      return rows(r.rows).filter(filter);
    },
    findOne: async (filter) => {
      const r = await query('SELECT * FROM stylist_availability');
      return rows(r.rows).find(filter) || null;
    },
  },

  notifications: {
    insert: async (data) => {
      const { user_id, title, body, type, booking_id = null, ref_id = null, is_read = 0 } = data;
      const r = await query(
        `INSERT INTO notifications (user_id,title,body,type,booking_id,ref_id,is_read) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [user_id, title, body, type, booking_id, ref_id, is_read]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM notifications');
      return rows(r.rows).filter(filter);
    },
    update: async (filter, data) => {
      const r = await query('SELECT * FROM notifications');
      const matched = rows(r.rows).filter(filter);
      for (const n of matched) {
        const fields = Object.keys(data).map((k, i) => `${k}=$${i + 2}`).join(',');
        await query(`UPDATE notifications SET ${fields} WHERE id=$1`, [n.id, ...Object.values(data)]);
      }
    },
  },

  salon_media: {
    insert: async (data) => {
      const { salon_id, filename, url, type = 'photo', is_cover = 0 } = data;
      const r = await query(
        `INSERT INTO salon_media (salon_id,filename,url,type,is_cover) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [salon_id, filename, url, type, is_cover]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM salon_media');
      return rows(r.rows).filter(filter);
    },
    findOne: async (filter) => {
      const r = await query('SELECT * FROM salon_media');
      return rows(r.rows).find(filter) || null;
    },
    remove: async (filter) => {
      const r = await query('SELECT * FROM salon_media');
      const matched = rows(r.rows).filter(filter);
      for (const m of matched) {
        await query('DELETE FROM salon_media WHERE id=$1', [m.id]);
      }
    },
    update: async (filter, data) => {
      const r = await query('SELECT * FROM salon_media');
      const matched = rows(r.rows).filter(filter);
      for (const m of matched) {
        const fields = Object.keys(data).map((k, i) => `${k}=$${i + 2}`).join(',');
        await query(`UPDATE salon_media SET ${fields} WHERE id=$1`, [m.id, ...Object.values(data)]);
      }
    },
  },

  stylist_blocked_slots: {
    insert: async (data) => {
      const { stylist_id, date, start_time, end_time, reason = '' } = data;
      const r = await query(
        `INSERT INTO stylist_blocked_slots (stylist_id,date,start_time,end_time,reason) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [stylist_id, date, start_time, end_time, reason]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM stylist_blocked_slots');
      return rows(r.rows).filter(filter);
    },
    findOne: async (filter) => {
      const r = await query('SELECT * FROM stylist_blocked_slots');
      return rows(r.rows).find(filter) || null;
    },
    remove: async (filter) => {
      const r = await query('SELECT * FROM stylist_blocked_slots');
      const matched = rows(r.rows).filter(filter);
      for (const b of matched) {
        await query('DELETE FROM stylist_blocked_slots WHERE id=$1', [b.id]);
      }
    },
  },

  beauty_products: {
    insert: async (data) => {
      const { salon_id = null, category, name, brand = '', image_url = null, tags = '[]', description = '', how_to_use = '', price = null, is_active = 1, stock = 0 } = data;
      const r = await query(
        `INSERT INTO beauty_products (salon_id,category,name,brand,image_url,tags,description,how_to_use,price,is_active,stock) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [salon_id, category, name, brand, image_url, tags, description, how_to_use, price, is_active, stock]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => {
      const r = await query('SELECT * FROM beauty_products');
      return rows(r.rows).filter(filter);
    },
    findOne: async (filter) => {
      const r = await query('SELECT * FROM beauty_products');
      return rows(r.rows).find(filter) || null;
    },
    remove: async (filter) => {
      const r = await query('SELECT * FROM beauty_products');
      const matched = rows(r.rows).filter(filter);
      for (const p of matched) await query('DELETE FROM beauty_products WHERE id=$1', [p.id]);
    },
    update: async (filter, data) => {
      const r = await query('SELECT * FROM beauty_products');
      const matched = rows(r.rows).filter(filter);
      for (const p of matched) {
        const fields = Object.keys(data).map((k, i) => `${k}=$${i + 2}`).join(',');
        await query(`UPDATE beauty_products SET ${fields} WHERE id=$1`, [p.id, ...Object.values(data)]);
      }
    },
  },

  product_orders: {
    insert: async (data) => {
      const { salon_id, client_id, status = 'pending', items = '[]', subtotal = 0, delivery_method = 'pickup', delivery_region = null, delivery_fee = 0, total = 0, customer_name = '', customer_phone = '', city = null, address = null, notes = '' } = data;
      const r = await query(
        `INSERT INTO product_orders (salon_id,client_id,status,items,subtotal,delivery_method,delivery_region,delivery_fee,total,customer_name,customer_phone,city,address,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [salon_id, client_id, status, items, subtotal, delivery_method, delivery_region, delivery_fee, total, customer_name, customer_phone, city, address, notes]
      );
      return row(r.rows[0]);
    },
    find: async (filter) => { const r = await query('SELECT * FROM product_orders'); return rows(r.rows).filter(filter); },
    findOne: async (filter) => { const r = await query('SELECT * FROM product_orders'); return rows(r.rows).find(filter) || null; },
    update: async (filter, data) => {
      const r = await query('SELECT * FROM product_orders');
      const matched = rows(r.rows).filter(filter);
      for (const o of matched) {
        const fields = Object.keys(data).map((k, i) => `${k}=$${i + 2}`).join(',');
        await query(`UPDATE product_orders SET ${fields} WHERE id=$1`, [o.id, ...Object.values(data)]);
      }
    },
  },
};

module.exports = { DB, query, pool, initDatabase };
