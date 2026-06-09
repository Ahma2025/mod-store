const Datastore = require('@seald-io/nedb');
const path = require('path');

const dbPath = (name) => path.join(__dirname, 'data', `${name}.db`);

const fs = require('fs');
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

const db = {
  categories: new Datastore({ filename: dbPath('categories'), autoload: true }),
  items: new Datastore({ filename: dbPath('items'), autoload: true }),
  reservations: new Datastore({ filename: dbPath('reservations'), autoload: true }),
  contacts: new Datastore({ filename: dbPath('contacts'), autoload: true }),
};

// Promisify helpers
const findAll = (col, query = {}, sort = {}) =>
  new Promise((res, rej) => {
    let cursor = col.find(query);
    if (Object.keys(sort).length) cursor = cursor.sort(sort);
    cursor.exec((err, docs) => err ? rej(err) : res(docs));
  });

const insertOne = (col, doc) =>
  new Promise((res, rej) => col.insert(doc, (err, d) => err ? rej(err) : res(d)));

const countDocs = (col, query = {}) =>
  new Promise((res, rej) => col.count(query, (err, n) => err ? rej(err) : res(n)));

// ─── SEED ────────────────────────────────────────────────────
async function seed() {
  const catCount = await countDocs(db.categories);
  if (catCount > 0) return;

  const cats = await Promise.all([
    insertOne(db.categories, { name: 'Starters', name_ar: 'المقبلات', icon: '🥗', order: 1 }),
    insertOne(db.categories, { name: 'Main Course', name_ar: 'الأطباق الرئيسية', icon: '🍽️', order: 2 }),
    insertOne(db.categories, { name: 'Grills', name_ar: 'المشاوي', icon: '🔥', order: 3 }),
    insertOne(db.categories, { name: 'Desserts', name_ar: 'الحلويات', icon: '🍮', order: 4 }),
    insertOne(db.categories, { name: 'Drinks', name_ar: 'المشروبات', icon: '☕', order: 5 }),
  ]);

  const [starters, mains, grills, desserts, drinks] = cats;

  await Promise.all([
    // Starters
    insertOne(db.items, { category_id: starters._id, name: 'Hummus Platter', name_ar: 'طبق حمص', description: 'Creamy Lebanese hummus with olive oil & paprika', description_ar: 'حمص كريمي مع زيت الزيتون والبابريكا', price: 35, is_featured: true }),
    insertOne(db.items, { category_id: starters._id, name: 'Fattoush Salad', name_ar: 'سلطة فتوش', description: 'Fresh vegetables with sumac dressing & crispy bread', description_ar: 'خضروات طازجة مع تتبيلة السماق', price: 40, is_featured: false }),
    insertOne(db.items, { category_id: starters._id, name: 'Warak Dawali', name_ar: 'ورق دوالي', description: 'Vine leaves stuffed with rice & herbs', description_ar: 'ورق عنب محشو بالأرز والأعشاب', price: 45, is_featured: true }),
    insertOne(db.items, { category_id: starters._id, name: 'Kibbeh', name_ar: 'كبة', description: 'Crispy bulgur shells filled with spiced meat', description_ar: 'كبة مقلية بحشوة اللحم المتبل', price: 50, is_featured: false }),
    // Mains
    insertOne(db.items, { category_id: mains._id, name: 'Mansaf', name_ar: 'منسف', description: 'Traditional lamb with jameed sauce over rice', description_ar: 'لحم خروف تقليدي مع صلصة الجميد والأرز', price: 120, is_featured: true }),
    insertOne(db.items, { category_id: mains._id, name: 'Maqluba', name_ar: 'مقلوبة', description: 'Upside-down rice with chicken & vegetables', description_ar: 'مقلوبة دجاج مع الخضروات والأرز', price: 95, is_featured: true }),
    insertOne(db.items, { category_id: mains._id, name: 'Musakhan', name_ar: 'مسخن', description: 'Roasted chicken with caramelized onions & sumac', description_ar: 'دجاج محمر مع البصل المكرمل والسماق', price: 85, is_featured: true }),
    insertOne(db.items, { category_id: mains._id, name: 'Stuffed Lamb', name_ar: 'خروف محشي', description: 'Whole roasted lamb stuffed with rice & nuts', description_ar: 'خروف محمص كامل محشو بالأرز والمكسرات', price: 250, is_featured: false }),
    // Grills
    insertOne(db.items, { category_id: grills._id, name: 'Mixed Grill', name_ar: 'مشاوي مشكلة', description: 'Kofta, shish tawook & lamb chops', description_ar: 'تشكيلة من الكفتة والشيش طاووق وضلوع الخروف', price: 130, is_featured: true }),
    insertOne(db.items, { category_id: grills._id, name: 'Lamb Kofta', name_ar: 'كفتة خروف', description: 'Chargrilled minced lamb with spices', description_ar: 'كفتة خروف مشوية على الفحم', price: 90, is_featured: false }),
    insertOne(db.items, { category_id: grills._id, name: 'Shish Tawook', name_ar: 'شيش طاووق', description: 'Marinated chicken skewers with garlic sauce', description_ar: 'أسياخ دجاج متبلة مع صلصة الثوم', price: 80, is_featured: false }),
    // Desserts
    insertOne(db.items, { category_id: desserts._id, name: 'Kunafa', name_ar: 'كنافة', description: 'Classic Palestinian cheese pastry with rose syrup', description_ar: 'كنافة فلسطينية أصيلة مع شراب الورد', price: 45, is_featured: true }),
    insertOne(db.items, { category_id: desserts._id, name: 'Qatayef', name_ar: 'قطايف', description: 'Stuffed pancakes with cream & pistachios', description_ar: 'قطايف محشوة بالقشطة والفستق', price: 40, is_featured: false }),
    insertOne(db.items, { category_id: desserts._id, name: 'Baklawa', name_ar: 'بقلاوة', description: 'Layered pastry with honey & mixed nuts', description_ar: 'بقلاوة بالعسل والمكسرات', price: 50, is_featured: true }),
    // Drinks
    insertOne(db.items, { category_id: drinks._id, name: 'Arabic Coffee', name_ar: 'قهوة عربية', description: 'Traditional cardamom coffee with dates', description_ar: 'قهوة عربية بالهيل مع التمر', price: 20, is_featured: true }),
    insertOne(db.items, { category_id: drinks._id, name: 'Mint Lemonade', name_ar: 'ليمون بالنعنع', description: 'Fresh squeezed lemonade with mint leaves', description_ar: 'ليمون طازج مع أوراق النعنع', price: 25, is_featured: false }),
    insertOne(db.items, { category_id: drinks._id, name: 'Tamarind Juice', name_ar: 'عصير تمر هندي', description: 'Traditional chilled tamarind drink', description_ar: 'مشروب التمر الهندي المثلج التقليدي', price: 22, is_featured: false }),
  ]);

  console.log('✅ Database seeded successfully!');
}

seed().catch(console.error);

module.exports = { db, findAll, insertOne, countDocs };
