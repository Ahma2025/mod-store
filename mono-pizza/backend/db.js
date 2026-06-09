const Datastore = require('@seald-io/nedb');
const path = require('path');

const dbPath = path.join(__dirname, 'data');
require('fs').mkdirSync(dbPath, { recursive: true });

const menu = new Datastore({ filename: path.join(dbPath, 'menu.db'), autoload: true });
const orders = new Datastore({ filename: path.join(dbPath, 'orders.db'), autoload: true });

module.exports = { menu, orders };
