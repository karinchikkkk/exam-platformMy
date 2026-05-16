const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

const USERS_FILE = path.join(__dirname, 'users.json');
const TESTS_FILE = path.join(__dirname, 'tests.json');
const RESULTS_FILE = path.join(__dirname, 'results.json');

if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(TESTS_FILE)) fs.writeFileSync(TESTS_FILE, '[]');
if (!fs.existsSync(RESULTS_FILE)) fs.writeFileSync(RESULTS_FILE, '[]');

// Пользователи
app.get('/api/users', (req, res) => {
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    res.json(users);
});

app.post('/api/users', (req, res) => {
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    let user = users.find(u => u.fullName === req.body.fullName);
    
    if (!user) {
        user = { 
            ...req.body, 
            id: Date.now(), 
            registeredAt: new Date(),
            statistics: {
                totalTests: 0,
                averageScore: 0,
                bestScore: 0
            }
        };
        users.push(user);
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    }
    
    const { password, ...safeUser } = user;
    res.json(safeUser);
});

// Тесты
app.get('/api/tests', (req, res) => {
    const tests = JSON.parse(fs.readFileSync(TESTS_FILE));
    const { teacherId, studentId } = req.query;
    
    if (teacherId) {
        const teacherTests = tests.filter(t => t.teacherId == teacherId);
        res.json(teacherTests);
    } else if (studentId) {
        // Студент видит все тесты (можно потом добавить группы)
        res.json(tests);
    } else {
        res.json(tests);
    }
});

app.post('/api/tests', (req, res) => {
    const tests = JSON.parse(fs.readFileSync(TESTS_FILE));
    const newTest = { 
        ...req.body, 
        id: Date.now(),
        createdAt: new Date()
    };
    tests.push(newTest);
    fs.writeFileSync(TESTS_FILE, JSON.stringify(tests, null, 2));
    res.json(newTest);
});

// Результаты
app.get('/api/results', (req, res) => {
    const results = JSON.parse(fs.readFileSync(RESULTS_FILE));
    const { teacherId, studentId } = req.query;
    
    let filteredResults = [...results];
    
    if (teacherId) {
        const tests = JSON.parse(fs.readFileSync(TESTS_FILE));
        const teacherTestIds = tests.filter(t => t.teacherId == teacherId).map(t => t.id);
        filteredResults = filteredResults.filter(r => teacherTestIds.includes(r.testId));
    }
    
    if (studentId) {
        filteredResults = filteredResults.filter(r => r.studentId == studentId);
    }
    
    res.json(filteredResults);
});

app.post('/api/results', (req, res) => {
    const results = JSON.parse(fs.readFileSync(RESULTS_FILE));
    const newResult = { ...req.body, id: Date.now(), completedAt: new Date() };
    results.push(newResult);
    
    // Обновляем статистику студента
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    const student = users.find(u => u.id == newResult.studentId);
    if (student) {
        const studentResults = results.filter(r => r.studentId == newResult.studentId);
        const avgScore = studentResults.reduce((a, b) => a + b.percentage, 0) / studentResults.length;
        const bestScore = Math.max(...studentResults.map(r => r.percentage));
        
        student.statistics = {
            totalTests: studentResults.length,
            averageScore: Math.round(avgScore),
            bestScore: bestScore
        };
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    }
    
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    io.emit('new-result', newResult);
    res.json(newResult);
});

// Socket.IO
const activeSessions = new Map();

io.on('connection', (socket) => {
    console.log('✅ Клиент подключился:', socket.id);
    
    socket.on('start-test', (data) => {
        console.log(`📝 Начало теста: ${data.studentName}`);
        activeSessions.set(socket.id, {
            ...data,
            socketId: socket.id,
            violations: 0,
            startTime: Date.now()
        });
        io.emit('active-sessions', Array.from(activeSessions.values()));
        socket.emit('test-started', { status: 'ok' });
    });
    
    socket.on('violation', (data) => {
        const session = activeSessions.get(socket.id);
        if (session) {
            session.violations++;
            console.log(`⚠️ Нарушение у ${session.studentName}: ${data.type} (${session.violations}/3)`);
            socket.emit('violation-update', { count: session.violations });
            io.emit('violation-alert', {
                studentName: session.studentName,
                testTitle: session.testTitle,
                violations: session.violations
            });
            
            if (session.violations >= 3) {
                socket.emit('force-finish', { reason: 'Превышено количество нарушений (3)' });
                activeSessions.delete(socket.id);
            }
        }
    });
    
    socket.on('finish-test', (data) => {
        const session = activeSessions.get(socket.id);
        if (session) {
            console.log(`🏁 Тест завершен: ${session.studentName} - Результат: ${data.percentage}%`);
            activeSessions.delete(socket.id);
            io.emit('active-sessions', Array.from(activeSessions.values()));
        }
    });
    
    socket.on('disconnect', () => {
        const session = activeSessions.get(socket.id);
        if (session) {
            console.log(`❌ Тест прерван: ${session.studentName}`);
            activeSessions.delete(socket.id);
            io.emit('active-sessions', Array.from(activeSessions.values()));
        }
    });
});

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 СЕРВЕР ЗАПУЩЕН НА ПОРТУ ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`========================================\n`);
});

            

 