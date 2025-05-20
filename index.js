const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('./firebase');
const authMiddleware = require('./authMiddleware');

dotenv.config();

const app = express(); // Спочатку ініціалізуємо app

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Тимчасове сховище користувачів (без БД)
const users = {};

// Тестовий маршрут
app.get('/', (req, res) => {
  res.send('Сервер працює');
});

// Реєстрація
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;

  if (users[email]) {
    return res.status(400).json({ message: 'Користувач вже існує' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users[email] = { password: hashedPassword };

  res.status(201).json({ message: 'Користувача створено' });
});

// Логін
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const user = users[email];
  if (!user) return res.status(400).json({ message: 'Користувача не знайдено' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Неправильний пароль' });

  const token = jwt.sign({ uid: email }, process.env.JWT_SECRET, { expiresIn: '1h' });

  res.json({ token });
});

// Дані профілю
app.get('/api/profile', authMiddleware, (req, res) => {
  res.json({ user: req.user.uid });
});

// Отримання пройдених уроків
app.get('/api/progress', authMiddleware, async (req, res) => {
  try {
    const snapshot = await db.collection('users')
      .doc(req.user.uid)
      .collection('lessons')
      .orderBy('passedAt', 'desc')
      .get();

    const lessons = snapshot.docs.map(doc => doc.data());
    res.json(lessons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Збереження пройденого уроку
app.post('/api/progress', authMiddleware, async (req, res) => {
  const { lessonId, passedAt } = req.body;

  try {
    await db.collection('users')
      .doc(req.user.uid)
      .collection('lessons')
      .add({ lessonId, passedAt: new Date(passedAt) });

    res.status(201).json({ message: 'Урок збережено' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Запуск сервера
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Сервер запущено на порті ${PORT}`);
});
