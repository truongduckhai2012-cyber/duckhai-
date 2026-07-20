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

    const credentials = { appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8')) };

    login(credentials, (err, api) => {
        if (err) {
            console.error(err);
            return updateStatus("❌ Đăng nhập thất bại! Kiểm tra appstate.");
        }

        // Báo trạng thái thành công lên màn hình App
        updateStatus("🟢 BOT ĐÃ HOẠT ĐỘNG THÀNH CÔNG!");

        api.setOptions({ 
            listenEvents: true,  // Bắt buộc bật true để nhận diện sự kiện kết bạn
            selfListen: false,
            forceUseID: true,
            autoMarkDelivery: true,
            online: true, 
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        });

        // BIỆN PHÁP 1: Tự động lưu Cookie mới bằng hàm trích xuất trực tiếp từ api (Chuẩn biar-fca)
        const updateCookie = () => {
            try {
                if (typeof api.getAppState === "function") {
                    const newState = api.getAppState();
                    fs.writeFileSync('appstate.json', JSON.stringify(newState, null, 2), 'utf8');
                    console.log("🔄 [HỆ THỐNG] Đã trích xuất và cập nhật Cookie mới vào appstate.json!");
                }
            } catch (writeErr) {
                console.error("❌ Lỗi tự động lưu Cookie mới:", writeErr);
            }
        };

        api.listenMqtt((err, message) => {
            if (err || !message) return;

            // Mỗi khi có tương tác hoặc sự kiện mới, kích hoạt kiểm tra và lưu cookie nếu có thay đổi
            updateCookie();

            // ===== [TÍNH NĂNG] TỰ ĐỘNG CHẤP NHẬN KẾT BẠN =====
            if (message.type === "friend_request" || message.logMessageType === "friend_request_received") {
                const senderID = message.senderID || message.author;
                console.log(`[FRIEND REQUEST] Phát hiện lời mời từ ID: ${senderID}`);

                // Gọi hàm chấp nhận kết bạn của biar-fca (true = đồng ý)
                api.handleFriendRequest(senderID, true, (err) => {
                    if (err) {
                        console.error(`❌ Không thể kết bạn với ${senderID}:`, err.message || err);
                    } else {
                        console.log(`✅ Tự động chấp nhận kết bạn thành công với ID: ${senderID}`);
                        
                        // Áp dụng độ trễ nhẹ khi nhắn tin kết bạn để Facebook không quét hành vi bot
                        api.sendTypingIndicator(senderID, () => {
                            setTimeout(() => {
                                api.sendMessage("Cảm ơn bạn đã kết bạn với Bot nhé! Gõ !menu để xem các tính năng giải trí nha. ✨", senderID);
                            }, 1500);
                        });
                    }
                });
                return; // Kết thúc xử lý sự kiện kết bạn tại đây
            }

            // Lọc các tin nhắn hợp lệ cho hệ thống lệnh
            if (message.type !== "message") return;

            if (processedMessages.has(message.messageID)) return;
            processedMessages.add(message.messageID);
            setTimeout(() => processedMessages.delete(message.messageID), 3000);

            const senderID = message.senderID;
            const body = message.body ? message.body.trim() : "";
            const threadID = message.threadID; 
            const mentions = message.mentions || {};

            const isGroup = threadID !== senderID; 
            const isAdmin = (senderID === ADMIN_ID); // So khớp với ID nhập từ App công cụ
            const hasPermission = isAdmin || isPublicMode;

            // BIỆN PHÁP 2: Giả lập trạng thái "Đang gõ" và tạo độ trễ 1.5 giây trước khi gửi (Chống spam/Chống logout)
            function safeSend(text, targetThread, msgID = null) {
                api.sendTypingIndicator(targetThread, (err) => {
                    if (err) console.log(`❌ Lỗi bật trạng thái gõ:`, err.message || err);
                    
                    setTimeout(() => {
                        api.sendMessage(text, targetThread, (err) => {
                            if (err) console.log(`❌ Lỗi gửi tin nhắn:`, err.message || err);
                        }, msgID);
                    }, 1500); // 1.5 giây giả lập thời gian người đọc và gõ tin nhắn
                });
            }

            // --- HỆ THỐNG LỆNH CỦA BOT ---
            if (body.toLowerCase() === "!menu") {
                if (!hasPermission) return safeSend("❌ Bạn không có quyền sử dụng Menu!", threadID, message.messageID);
                const menuText = 
`╔════ 🌟 𝐃𝐔𝐂𝐊𝐇𝐀𝐈 𝐌𝐄𝐍𝐔 🌟 ════╗
  📨 [𝟭] 𝗧𝗨̛̣ Đ𝗢̂𝗡𝗚 𝗚𝗨̛̉𝑰 𝗧𝗜𝗡 🇳𝗛𝗔́𝗡
  🔹 Cú pháp: !1 delay:[thời_gian][đơn_vị] [nội dung]
  🎮 [𝟮] 𝗠𝗜𝗡𝗜 𝗚𝗔𝗠𝗘 𝗚𝗜𝗔̉𝑰 𝗧𝗥𝗜́
  🔹 Oẳn tù tì: !game oantuti [keo/bua/bao]
  🔹 Nối từ: !game noitu [từ_2_tiếng]
  ⚙️ [𝟯] 𝗖𝗔̂́𝗨 𝗛𝗜̀𝗡𝗛 𝗤𝗨𝗬𝗘̂̀𝗡 (Chỉ Admin)
  🔹 Mở quyền nhóm: !accept @all
╚═══════════════════════╝`;
                return safeSend(menuText, threadID, message.messageID);
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
