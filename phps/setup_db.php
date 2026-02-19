<?php
// MySQL Veritabani Kurulum Scripti
// localhost - root:root

$host = 'localhost';
$user = 'erkamtas_root';
$pass = '7Xfr&sTvvGWEnl}E';

try {
    // MySQL baglantisi
    $pdo = new PDO("mysql:host=$host", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Veritabani olustur
    $pdo->exec("CREATE DATABASE IF NOT EXISTS erkamtas_grind_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE erkamtas_grind_db");
    
    // Kullanici bilgileri tablosu
    $pdo->exec("CREATE TABLE IF NOT EXISTS insights (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        importance ENUM('low', 'medium', 'high') DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
    )");
    
    // Hedefler tablosu
    $pdo->exec("CREATE TABLE IF NOT EXISTS goals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        deadline DATE,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
    
    // Gunluk ilerleme tablosu
    $pdo->exec("CREATE TABLE IF NOT EXISTS daily_progress (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE UNIQUE NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
    
    // Chat gecmisi tablosu
    $pdo->exec("CREATE TABLE IF NOT EXISTS chat_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role ENUM('user', 'ai') NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
    
    // Istatistikler tablosu
    $pdo->exec("CREATE TABLE IF NOT EXISTS stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        stat_key VARCHAR(50) UNIQUE NOT NULL,
        stat_value INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");
    
    // Varsayilan istatistikleri ekle
    $pdo->exec("INSERT IGNORE INTO stats (stat_key, stat_value) VALUES ('streak', 0), ('total_sessions', 0)");
    
    echo json_encode(['success' => true, 'message' => 'Veritabani ve tablolar basariyla olusturuldu']);
    
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
