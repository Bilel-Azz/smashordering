const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const db = new sqlite3.Database(':memory:');

// Utiliser le middleware CORS
app.use(cors());

app.use(bodyParser.json());

db.serialize(() => {
  db.run(`CREATE TABLE menus (id INTEGER PRIMARY KEY, name TEXT)`);
  db.run(`CREATE TABLE dishes (id INTEGER PRIMARY KEY, menu_id INTEGER, name TEXT, price REAL, FOREIGN KEY (menu_id) REFERENCES menus(id))`);
  db.run(`CREATE TABLE orders (id INTEGER PRIMARY KEY, details TEXT, total REAL, status TEXT)`);

  const menus = JSON.parse(fs.readFileSync('menus.json', 'utf-8'));
  menus.forEach(menu => {
    db.run(`INSERT INTO menus (name) VALUES (?)`, [menu.name], function(err) {
      if (err) console.error(err.message);
      else {
        const menuId = this.lastID;
        menu.dishes.forEach(dish => {
          db.run(`INSERT INTO dishes (menu_id, name, price) VALUES (?, ?, ?)`, [menuId, dish.name, dish.price], err => {
            if (err) console.error(err.message);
          });
        });
      }
    });
  });

  db.all(`SELECT * FROM menus`, [], (err, rows) => {
    if (err) console.error(err.message);
    else console.log('Menus:', rows);
  });

  db.all(`SELECT * FROM dishes`, [], (err, rows) => {
    if (err) console.error(err.message);
    else console.log('Dishes:', rows);
  });
});

app.get('/menus', (req, res) => {
  db.all(`SELECT menus.id as menu_id, menus.name as menu_name, dishes.id as dish_id, dishes.name as dish_name, dishes.price as dish_price
          FROM menus LEFT JOIN dishes ON menus.id = dishes.menu_id`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const menus = {};
    rows.forEach(row => {
      if (!menus[row.menu_id]) {
        menus[row.menu_id] = { id: row.menu_id, name: row.menu_name, dishes: [] };
      }
      if (row.dish_id) {
        menus[row.menu_id].dishes.push({ id: row.dish_id, name: row.dish_name, price: row.dish_price });
      }
    });
    console.log('Menus endpoint response:', Object.values(menus));
    res.json({ menus: Object.values(menus) });
  });
});

app.post('/create-order', (req, res) => {
    const { details, total } = req.body;
    console.log('Order details:', details); // Pour déboguer
    db.run(`INSERT INTO orders (details, total, status) VALUES (?, ?, 'pending')`, [JSON.stringify(details), total], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    });
  });
  

app.get('/orders', (req, res) => {
  db.all(`SELECT * FROM orders`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ orders: rows });
  });
});

app.put('/order/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Order updated' });
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
