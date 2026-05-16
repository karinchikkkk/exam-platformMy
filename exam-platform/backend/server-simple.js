const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

// Разрешаем все запросы
app.use(cors());
app.use(express.json());

const TESTS_FILE = path.join(__dirname, 'tests.json');
const RESULTS_FILE = path.join(__dirname, 'results.json');

// Создаем файлы если их нет
if (!fs.existsSync(TESTS_FILE)) fs.writeFileSync(TESTS_FILE, '[]');
if (!fs.existsSync(RESULTS_FILE)) fs.writeFileSync(RESULTS_FILE, '[]');

// Маршруты
app.get('/api/tests', (req, res) => {
  const tests = JSON.parse(fs.readFileSync(TESTS_FILE));
  res.json(tests);
});

app.post('/api/tests', (req, res) => {
  console.log('✅ СОЗДАНИЕ ТЕСТА:', req.body.title);
  const tests = JSON.parse(fs.readFileSync(TESTS_FILE));
  const newTest = { ...req.body, _id: Date.now() };
  tests.push(newTest);
  fs.writeFileSync(TESTS_FILE, JSON.stringify(tests, null, 2));
  res.json(newTest);
});

app.post('/api/results', (req, res) => {
  const results = JSON.parse(fs.readFileSync(RESULTS_FILE));
  results.push(req.body);
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  res.json(req.body);
});

app.get('/api/results', (req, res) => {
  const results = JSON.parse(fs.readFileSync(RESULTS_FILE));
  res.json(results);
});

// Запуск
app.listen(5000, () => {
  console.log('\n========================================');
  console.log('✅ СЕРВЕР ЗАПУЩЕН!');
  console.log('🌐 Адрес: http://localhost:5000');
  console.log('========================================\n');
});