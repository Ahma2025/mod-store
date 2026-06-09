const Datastore = require('@seald-io/nedb');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const db = {
  owner:  new Datastore({ filename: path.join(dataDir, 'owner.db'),  autoload: true }),
  items:  new Datastore({ filename: path.join(dataDir, 'items.db'),  autoload: true }),
  orders: new Datastore({ filename: path.join(dataDir, 'orders.db'), autoload: true }),
};

// Promisify
const q = {
  find:   (col, query={}, sort={}) => new Promise((res,rej) => { let c=col.find(query); if(Object.keys(sort).length) c=c.sort(sort); c.exec((e,d)=>e?rej(e):res(d)); }),
  findOne:(col, query)             => new Promise((res,rej) => col.findOne(query,(e,d)=>e?rej(e):res(d))),
  insert: (col, doc)               => new Promise((res,rej) => col.insert(doc,(e,d)=>e?rej(e):res(d))),
  update: (col, query, upd, opts={})=> new Promise((res,rej) => col.update(query,upd,opts,(e,n)=>e?rej(e):res(n))),
  remove: (col, query, opts={})    => new Promise((res,rej) => col.remove(query,opts,(e,n)=>e?rej(e):res(n))),
  count:  (col, query={})          => new Promise((res,rej) => col.count(query,(e,n)=>e?rej(e):res(n))),
};

// Seed owner + sample menu
async function seed() {
  const ownerCount = await q.count(db.owner);
  if (ownerCount === 0) {
    const hash = await bcrypt.hash('owner123', 10);
    await q.insert(db.owner, {
      username: 'owner',
      password: hash,
      restaurant: 'مطعمك',
      phone: '05XXXXXXXX',
      address: 'مدينتك — فلسطين',
      created_at: new Date().toISOString(),
    });
    console.log('✅ Owner created: username=owner, password=owner123');
  }

  const itemCount = await q.count(db.items);
  if (itemCount === 0) {
    const sampleItems = [
      {
        name: 'Chili Burger',
        name_ar: 'تشيلي برجر',
        description: 'برجر لحم مشوي مع صلصة التشيلي الحارة والجبنة الذائبة',
        price: 18,
        image: '',
        emoji: '🌶️',
        category: 'برجر',
        available: true,
        addons: [
          { id: 'a1', name: 'إضافة جبنة', name_ar: 'إضافة جبنة', price: 2 },
          { id: 'a2', name: 'بيض مقلي', name_ar: 'بيض مقلي', price: 2 },
          { id: 'a3', name: 'صلصة إضافية', name_ar: 'صلصة إضافية', price: 0 },
          { id: 'a4', name: 'خس وطماطم', name_ar: 'خس وطماطم', price: 0 },
        ],
        created_at: new Date().toISOString(),
      },
      {
        name: 'Cheeseburger Deluxe',
        name_ar: 'تشيزبرجر ديلوكس',
        description: 'برجر لحم مزدوج مع شرائح الجبنة الأمريكية والخضروات الطازجة',
        price: 22,
        image: '',
        emoji: '🍔',
        category: 'برجر',
        available: true,
        addons: [
          { id: 'b1', name: 'بيكون مقرمش', name_ar: 'بيكون مقرمش', price: 3 },
          { id: 'b2', name: 'بطاطا كبيرة', name_ar: 'بطاطا كبيرة', price: 4 },
          { id: 'b3', name: 'مشروب', name_ar: 'مشروب', price: 3 },
          { id: 'b4', name: 'صلصة خاصة', name_ar: 'صلصة خاصة', price: 0 },
        ],
        created_at: new Date().toISOString(),
      },
      {
        name: 'Crispy Chicken Burger',
        name_ar: 'برجر دجاج كريسبي',
        description: 'فيليه دجاج مقرمش مع مخلل الكول سلو والصلصة الخاصة',
        price: 16,
        image: '',
        emoji: '🍗',
        category: 'دجاج',
        available: true,
        addons: [
          { id: 'c1', name: 'إضافة جبنة', name_ar: 'إضافة جبنة', price: 2 },
          { id: 'c2', name: 'صلصة حارة', name_ar: 'صلصة حارة', price: 0 },
          { id: 'c3', name: 'بطاطا', name_ar: 'بطاطا', price: 4 },
        ],
        created_at: new Date().toISOString(),
      },
      {
        name: 'بطاطا مقلية',
        name_ar: 'بطاطا مقلية',
        description: 'بطاطا ذهبية مقرمشة مع صلصة الكاتشب',
        price: 6,
        image: '',
        emoji: '🍟',
        category: 'مقبلات',
        available: true,
        addons: [
          { id: 'd1', name: 'صلصة حارة', name_ar: 'صلصة حارة', price: 0 },
          { id: 'd2', name: 'جبنة مذابة', name_ar: 'جبنة مذابة', price: 2 },
        ],
        created_at: new Date().toISOString(),
      },
      {
        name: 'سندويش دجاج',
        name_ar: 'سندويش دجاج',
        description: 'دجاج مشوي أو مقلي مع الخضروات الطازجة في خبز طري',
        price: 12,
        image: '',
        emoji: '🥪',
        category: 'دجاج',
        available: true,
        addons: [
          { id: 'e1', name: 'إضافة أفوكادو', name_ar: 'إضافة أفوكادو', price: 3 },
          { id: 'e2', name: 'جبنة', name_ar: 'جبنة', price: 2 },
          { id: 'e3', name: 'بطاطا', name_ar: 'بطاطا', price: 4 },
        ],
        created_at: new Date().toISOString(),
      },
      {
        name: 'مشروب بارد',
        name_ar: 'مشروب بارد',
        description: 'كوكاكولا، سفن أب، فانتا - 500مل',
        price: 3,
        image: '',
        emoji: '🥤',
        category: 'مشروبات',
        available: true,
        addons: [],
        created_at: new Date().toISOString(),
      },
    ];

    for (const item of sampleItems) await q.insert(db.items, item);
    console.log('✅ Sample menu seeded!');
  }
}

seed().catch(console.error);
module.exports = { db, q };
