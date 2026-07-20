const login = require("biar-fca").login || require("biar-fca");
const fs = require("fs");

let autoSendInterval = null; 
let lastWord = ""; 
let activeWordGame = false; 
let isPublicMode = false; 
const processedMessages = new Set();

// Biến hàm này thành module để file giao diện gọi được
module.exports = function(ADMIN_ID, updateStatus) {
    
    if (!fs.existsSync('appstate.json')) {
        return updateStatus("❌ Lỗi: Thiếu file appstate.json!");
    }

    // --- BƯỚC 1: KIỂM TRA ĐỊNH DẠNG ID NHẬP VÀO CÓ HỢP LỆ KHÔNG ---
    const cleanID = String(ADMIN_ID).trim();
    // Regex kiểm tra: Phải hoàn toàn là số và có độ dài từ 4 đến 16 ký tự
    const isValidFormat = /^[0-9]{4,16}$/.test(cleanID);

    if (!isValidFormat) {
        updateStatus("❌ Sai id facebook! Vui lòng kiểm tra id của bạn.");
        console.log(`[HỆ THỐNG] Từ chối đăng nhập do ID không hợp lệ: ${ADMIN_ID}`);
        return; // Bot dừng lại luôn, không thèm chạy lệnh đăng nhập Facebook ngầm
    }

    const credentials = { appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8')) };

    login(credentials, (err, api) => {
        if (err) {
            console.error(err);
            return updateStatus("❌ Đăng nhập thất bại! Kiểm tra appstate.");
        }

        // --- BƯỚC 2: SO KHỚP XEM ID CÓ TRÙNG VỚI NICK BOT KHÔNG ---
        const botTrueID = api.getCurrentUserID(); 

        if (cleanID !== String(botTrueID).trim()) {
            updateStatus("❌ Sai id facebook! Vui lòng kiểm tra id của bạn.");
            console.log(`[HỆ THỐNG] Sai tài khoản Admin (Nhập vào: ${cleanID} | ID thật của Bot: ${botTrueID})`);
            if (typeof api.logout === "function") api.logout();
            return; 
        }

        // Nếu vượt qua cả 2 lớp kiểm tra trên
        updateStatus("🎉 Chúc mừng! id đã đúng. bot đã bắt đầu đăng nhập.");
        console.log("🟢 [HỆ THỐNG] Xác minh ID Admin thành công và hợp lệ!");

        api.setOptions({ 
            listenEvents: true,  
            selfListen: false,
            forceUseID: true,
            autoMarkDelivery: true,
            online: true, 
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        });

        // Tự động cập nhật AppState
        const updateCookie = () => {
            try {
                if (typeof api.getAppState === "function") {
                    const newState = api.getAppState();
                    fs.writeFileSync('appstate.json', JSON.stringify(newState, null, 2), 'utf8');
                }
            } catch (writeErr) {
                console.error("❌ Lỗi tự động lưu Cookie mới:", writeErr);
            }
        };

        api.listenMqtt((err, message) => {
            if (err || !message) return;
            updateCookie();

            // ===== TỰ ĐỘNG CHẤP NHẬN KẾT BẠN =====
            if (message.type === "friend_request" || message.logMessageType === "friend_request_received") {
                const senderID = message.senderID || message.author;
                api.handleFriendRequest(senderID, true, (err) => {
                    if (!err) {
                        api.sendTypingIndicator(senderID, () => {
                            setTimeout(() => {
                                api.sendMessage("Cảm ơn bạn đã kết bạn với Bot nhé! Gõ !menu để xem các tính năng giải trí nha. ✨", senderID);
                            }, 1500);
                        });
                    }
                });
                return;
            }

            if (message.type !== "message") return;
            if (processedMessages.has(message.messageID)) return;
            processedMessages.add(message.messageID);
            setTimeout(() => processedMessages.delete(message.messageID), 3000);

            const senderID = message.senderID;
            const body = message.body ? message.body.trim() : "";
            const threadID = message.threadID; 
            const isAdmin = (senderID === cleanID); 
            const hasPermission = isAdmin || isPublicMode;

            function safeSend(text, targetThread, msgID = null) {
                api.sendTypingIndicator(targetThread, (err) => {
                    setTimeout(() => {
                        api.sendMessage(text, targetThread, () => {}, msgID);
                    }, 1500); 
                });
            }

            // --- HỆ THỐNG LỆNH CỦA BOT ---
            if (body.toLowerCase() === "!menu") {
                if (!hasPermission) return safeSend("❌ Bạn không có quyền sử dụng Menu!", threadID, message.messageID);
                return safeSend(`╔════ 🌟 𝐃𝐔𝐂𝐊𝐇𝐀𝐈 𝐌𝐄𝐍𝐔 🌟 ════╗\n 📨 [𝟭] 𝗧𝗨̛̣ Đ𝗢̂𝗡𝗚 𝗚𝗨̛̉𝑰 𝗧𝗜𝗡 🇳𝗛𝗔́𝗡\n 🔹 Cú pháp: !1 delay:[thời_gian][đơn_vị] [nội dung]\n 🎮 [𝟮] 𝗠𝗜𝗡Ｉ 𝗚𝗔𝗠𝗘 𝗚𝗜𝗔̉𝑰 𝗧🇷𝗜́\n 🔹 Oẳn tù tì: !game oantuti [keo/bua/bao]\n 🔹 Nối từ: !game noitu [từ_2_tiếng]\n ⚙️ [𝟯] 𝗖𝗔̂́𝗨 𝗛𝗜̀𝗡𝗛 𝗤𝗨𝗬𝗘̂̀𝗡 (Chỉ Admin)\n 🔹 Mở quyền nhóm: !accept @all\n╚═══════════════════════╝`, threadID, message.messageID);
            }

            if (body.toLowerCase().startsWith("!game oantuti ")) {
                const userChoice = body.slice(14).toLowerCase().trim();
                const choices = ["keo", "bua", "bao"];
                if (!choices.includes(userChoice)) return safeSend("❌ Hãy gõ: !game oantuti [keo/bua/bao]", threadID, message.messageID);
                const botChoice = choices[Math.floor(Math.random() * choices.length)];
                let result = userChoice === botChoice ? "🤝 Hòa!" : ((userChoice === "keo" && botChoice === "bao") || (userChoice === "bua" && botChoice === "keo") || (userChoice === "bao" && botChoice === "bua") ? "🎉 Bạn thắng!" : "🤪 Bạn thua!");
                return safeSend(`🤖 Bot: ${botChoice} vs 👤 Bạn: ${userChoice}\n👉 ${result}`, threadID, message.messageID);
            }

            if (body.toLowerCase().startsWith("!1 ")) {
                if (!hasPermission) return;
                const commandContent = body.slice(3).trim();
                if (commandContent.toLowerCase() === "off") {
                    if (autoSendInterval) { clearInterval(autoSendInterval); autoSendInterval = null; return safeSend("⏹️ Đã tắt tự động gửi!", threadID, message.messageID); }
                }
                const regex = /^delay:([0-9.]+)(ms|s|m|h)\s+(.+)$/i;
                const match = commandContent.match(regex);
                if (!match) return safeSend("❌ Sai cú pháp!", threadID, message.messageID);
                const value = parseFloat(match[1]); const unit = match[2].toLowerCase(); const content = match[3];
                let timeMs = unit === "s" ? value * 1000 : (unit === "m" ? value * 60 * 1000 : (unit === "h" ? value * 60 * 60 * 1000 : value));
                if (autoSendInterval) clearInterval(autoSendInterval);
                safeSend(`✅ Bắt đầu gửi tự động chu kỳ ${value}${unit}!`, threadID, message.messageID);
                autoSendInterval = setInterval(() => { api.sendMessage(content, threadID); }, timeMs);
            }

            if (!isAdmin) return; 
            if (body.toLowerCase() === "!accept @all") { isPublicMode = true; return safeSend("🔓 Đã mở quyền dùng bot cho mọi người!", threadID, message.messageID); }
            if (body.toLowerCase() === "!accept off") { isPublicMode = false; return safeSend("🔒 Đã khóa quyền, chỉ Admin được dùng!", threadID, message.messageID); }
        });
    });
};
