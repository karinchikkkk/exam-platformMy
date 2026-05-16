import { useState, useEffect, useRef } from 'react';
import { BookOpen, PlusCircle, List, Clock, Users, BarChart3, X, CheckCircle, AlertCircle, Shield, TrendingUp, Award, Zap, Moon, Sun } from 'lucide-react';
import io from 'socket.io-client';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState('');
  const [fullName, setFullName] = useState('');
  const [teacherCode, setTeacherCode] = useState('');
  const [currentPage, setCurrentPage] = useState('home');
  const [currentUser, setCurrentUser] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [violations, setViolations] = useState(0);
  const [results, setResults] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [multipleAnswers, setMultipleAnswers] = useState({});

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTest, setNewTest] = useState({ 
    title: '', 
    timeLimit: 30, 
    questions: [], 
    randomOrder: false
  });
  const [currentQuestion, setCurrentQuestion] = useState({ 
    text: '', 
    type: 'single',
    options: ['', '', '', ''], 
    correctIndex: 0,
    correctAnswers: [],
    correctAnswer: '',
    points: 1
  });

  const socketRef = useRef(null);
  const isTestActive = useRef(false);

  // Типы вопросов
  const questionTypes = {
    single: { name: 'Одиночный выбор', icon: '🔘' },
    multiple: { name: 'Множественный выбор', icon: '☑️' },
    text: { name: 'Текстовый ответ', icon: '📝' },
    number: { name: 'Числовой ответ', icon: '🔢' }
  };

  // Подключение к Socket.IO
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    socketRef.current.on('violation-update', (data) => setViolations(data.count));
    socketRef.current.on('force-finish', (data) => {
      alert(`❌ ТЕСТ ПРЕРВАН! ${data.reason}`);
      forceFinishTest();
    });
    socketRef.current.on('active-sessions', (sessions) => setActiveSessions(sessions));
    socketRef.current.on('violation-alert', (data) => {
      if (role === 'teacher') {
        alert(`⚠️ ${data.studentName} нарушил правила (${data.violations}/3)`);
      }
    });
    return () => socketRef.current?.disconnect();
  }, [role]);

  // Загрузка данных
  useEffect(() => {
    const saved = localStorage.getItem('loggedIn');
    if (saved === 'true') {
      const userId = localStorage.getItem('userId');
      const userRole = localStorage.getItem('role');
      const userName = localStorage.getItem('fullName');
      
      setCurrentUser({ id: userId, role: userRole, fullName: userName });
      setIsLoggedIn(true);
      setRole(userRole);
      setFullName(userName);
      
      loadData(userId, userRole);
    }
  }, []);

  const loadData = async (userId, userRole) => {
    try {
      const usersRes = await fetch('http://localhost:5000/api/users');
      const allUsers = await usersRes.json();
      setUsers(allUsers);
      
      if (userRole === 'teacher') {
        const testsRes = await fetch(`http://localhost:5000/api/tests?teacherId=${userId}`);
        setTests(await testsRes.json());
        const resultsRes = await fetch(`http://localhost:5000/api/results?teacherId=${userId}`);
        setResults(await resultsRes.json());
      } else {
        const testsRes = await fetch(`http://localhost:5000/api/tests?studentId=${userId}`);
        setTests(await testsRes.json());
        const resultsRes = await fetch(`http://localhost:5000/api/results?studentId=${userId}`);
        setResults(await resultsRes.json());
      }
    } catch (error) {
      console.log('Ошибка загрузки:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!fullName.trim()) { alert("Введите ФИО!"); return; }
    if (!role) { alert("Выберите роль!"); return; }
    if (role === 'teacher' && teacherCode !== '1234') {
      alert("Неверный код педагога! Код: 1234");
      return;
    }
    
    try {
      const res = await fetch('http://localhost:5000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, role })
      });
      const user = await res.json();
      
      localStorage.setItem('loggedIn', 'true');
      localStorage.setItem('userId', user.id);
      localStorage.setItem('role', role);
      localStorage.setItem('fullName', fullName);
      
      setCurrentUser(user);
      setIsLoggedIn(true);
      setRole(role);
      setFullName(fullName);
      
      await loadData(user.id, role);
    } catch (error) {
      alert('Ошибка при входе: ' + error.message);
    }
  };

  const logout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentPage('home');
  };

  // Сохранение теста
  const saveTest = async () => {
    if (!newTest.title.trim()) { alert("Введите название!"); return; }
    if (newTest.questions.length === 0) { alert("Добавьте вопросы!"); return; }
    
    const testData = {
      title: newTest.title,
      createdBy: fullName,
      teacherId: currentUser.id,
      timeLimit: newTest.timeLimit,
      questions: newTest.questions,
      randomOrder: newTest.randomOrder
    };
    
    try {
      const res = await fetch('http://localhost:5000/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });
      const saved = await res.json();
      setTests([...tests, saved]);
      setShowCreateModal(false);
      setNewTest({ title: '', timeLimit: 30, questions: [], randomOrder: false });
      alert("✅ Тест сохранен!");
    } catch (error) {
      alert("Ошибка: " + error.message);
    }
  };

  // Добавление вопроса
  const addQuestion = () => {
    if (!currentQuestion.text.trim()) { alert("Введите текст вопроса!"); return; }
    
    if (currentQuestion.type === 'single') {
      if (currentQuestion.options.some(o => !o.trim())) { alert("Заполните все варианты!"); return; }
      if (currentQuestion.correctIndex === undefined) { alert("Выберите правильный ответ!"); return; }
    }
    
    if (currentQuestion.type === 'multiple') {
      if (currentQuestion.options.some(o => !o.trim())) { alert("Заполните все варианты!"); return; }
      if (currentQuestion.correctAnswers.length === 0) { alert("Выберите правильные ответы!"); return; }
    }
    
    if ((currentQuestion.type === 'text' || currentQuestion.type === 'number') && !currentQuestion.correctAnswer) {
      alert("Введите правильный ответ!");
      return;
    }
    
    setNewTest(prev => ({
      ...prev,
      questions: [...prev.questions, { ...currentQuestion }]
    }));
    
    setCurrentQuestion({ 
      text: '', 
      type: 'single',
      options: ['', '', '', ''], 
      correctIndex: 0,
      correctAnswers: [],
      correctAnswer: '',
      points: 1
    });
    
    alert(`✅ Вопрос добавлен! Всего: ${newTest.questions.length + 1}`);
  };

  // Начало теста с перемешиванием
  const startTest = (test) => {
    let questionsToUse = [...test.questions];
    if (test.randomOrder) {
      questionsToUse = shuffleArray(questionsToUse);
    }
    
    setSelectedTest({ ...test, questions: questionsToUse });
    setCurrentQuestionIndex(0);
    setAnswers({});
    setMultipleAnswers({});
    setTimeLeft(test.timeLimit * 60);
    setViolations(0);
    setCurrentPage('takingTest');
    isTestActive.current = true;
    
    socketRef.current?.emit('start-test', {
      studentName: fullName,
      testId: test.id,
      testTitle: test.title
    });
    
    activateProtection();
  };

  const shuffleArray = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const activateProtection = () => {
    const handleVisibilityChange = () => {
      if (document.hidden && isTestActive.current) {
        setViolations(prev => prev + 1);
        socketRef.current?.emit('violation', { type: 'tab_switch' });
        alert(`⚠️ Нарушение! Не переключайте вкладки!`);
      }
    };
    
    const handleCopy = (e) => {
      if (isTestActive.current) {
        e.preventDefault();
        setViolations(prev => prev + 1);
        socketRef.current?.emit('violation', { type: 'copy' });
        alert(`⚠️ Копирование запрещено!`);
        return false;
      }
    };
    
    const handleContextMenu = (e) => {
      if (isTestActive.current) {
        e.preventDefault();
        setViolations(prev => prev + 1);
        socketRef.current?.emit('violation', { type: 'contextmenu' });
        alert(`⚠️ Правая кнопка мыши заблокирована!`);
        return false;
      }
    };
    
    const handleKeyDown = (e) => {
      if (!isTestActive.current) return;
      if (e.key === 'F12' || (e.ctrlKey && (e.key === 'c' || e.key === 'C'))) {
        e.preventDefault();
        setViolations(prev => prev + 1);
        socketRef.current?.emit('violation', { type: 'hotkey' });
        alert(`⚠️ Горячие клавиши заблокированы!`);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    
    window._handlers = { handleVisibilityChange, handleCopy, handleContextMenu, handleKeyDown };
  };
  
  const deactivateProtection = () => {
    isTestActive.current = false;
    if (window._handlers) {
      document.removeEventListener('visibilitychange', window._handlers.handleVisibilityChange);
      document.removeEventListener('copy', window._handlers.handleCopy);
      document.removeEventListener('contextmenu', window._handlers.handleContextMenu);
      document.removeEventListener('keydown', window._handlers.handleKeyDown);
    }
  };

  const forceFinishTest = () => {
    deactivateProtection();
    setCurrentPage('home');
    setSelectedTest(null);
  };

  useEffect(() => {
    if (currentPage !== 'takingTest' || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          finishTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, currentPage]);

  const finishTest = async () => {
    deactivateProtection();
    if (!selectedTest) return;
    
    let totalPoints = 0;
    let earnedPoints = 0;
    
    selectedTest.questions.forEach((q, i) => {
      const maxPoints = q.points || 1;
      totalPoints += maxPoints;
      
      let isCorrect = false;
      if (q.type === 'single') {
        isCorrect = answers[i] === q.correctIndex;
      } else if (q.type === 'multiple') {
        const userAnswers = multipleAnswers[i] || [];
        const correctAnswers = q.correctAnswers || [];
        isCorrect = userAnswers.length === correctAnswers.length && 
                    userAnswers.every(a => correctAnswers.includes(a));
      } else if (q.type === 'text' || q.type === 'number') {
        isCorrect = String(answers[i] || '').toLowerCase().trim() === String(q.correctAnswer || '').toLowerCase().trim();
      }
      
      if (isCorrect) earnedPoints += maxPoints;
    });
    
    const percentage = Math.round((earnedPoints / totalPoints) * 100);
    
    const resultData = {
      studentId: currentUser.id,
      studentName: fullName,
      testId: selectedTest.id,
      testTitle: selectedTest.title,
      teacherId: selectedTest.teacherId,
      score: earnedPoints,
      totalPoints: totalPoints,
      percentage: percentage,
      violations: violations
    };
    
    try {
      await fetch('http://localhost:5000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultData)
      });
      socketRef.current?.emit('finish-test', { percentage });
      alert(`🎯 Тест завершён!\nРезультат: ${percentage}%\nБаллы: ${earnedPoints}/${totalPoints}\nНарушений: ${violations}`);
      setCurrentPage('home');
      setSelectedTest(null);
      await loadData(currentUser.id, role);
    } catch (error) {
      alert('Ошибка: ' + error.message);
    }
  };

  const handleSingleAnswer = (questionIndex, answerIndex) => {
    setAnswers(prev => ({ ...prev, [questionIndex]: answerIndex }));
  };

  const handleMultipleAnswer = (questionIndex, answerIndex) => {
    setMultipleAnswers(prev => {
      const current = prev[questionIndex] || [];
      const newAnswers = current.includes(answerIndex)
        ? current.filter(a => a !== answerIndex)
        : [...current, answerIndex];
      return { ...prev, [questionIndex]: newAnswers };
    });
  };

  const handleTextAnswer = (questionIndex, value) => {
    setAnswers(prev => ({ ...prev, [questionIndex]: value }));
  };

  const nextQuestion = () => {
    const currentQ = selectedTest.questions[currentQuestionIndex];
    
    if (currentQ.type === 'single' && answers[currentQuestionIndex] === undefined) {
      alert("Выберите ответ!");
      return;
    }
    if (currentQ.type === 'multiple' && (!multipleAnswers[currentQuestionIndex] || multipleAnswers[currentQuestionIndex].length === 0)) {
      alert("Выберите хотя бы один ответ!");
      return;
    }
    if ((currentQ.type === 'text' || currentQ.type === 'number') && !answers[currentQuestionIndex]) {
      alert("Введите ответ!");
      return;
    }
    
    if (currentQuestionIndex < selectedTest.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      finishTest();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Статистика для студента
  const StudentStats = () => {
    const myResults = results.filter(r => r.studentId === currentUser?.id);
    if (myResults.length === 0) return null;
    
    const avgScore = myResults.reduce((a, b) => a + b.percentage, 0) / myResults.length;
    const bestScore = Math.max(...myResults.map(r => r.percentage));
    const totalTests = myResults.length;
    
    return (
      <div style={{ marginTop: '30px' }}>
        <h3><TrendingUp size={20} style={{ display: 'inline', marginRight: '10px' }} />Моя статистика</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px' }}>
          <div style={{ background: '#e3f2fd', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            <Award size={30} />
            <h4>Средний балл</h4>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{Math.round(avgScore)}%</div>
          </div>
          <div style={{ background: '#e8f5e9', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            <Zap size={30} />
            <h4>Лучший результат</h4>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{bestScore}%</div>
          </div>
          <div style={{ background: '#fff3e0', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            <BookOpen size={30} />
            <h4>Пройдено тестов</h4>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{totalTests}</div>
          </div>
        </div>
        <div style={{ marginTop: '20px' }}>
          <h4>Последние результаты:</h4>
          {myResults.slice(-5).reverse().map((r, i) => (
            <div key={i} style={{ background: '#f5f5f5', padding: '10px', margin: '5px 0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>{r.testTitle}</span>
              <span style={{ fontWeight: 'bold', color: r.percentage >= 70 ? '#28a745' : '#ff4444' }}>{r.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Рендер вопроса
  const renderQuestion = () => {
    const q = selectedTest.questions[currentQuestionIndex];
    
    if (q.type === 'single') {
      return q.options.map((opt, idx) => (
        <label key={idx} style={{ display: 'block', padding: '12px', margin: '10px 0', background: answers[currentQuestionIndex] === idx ? '#e3f2fd' : '#f5f5f5', borderRadius: '8px', cursor: 'pointer' }}>
          <input type="radio" name="answer" checked={answers[currentQuestionIndex] === idx} onChange={() => handleSingleAnswer(currentQuestionIndex, idx)} style={{ marginRight: '10px' }} />
          {opt}
        </label>
      ));
    }
    
    if (q.type === 'multiple') {
      return q.options.map((opt, idx) => (
        <label key={idx} style={{ display: 'block', padding: '12px', margin: '10px 0', background: multipleAnswers[currentQuestionIndex]?.includes(idx) ? '#e3f2fd' : '#f5f5f5', borderRadius: '8px', cursor: 'pointer' }}>
          <input type="checkbox" checked={multipleAnswers[currentQuestionIndex]?.includes(idx) || false} onChange={() => handleMultipleAnswer(currentQuestionIndex, idx)} style={{ marginRight: '10px' }} />
          {opt}
        </label>
      ));
    }
    
    if (q.type === 'text' || q.type === 'number') {
      return (
        <input 
          type={q.type === 'number' ? 'number' : 'text'}
          placeholder="Введите ваш ответ..."
          value={answers[currentQuestionIndex] || ''}
          onChange={(e) => handleTextAnswer(currentQuestionIndex, e.target.value)}
          style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '16px' }}
        />
      );
    }
    
    return null;
  };

  const themeStyles = darkMode ? {
    backgroundColor: '#1a1a2e',
    color: '#eee',
    cardBackground: '#16213e',
    borderColor: '#0f3460'
  } : {
    backgroundColor: '#f8f9fa',
    color: '#333',
    cardBackground: 'white',
    borderColor: '#ddd'
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: themeStyles.backgroundColor, color: themeStyles.color, transition: 'all 0.3s' }}>
      <header style={{ backgroundColor: '#c8102e', color: 'white', padding: '20px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0 }}>Платформа тестирования</h1>
            <p style={{ margin: 0, opacity: 0.9 }}>РАНХиГС | Полная защита</p>
          </div>
          <div>
            <button onClick={() => setDarkMode(!darkMode)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '8px 12px', marginRight: '15px', cursor: 'pointer', color: 'white' }}>
              {darkMode ? '🌞' : '🌙'}
            </button>
            {isLoggedIn && (
              <>
                <span style={{ marginRight: '15px' }}>{fullName} ({role === 'teacher' ? 'Педагог' : 'Студент'})</span>
                <button onClick={logout} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>Выход</button>
              </>
            )}
          </div>
        </div>
      </header>

      {!isLoggedIn ? (
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: themeStyles.cardBackground, padding: '40px', borderRadius: '20px', maxWidth: '440px', width: '100%' }}>
            <h2 style={{ textAlign: 'center' }}>Вход в систему</h2>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input type="text" placeholder="ФИО" value={fullName} onChange={e => setFullName(e.target.value)} style={{ padding: '15px', borderRadius: '10px', border: '2px solid #ddd', background: themeStyles.cardBackground }} required />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setRole('student')} style={{ flex: 1, padding: '15px', border: role === 'student' ? '3px solid #c8102e' : '2px solid #ddd', borderRadius: '10px', cursor: 'pointer', background: themeStyles.cardBackground }}>🧑‍🎓 Студент</button>
                <button type="button" onClick={() => setRole('teacher')} style={{ flex: 1, padding: '15px', border: role === 'teacher' ? '3px solid #c8102e' : '2px solid #ddd', borderRadius: '10px', cursor: 'pointer', background: themeStyles.cardBackground }}>👨‍🏫 Педагог</button>
              </div>
              {role === 'teacher' && (
                <input type="password" placeholder="Код педагога (1234)" value={teacherCode} onChange={e => setTeacherCode(e.target.value)} style={{ padding: '15px', borderRadius: '10px', border: '2px solid #ddd', background: themeStyles.cardBackground }} />
              )}
              <button type="submit" style={{ padding: '16px', background: '#c8102e', color: 'white', border: 'none', borderRadius: '10px', fontSize: '18px', cursor: 'pointer' }}>Войти</button>
            </form>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 30px' }}>
          {currentPage === 'home' && (
            <div>
              <h2>Добро пожаловать, {fullName.split(' ')[0]}!</h2>
              
              {role === 'student' && <StudentStats />}
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '30px' }}>
                {role === 'teacher' && (
                  <>
                    <button onClick={() => setShowCreateModal(true)} style={{ padding: '40px', background: themeStyles.cardBackground, borderRadius: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                      <PlusCircle size={50} style={{ color: '#c8102e' }} />
                      <h3>Создать тест</h3>
                      <p style={{ color: '#666' }}>С разными типами вопросов</p>
                    </button>
                    <button onClick={() => { setCurrentPage('tests'); loadData(currentUser.id, role); }} style={{ padding: '40px', background: themeStyles.cardBackground, borderRadius: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                      <List size={50} style={{ color: '#c8102e' }} />
                      <h3>Мои тесты</h3>
                      <p style={{ color: '#666' }}>Всего: {tests.length}</p>
                    </button>
                    <button onClick={() => { setCurrentPage('results'); loadData(currentUser.id, role); }} style={{ padding: '40px', background: themeStyles.cardBackground, borderRadius: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                      <BarChart3 size={50} style={{ color: '#c8102e' }} />
                      <h3>Результаты</h3>
                      <p style={{ color: '#666' }}>Всего: {results.length}</p>
                    </button>
                    <button onClick={() => { setCurrentPage('users'); loadData(currentUser.id, role); }} style={{ padding: '40px', background: themeStyles.cardBackground, borderRadius: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                      <Users size={50} style={{ color: '#c8102e' }} />
                      <h3>Пользователи</h3>
                      <p style={{ color: '#666' }}>Список студентов</p>
                    </button>
                  </>
                )}
                
                {role === 'student' && (
                  <button onClick={() => { setCurrentPage('tests'); loadData(currentUser.id, role); }} style={{ padding: '40px', background: themeStyles.cardBackground, borderRadius: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                    <BookOpen size={50} style={{ color: '#c8102e' }} />
                    <h3>Доступные тесты</h3>
                    <p style={{ color: '#666' }}>Доступно: {tests.length}</p>
                  </button>
                )}
              </div>
              
              {activeSessions.length > 0 && role === 'teacher' && (
                <div style={{ marginTop: '30px', background: '#fff3cd', padding: '15px', borderRadius: '10px' }}>
                  <h4>🟢 Активные сессии ({activeSessions.length})</h4>
                  {activeSessions.map(s => (
                    <div key={s.socketId} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                      <span>{s.studentName}</span>
                      <span>{s.testTitle}</span>
                      <span>Нарушений: {s.violations}/3</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentPage === 'tests' && (
            <div>
              <button onClick={() => setCurrentPage('home')} style={{ marginBottom: '20px', cursor: 'pointer' }}>← Назад</button>
              <h2>{role === 'student' ? 'Доступные тесты' : 'Мои тесты'}</h2>
              {tests.length === 0 && <p>Нет тестов</p>}
              {tests.map(test => (
                <div key={test.id} style={{ background: themeStyles.cardBackground, padding: '20px', margin: '10px 0', borderRadius: '10px' }}>
                  <h3>{test.title}</h3>
                  <p>Автор: {test.createdBy} | Время: {test.timeLimit} мин | Вопросов: {test.questions.length}</p>
                  {test.randomOrder && <span style={{ background: '#e3f2fd', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>🔀 Перемешанный порядок</span>}
                  <p style={{ fontSize: '12px', marginTop: '5px' }}>
                    Типы вопросов: {[...new Set(test.questions.map(q => questionTypes[q.type]?.name))].join(', ')}
                  </p>
                  {role === 'student' && <button onClick={() => startTest(test)} style={{ background: '#c8102e', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '10px' }}>Начать тест 🛡️</button>}
                </div>
              ))}
            </div>
          )}

          {currentPage === 'results' && role === 'teacher' && (
            <div>
              <button onClick={() => setCurrentPage('home')} style={{ marginBottom: '20px', cursor: 'pointer' }}>← Назад</button>
              <h2>Результаты студентов</h2>
              <table style={{ width: '100%', background: themeStyles.cardBackground, borderRadius: '10px', overflow: 'hidden' }}>
                <thead style={{ background: '#c8102e', color: 'white' }}>
                  <tr><th>Студент</th><th>Тест</th><th>Результат</th><th>Баллы</th><th>Нарушения</th><th>Дата</th></tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '10px' }}>{r.studentName}</td>
                      <td>{r.testTitle}</td>
                      <td><span style={{ background: r.percentage >= 70 ? '#d4edda' : r.percentage >= 50 ? '#fff3cd' : '#f8d7da', padding: '5px 10px', borderRadius: '20px' }}>{r.percentage}%</span></td>
                      <td>{r.score}/{r.totalPoints || r.totalQuestions}</td>
                      <td>{r.violations || 0}</td>
                      <td>{new Date(r.completedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {currentPage === 'users' && role === 'teacher' && (
            <div>
              <button onClick={() => setCurrentPage('home')} style={{ marginBottom: '20px', cursor: 'pointer' }}>← Назад</button>
              <h2>Зарегистрированные студенты</h2>
              <table style={{ width: '100%', background: themeStyles.cardBackground, borderRadius: '10px', overflow: 'hidden' }}>
                <thead style={{ background: '#c8102e', color: 'white' }}>
                  <tr><th>ФИО</th><th>Роль</th><th>Пройдено тестов</th><th>Средний балл</th><th>Дата регистрации</th></tr>
                </thead>
                <tbody>
                  {users.filter(u => u.role === 'student').map((u, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '10px' }}>{u.fullName}</td>
                      <td>🧑‍🎓 Студент</td>
                      <td>{u.statistics?.totalTests || 0}</td>
                      <td>{u.statistics?.averageScore || 0}%</td>
                      <td>{new Date(u.registeredAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Модальное окно создания теста */}
          {showCreateModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflow: 'auto' }}>
              <div style={{ background: themeStyles.cardBackground, padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }}>
                <h2>Создание теста</h2>
                <input type="text" placeholder="Название" value={newTest.title} onChange={e => setNewTest({...newTest, title: e.target.value})} style={{ width: '100%', padding: '10px', margin: '10px 0', borderRadius: '8px', border: '2px solid #ddd', background: themeStyles.cardBackground }} />
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label>Общее время (мин):</label>
                    <input type="number" value={newTest.timeLimit} onChange={e => setNewTest({...newTest, timeLimit: +e.target.value})} style={{ width: '100%', padding: '10px', margin: '10px 0', borderRadius: '8px', border: '2px solid #ddd', background: themeStyles.cardBackground }} />
                  </div>
                </div>
                
                <label style={{ display: 'flex', alignItems: 'center', margin: '10px 0' }}>
                  <input type="checkbox" checked={newTest.randomOrder} onChange={e => setNewTest({...newTest, randomOrder: e.target.checked})} style={{ marginRight: '10px' }} />
                  🔀 Перемешать вопросы случайным образом
                </label>
                
                <h3>Вопросы ({newTest.questions.length}/50)</h3>
                
                <div style={{ background: themeStyles.cardBackground, padding: '15px', borderRadius: '10px', margin: '15px 0', border: '1px solid #ddd' }}>
                  <h4>Добавить вопрос</h4>
                  
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <select value={currentQuestion.type} onChange={e => setCurrentQuestion({...currentQuestion, type: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '2px solid #ddd', background: themeStyles.cardBackground, flex: 1 }}>
                      {Object.entries(questionTypes).map(([key, val]) => (
                        <option key={key} value={key}>{val.icon} {val.name}</option>
                      ))}
                    </select>
                    <input type="number" placeholder="Баллы" value={currentQuestion.points} onChange={e => setCurrentQuestion({...currentQuestion, points: +e.target.value})} style={{ width: '80px', padding: '10px', borderRadius: '8px', border: '2px solid #ddd', background: themeStyles.cardBackground }} />
                  </div>
                  
                  <textarea placeholder="Текст вопроса" value={currentQuestion.text} onChange={e => setCurrentQuestion({...currentQuestion, text: e.target.value})} style={{ width: '100%', padding: '10px', margin: '10px 0', minHeight: '80px', borderRadius: '8px', border: '2px solid #ddd', background: themeStyles.cardBackground }} />
                  
                  {currentQuestion.type === 'single' && (
                    <>
                      {currentQuestion.options.map((opt, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px', margin: '5px 0' }}>
                          <input placeholder={`Вариант ${i+1}`} value={opt} onChange={e => {
                            const opts = [...currentQuestion.options];
                            opts[i] = e.target.value;
                            setCurrentQuestion({...currentQuestion, options: opts});
                          }} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid #ddd', background: themeStyles.cardBackground }} />
                          <button onClick={() => setCurrentQuestion({...currentQuestion, correctIndex: i})} style={{ background: currentQuestion.correctIndex === i ? '#28a745' : '#ddd', padding: '10px 15px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                            {currentQuestion.correctIndex === i ? '✓ Правильный' : 'Выбрать'}
                          </button>
                        </div>
                      ))}
                      <button onClick={() => setCurrentQuestion({...currentQuestion, options: [...currentQuestion.options, '']})} style={{ margin: '5px 0', padding: '5px 10px', background: '#c8102e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>+ Добавить вариант</button>
                    </>
                  )}
                  
                  {currentQuestion.type === 'multiple' && (
                    <>
                      {currentQuestion.options.map((opt, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px', margin: '5px 0' }}>
                          <input placeholder={`Вариант ${i+1}`} value={opt} onChange={e => {
                            const opts = [...currentQuestion.options];
                            opts[i] = e.target.value;
                            setCurrentQuestion({...currentQuestion, options: opts});
                          }} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid #ddd', background: themeStyles.cardBackground }} />
                          <button onClick={() => {
                            const current = currentQuestion.correctAnswers || [];
                            const newCorrect = current.includes(i) ? current.filter(a => a !== i) : [...current, i];
                            setCurrentQuestion({...currentQuestion, correctAnswers: newCorrect});
                          }} style={{ background: currentQuestion.correctAnswers?.includes(i) ? '#28a745' : '#ddd', padding: '10px 15px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                            {currentQuestion.correctAnswers?.includes(i) ? '✓' : 'Выбрать'}
                          </button>
                        </div>
                      ))}
                      <button onClick={() => setCurrentQuestion({...currentQuestion, options: [...currentQuestion.options, '']})} style={{ margin: '5px 0', padding: '5px 10px', background: '#c8102e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>+ Добавить вариант</button>
                    </>
                  )}
                  
                  {(currentQuestion.type === 'text' || currentQuestion.type === 'number') && (
                    <div>
                      <label>Правильный ответ:</label>
                      <input type={currentQuestion.type === 'number' ? 'number' : 'text'} placeholder="Правильный ответ" value={currentQuestion.correctAnswer || ''} onChange={e => setCurrentQuestion({...currentQuestion, correctAnswer: e.target.value})} style={{ width: '100%', padding: '10px', margin: '10px 0', borderRadius: '8px', border: '2px solid #ddd', background: themeStyles.cardBackground }} />
                    </div>
                  )}
                  
                  <button onClick={addQuestion} style={{ margin: '10px 0', padding: '10px 20px', background: '#c8102e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>➕ Добавить вопрос</button>
                </div>
                
                {newTest.questions.length > 0 && (
                  <div style={{ marginTop: '20px', padding: '15px', background: themeStyles.cardBackground, borderRadius: '10px', border: '1px solid #ddd' }}>
                    <strong>Добавлено вопросов: {newTest.questions.length}</strong>
                    {newTest.questions.map((q, i) => (
                      <div key={i} style={{ padding: '5px', borderBottom: '1px solid #ddd' }}>
                        {i+1}. {q.text.substring(0, 50)}... [{questionTypes[q.type]?.icon} {q.points} баллов]
                      </div>
                    ))}
                  </div>
                )}
                
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                  <button onClick={saveTest} style={{ flex: 1, padding: '12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>💾 Сохранить тест</button>
                  <button onClick={() => setShowCreateModal(false)} style={{ flex: 1, padding: '12px', background: '#666', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Отмена</button>
                </div>
              </div>
            </div>
          )}

          {/* Прохождение теста */}
          {currentPage === 'takingTest' && selectedTest && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: themeStyles.backgroundColor, zIndex: 1000, overflow: 'auto' }}>
              <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
                <div style={{ background: themeStyles.cardBackground, borderRadius: '20px', padding: '30px' }}>
                  <div style={{ background: violations >= 2 ? '#ffebee' : '#e8f5e9', padding: '15px', borderRadius: '10px', marginBottom: '20px', textAlign: 'center' }}>
                    <Shield size={24} style={{ display: 'inline', marginRight: '10px' }} />
                    🛡️ ЗАЩИТА АКТИВНА (Socket.IO)
                    {selectedTest.randomOrder && <span style={{ marginLeft: '10px', background: '#e3f2fd', padding: '2px 8px', borderRadius: '12px' }}>🔀 Перемешано</span>}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2>{selectedTest.title}</h2>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: timeLeft < 60 ? '#c8102e' : '#333' }}>
                      ⏱️ {formatTime(timeLeft)}
                    </div>
                  </div>
                  
                  <div style={{ background: violations > 0 ? '#ffcdd2' : '#e3f2fd', padding: '10px', borderRadius: '10px', margin: '20px 0' }}>
                    ⚠️ НАРУШЕНИЙ: {violations} / 3
                    {violations >= 2 && <span style={{ marginLeft: '10px', color: '#ff4444' }}>⚠️ Ещё одно нарушение - тест прервется!</span>}
                  </div>
                  
                  <div style={{ marginBottom: '20px' }}>
                    <span style={{ background: '#c8102e', color: 'white', padding: '5px 10px', borderRadius: '15px', fontSize: '12px' }}>
                      {questionTypes[selectedTest.questions[currentQuestionIndex]?.type]?.icon} {questionTypes[selectedTest.questions[currentQuestionIndex]?.type]?.name} | {selectedTest.questions[currentQuestionIndex]?.points || 1} баллов
                    </span>
                    <span style={{ marginLeft: '10px', fontSize: '14px', color: '#666' }}>
                      Вопрос {currentQuestionIndex + 1} из {selectedTest.questions.length}
                    </span>
                  </div>
                  
                  <h3>{selectedTest.questions[currentQuestionIndex].text}</h3>
                  
                  <div style={{ marginTop: '20px' }}>
                    {renderQuestion()}
                  </div>
                  
                  <button onClick={nextQuestion} style={{ marginTop: '30px', width: '100%', padding: '15px', background: '#c8102e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' }}>
                    {currentQuestionIndex === selectedTest.questions.length - 1 ? '🏁 ЗАВЕРШИТЬ ТЕСТ' : '➡️ ДАЛЕЕ'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;