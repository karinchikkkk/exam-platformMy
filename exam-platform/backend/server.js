const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Подключение к MongoDB (исправленная версия)
mongoose.connect('mongodb://localhost:27017/testing_platform')
  .then(() => {
    console.log('✅ MongoDB подключена');
  })
  .catch((err) => {
    console.error('❌ Ошибка подключения к MongoDB:', err.message);
    console.log('⚠️ Работаем без MongoDB, тесты не будут сохраняться');
  });

// Схемы
const TestSchema = new mongoose.Schema({
  title: String,
  createdBy: String,
  timeLimit: Number,
  questions: [{
    text: String,
    options: [String],
    correctIndex: Number
  }],
  createdAt: { type: Date, default: Date.now }
});

const ResultSchema = new mongoose.Schema({
  testId: String,
  testTitle: String,
  studentName: String,
  score: Number,
  percentage: Number,
  violations: Number,
  answers: Object,
  totalQuestions: Number,
  completedAt: { type: Date, default: Date.now }
});

const Test = mongoose.model('Test', TestSchema);
const Result = mongoose.model('Result', ResultSchema);

// API endpoints
app.get('/api/tests', async (req, res) => {
  try {
    const tests = await Test.find().sort({ createdAt: -1 });
    res.json(tests);
  } catch (error) {
    console.error('Ошибка получения тестов:', error);
    res.status(500).json({ error: 'Ошибка получения тестов' });
  }
});

app.post('/api/tests', async (req, res) => {
  try {
    console.log('📝 Получен запрос на создание теста:', req.body.title);
    
    const { title, createdBy, timeLimit, questions } = req.body;
    
    if (!title || !createdBy || !timeLimit || !questions || questions.length === 0) {
      return res.status(400).json({ error: 'Не все поля заполнены' });
    }
    
    const test = new Test({
      title,
      createdBy,
      timeLimit,
      questions
    });
    
    await test.save();
    console.log('✅ Тест сохранен:', title);
    res.json(test);
  } catch (error) {
    console.error('❌ Ошибка сохранения теста:', error);
    res.status(500).json({ error: 'Ошибка сохранения теста: ' + error.message });
  }
});

app.post('/api/results', async (req, res) => {
  try {
    const result = new Result(req.body);
    await result.save();
    console.log('✅ Результат сохранен');
    res.json(result);
  } catch (error) {
    console.error('❌ Ошибка сохранения результата:', error);
    res.status(500).json({ error: 'Ошибка сохранения результата' });
  }
});

app.get('/api/results', async (req, res) => {
  try {
    const results = await Result.find().sort({ completedAt: -1 });
    res.json(results);
  } catch (error) {
    console.error('Ошибка получения результатов:', error);
    res.status(500).json({ error: 'Ошибка получения результатов' });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log('📝 Доступные эндпоинты:');
  console.log('   GET  /api/tests');
  console.log('   POST /api/tests');
  console.log('   GET  /api/results');
  console.log('   POST /api/results\n');
});