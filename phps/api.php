<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

// CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// MySQL Baglantisi
$host = 'localhost';
$dbname = 'erkamtas_grind_db';
$user = 'erkamtas_root';
$pass = '7Xfr&sTvvGWEnl}E';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(200);
    echo json_encode(['success' => false, 'error' => 'DB Error: ' . $e->getMessage()]);
    exit;
}

// Action al
$action = isset($_GET['action']) ? $_GET['action'] : '';

// POST verileri
$input = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        $input = json_decode($rawInput, true) ?? [];
    }
}

// Response fonksiyonu
function sendResponse($success, $data = null, $error = null) {
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'error' => $error
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ==================== INSIGHTS ====================
if ($action === 'save_insight') {
    $category = isset($input['category']) ? $input['category'] : 'genel';
    $title = isset($input['title']) ? $input['title'] : '';
    $content = isset($input['content']) ? $input['content'] : '';
    $importance = isset($input['importance']) ? $input['importance'] : 'medium';
    
    if (empty($content)) {
        sendResponse(false, null, 'Icerik bos olamaz');
    }
    
    $stmt = $pdo->prepare("INSERT INTO insights (category, title, content, importance) VALUES (?, ?, ?, ?)");
    $stmt->execute([$category, $title, $content, $importance]);
    
    sendResponse(true, ['id' => $pdo->lastInsertId(), 'message' => 'Bilgi kaydedildi']);
}

if ($action === 'get_insights') {
    $stmt = $pdo->query("SELECT * FROM insights WHERE is_active = TRUE ORDER BY created_at DESC");
    $insights = $stmt->fetchAll(PDO::FETCH_ASSOC);
    sendResponse(true, $insights);
}

if ($action === 'delete_insight') {
    $id = isset($input['id']) ? $input['id'] : 0;
    $stmt = $pdo->prepare("UPDATE insights SET is_active = FALSE WHERE id = ?");
    $stmt->execute([$id]);
    sendResponse(true, ['message' => 'Bilgi silindi']);
}

// ==================== GOALS ====================
if ($action === 'save_goal') {
    $title = isset($input['title']) ? $input['title'] : '';
    $description = isset($input['description']) ? $input['description'] : '';
    $deadline = isset($input['deadline']) ? $input['deadline'] : null;
    
    if (empty($title)) {
        sendResponse(false, null, 'Hedef basligi bos olamaz');
    }
    
    $stmt = $pdo->prepare("INSERT INTO goals (title, description, deadline) VALUES (?, ?, ?)");
    $stmt->execute([$title, $description, $deadline ?: null]);
    
    sendResponse(true, ['id' => $pdo->lastInsertId(), 'message' => 'Hedef kaydedildi']);
}

if ($action === 'get_goals') {
    $stmt = $pdo->query("SELECT * FROM goals ORDER BY created_at DESC");
    $goals = $stmt->fetchAll(PDO::FETCH_ASSOC);
    sendResponse(true, $goals);
}

if ($action === 'toggle_goal') {
    $id = isset($input['id']) ? $input['id'] : 0;
    $stmt = $pdo->prepare("UPDATE goals SET completed = NOT completed WHERE id = ?");
    $stmt->execute([$id]);
    sendResponse(true, ['message' => 'Hedef guncellendi']);
}

if ($action === 'delete_goal') {
    $id = isset($input['id']) ? $input['id'] : 0;
    $stmt = $pdo->prepare("DELETE FROM goals WHERE id = ?");
    $stmt->execute([$id]);
    sendResponse(true, ['message' => 'Hedef silindi']);
}

// ==================== DAILY PROGRESS ====================
if ($action === 'toggle_day') {
    $date = isset($input['date']) ? $input['date'] : date('Y-m-d');
    
    $stmt = $pdo->prepare("SELECT id, completed FROM daily_progress WHERE date = ?");
    $stmt->execute([$date]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($existing) {
        $newVal = $existing['completed'] ? 0 : 1;
        $stmt = $pdo->prepare("UPDATE daily_progress SET completed = ? WHERE id = ?");
        $stmt->execute([$newVal, $existing['id']]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO daily_progress (date, completed) VALUES (?, 1)");
        $stmt->execute([$date]);
    }
    
    sendResponse(true, ['message' => 'Gun guncellendi']);
}

if ($action === 'get_week_progress') {
    $monday = date('Y-m-d', strtotime('monday this week'));
    $sunday = date('Y-m-d', strtotime('sunday this week'));
    
    $stmt = $pdo->prepare("SELECT * FROM daily_progress WHERE date BETWEEN ? AND ? AND completed = 1");
    $stmt->execute([$monday, $sunday]);
    $progress = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    sendResponse(true, $progress);
}

// ==================== STATS ====================
if ($action === 'get_stats') {
    $stmt = $pdo->query("SELECT stat_key, stat_value FROM stats");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $stats = [];
    foreach ($rows as $row) {
        $stats[$row['stat_key']] = (int)$row['stat_value'];
    }
    
    // Streak hesapla
    $stmt = $pdo->query("SELECT date FROM daily_progress WHERE completed = 1 ORDER BY date DESC");
    $dates = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    $streak = 0;
    $checkDate = new DateTime();
    foreach ($dates as $date) {
        $dateObj = new DateTime($date);
        $diff = $checkDate->diff($dateObj)->days;
        if ($diff <= 1) {
            $streak++;
            $checkDate = $dateObj;
        } else {
            break;
        }
    }
    $stats['streak'] = $streak;
    
    sendResponse(true, $stats);
}

if ($action === 'increment_session') {
    $stmt = $pdo->prepare("UPDATE stats SET stat_value = stat_value + 1 WHERE stat_key = 'total_sessions'");
    $stmt->execute();
    sendResponse(true, ['message' => 'Seans artirildi']);
}

// ==================== CHAT HISTORY ====================
if ($action === 'save_chat') {
    $role = isset($input['role']) ? $input['role'] : 'user';
    $message = isset($input['message']) ? $input['message'] : '';
    
    $stmt = $pdo->prepare("INSERT INTO chat_history (role, message) VALUES (?, ?)");
    $stmt->execute([$role, $message]);
    
    sendResponse(true, ['id' => $pdo->lastInsertId()]);
}

if ($action === 'get_chat_history') {
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
    $stmt = $pdo->prepare("SELECT * FROM chat_history ORDER BY created_at DESC LIMIT ?");
    $stmt->bindValue(1, $limit, PDO::PARAM_INT);
    $stmt->execute();
    $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
    sendResponse(true, array_reverse($history));
}

// Gecersiz action veya bos
sendResponse(false, null, 'Gecersiz islem: ' . $action);
?>
