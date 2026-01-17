const cron = require('node-cron');
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActivityType } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
});

const TARGET_DATE = new Date('2026-06-11T07:30:00+07:00'); // Vietnam Time
const CHANNEL_ID = '1446109155336130584';
const GENERAL_CHANNEL_ID = '1435101576292470815';
const ROLE_ID = '1443955576244801669';
const API_URL = 'https://api2.14hstudy.pro.vn/chat';

// --- HELPER FUNCTIONS ---

async function fetchWithRetry(url, payload, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.post(url, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
            });
            return response.data;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(res => setTimeout(res, 2000));
        }
    }
}

function getCountdown() {
    const now = new Date();
    const diff = TARGET_DATE - now;

    if (diff <= 0) return "Đã đến giờ thi!";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `**${days}** ngày **${hours}** giờ **${minutes}** phút`;
}

function getDynamicPrompt(hour) {
    if (hour >= 5 && hour < 10) return "Viết một lời chào buổi sáng tích cực, ngắn gọn (dưới 30 từ).";
    if (hour >= 10 && hour < 13) return "Lời động viên nghỉ trưa, nạp năng lượng sau giờ học/làm.";
    if (hour >= 13 && hour < 18) return "Câu nói sốc lại tinh thần cho buổi chiều làm việc hiệu quả, hơi hài hước xíu.";
    if (hour >= 18 && hour < 22) return "Lời nhắc nhở thư giãn, tận hưởng buổi tối.";
    if (hour >= 22 || hour < 5) return "Lời chúc ngủ ngon chữa lành, ấm áp.";
    return "Viết một câu động lực vui vẻ.";
}

function getEmbedColor(hour) {
    if (hour >= 5 && hour < 10) return '#FFD700';
    if (hour >= 10 && hour < 13) return '#FFA500';
    if (hour >= 13 && hour < 18) return '#00BFFF';
    if (hour >= 18 && hour < 22) return '#DA70D6';
    return '#483D8B';
}

async function getQuote(prompt) {
    try {
        const data = await fetchWithRetry(API_URL, {
            prompt: prompt,
            stream: false,
            model: "gemini-2.5-flash"
        });
        return data?.reply || "Hãy tin vào chính mình!";
    } catch (error) {
        console.error("API Error:", error.message);
        return "Nụ cười là liều thuốc bổ tốt nhất.";
    }
}

// --- SENDING LOGIC ---

async function sendDailyMotivation() {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (!channel) return;

        const countdown = getCountdown();
        const quote = await getQuote("Đóng vai anh/chị đi trước, viết lời khuyên/ngôn tình ngắn (dưới 35 từ) cho sĩ tử 2k8 ôn thi THPTQG.");

        const embed = new EmbedBuilder()
            .setColor('#FF4500')
            .setTitle('🔥 2k8 - Quyết Tâm Đỗ Đại Học')
            .setDescription(`⏳ **Countdown:** ${countdown}\n\n💬 **Lời nhắn:**\n_${quote}_`)
            .setTimestamp();

        await channel.send({ content: `<@&${ROLE_ID}>`, embeds: [embed] });
        console.log("Đã gửi tin 2k8.");
    } catch (err) { console.error(err); }
}

async function sendGeneralMotivation() {
    try {
        const channel = await client.channels.fetch(GENERAL_CHANNEL_ID);
        if (!channel) return;

        const vnTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
        const hour = vnTime.getHours();

        const quote = await getQuote(getDynamicPrompt(hour));
        const color = getEmbedColor(hour);

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('✨ Vitamin Tích Cực ✨')
            .setDescription(`> ${quote}`)
            .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log(`Đã gửi tin General lúc ${hour}h.`);
    } catch (err) { console.error(err); }
}

// --- SLASH COMMANDS REGISTRATION ---

async function registerCommands() {
    const commands = [
        new SlashCommandBuilder().setName('demnguoc').setDescription('Xem thời gian còn lại đến kỳ thi THPTQG 2026'),
        new SlashCommandBuilder().setName('dongluc').setDescription('Nhận ngay một câu động lực ngẫu nhiên'),
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('Đang đăng ký lệnh Slash...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Đăng ký lệnh thành công!');
    } catch (error) {
        console.error('Lỗi đăng ký lệnh:', error);
    }
}

// --- EVENTS ---

client.once('ready', async () => {
    console.log(`Bot đã online: ${client.user.tag}`);

    // 1. Đăng ký lệnh
    await registerCommands();

    // 2. Set Status
    client.user.setActivity('Đếm ngược THPTQG 2026', { type: ActivityType.Playing });

    // 3. Setup Schedules
    console.log("📅 Daily Schedules: 19:30 (2k8) | 7,11,15,19,23 (General)");

    cron.schedule('30 19 * * *', sendDailyMotivation, { scheduled: true, timezone: "Asia/Ho_Chi_Minh" });
    cron.schedule('0 7,11,15,19,23 * * *', sendGeneralMotivation, { scheduled: true, timezone: "Asia/Ho_Chi_Minh" });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'demnguoc') {
        await interaction.reply({
            content: `⏳ **Thời gian còn lại:** ${getCountdown()}`,
            ephemeral: true
        });
    }

    if (interaction.commandName === 'dongluc') {
        await interaction.deferReply(); // Đợi API trả lời
        const quote = await getQuote("Một câu động lực ngắn gọn, mạnh mẽ, truyền cảm hứng học tập.");

        const embed = new EmbedBuilder()
            .setColor('#00FF7F')
            .setTitle('💪 Cố lên bạn ơi!')
            .setDescription(quote);

        await interaction.editReply({ embeds: [embed] });
    }
});

client.login(process.env.DISCORD_TOKEN);
