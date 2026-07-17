const express = require('express');
const path = require('path');
const startBotLogic = require('./index.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Gửi giao diện index.html khi có người truy cập web
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Xử lý lệnh khi người dùng bấm nút Khởi động trên điện thoại
app.post('/start-bot', (req, res) => {
    const { adminId } = req.body;
    if (!adminId) {
        return res.status(400).json({ success: false, message: "Thiếu ID Admin!" });
    }

    // Kích hoạt chạy bot ngầm trên server
    startBotLogic(adminId, (statusMessage) => {
        console.log(`[Bot Status]: ${statusMessage}`);
    });

    res.json({ success: true, message: "🟢 BOT ĐÃ NHẬN LỆNH KÍCH HOẠT NGẦM!" });
});

app.listen(PORT, () => {
    console.log(`🌐 Web đang chạy tại: http://localhost:${PORT}`);
});
