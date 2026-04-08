require("dotenv").config();
const axios = require("axios");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const API_URL = "https://cdn2.arkdedicated.com/servers/asa/officialserverlist.json";
const ALERT_CHANNEL_ID = process.env.ALERT_CHANNEL_ID;

let trackedServerNumber = null;
let updateChannelId = null;
let messageId = null;

let lastPlayers = 0;
let lastAlertTime = 0;
let lastUpdateTime = null;

client.once("ready", () => {
  console.log(`✅ 로그인됨: ${client.user.tag}`);
});

// 🔍 서버 필터
function findServer(list, number) {
  return list.find(s =>
    s.Name &&
    s.Name.includes("PVP") &&
    !s.Name.includes("SmallTribes") &&
    !s.Name.includes("PVE") &&
    !s.Name.includes("Conquest") &&
    !s.Name.includes("Modded") &&
    s.Name.endsWith(number)
  );
}

// 🎮 명령어 처리
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // 📡 조회
  if (interaction.commandName === "조회") {
    const number = interaction.options.getString("서버번호");
    const res = await axios.get(API_URL);
    const server = findServer(res.data, number);

    if (!server) return interaction.reply("❌ 서버 없음");

const embed = new EmbedBuilder()
  .setTitle("🔍 서버 조회")
  .setDescription(`**${server.SessionName}**`)
  .addFields(
    {
      name: "👥 Players",
      value: `\`\`\`\n${server.NumPlayers}/${server.MaxPlayers}\n\`\`\``,
      inline: true,
    },
    {
      name: "🟢 State",
      value: `\`\`\`\n🟢Online\n\`\`\``,
      inline: true,
    },
    {
      name: "🌐 Ping",
      value: `\`\`\`\n${server.ServerPing || 0}\n\`\`\``,
      inline: true,
    },
    {
      name: "🌍 Map",
      value: `\`\`\`\n${server.MapName}\n\`\`\``,
    },
    {
      name: "🌍 Day Time",
      value: `\`\`\`\n${server.DayTime || "Unknown"}\n\`\`\``,
      inline: true,
    },
    {
      name: "🌐 Server IP",
      value: `\`\`\`\n${server.IP}\n\`\`\``,
    },
    {
      name: "🌐 Server Port",
      value: `\`\`\`\n${server.Port}\n\`\`\``,
      inline: true,
    }
  )
  .setColor("Blue");

    return interaction.reply({ embeds: [embed] });
  }

  // 📺 채널 설정
  if (interaction.commandName === "채널설정") {
    const channel = interaction.options.getChannel("채널");
    updateChannelId = channel.id;

    return interaction.reply(`✅ 채널 설정 완료: ${channel}`);
  }

  // 📌 등록
  if (interaction.commandName === "등록") {
    if (!updateChannelId) {
      return interaction.reply("❌ 먼저 /채널설정 해줘");
    }

    trackedServerNumber = interaction.options.getString("서버번호");
    lastPlayers = 0;

    const channel = await client.channels.fetch(updateChannelId);
    const msg = await channel.send("📡 Server Tracking Start...");

    messageId = msg.id;

    return interaction.reply("✅ 서버 추적 시작됨");
  }

  // ❌ 해제
  if (interaction.commandName === "해제") {
    trackedServerNumber = null;
    messageId = null;

    return interaction.reply("🛑 서버 추적 중지됨");
  }
});

// 🔄 자동 업데이트
setInterval(async () => {
  if (!trackedServerNumber || !updateChannelId || !messageId) return;

  try {
    const res = await axios.get(API_URL);
    const server = findServer(res.data, trackedServerNumber);

    const isOnline = !!server;
    lastUpdateTime = new Date();

    const embed = new EmbedBuilder()
      .setTitle("🦖 ARK Player List")
      .setColor(isOnline ? "Green" : "Red")
      .setFooter({ text: "Auto Update (60 Second)" });

    if (isOnline) {
      const current = server.NumPlayers;
      const diff = current - lastPlayers;
      const nowTime = Date.now();

      embed.setDescription(`**${server.Name}**`)
        .addFields(
          {
            name: "👥 Players",
            value: `\`\`\`\n${current}/${server.MaxPlayers}\n\`\`\``,
            inline: true,
          },
          {
            name: "🟢 State",
            value: `\`\`\`\n🟢Online\n\`\`\``,
            inline: true,
          },
          {
            name: "🌐 Ping",
            value: `\`\`\`\n${server.ServerPing}\n\`\`\``,
            inline: true,
          },
          {
            name: "🌍 Map",
            value: `\`\`\`\n${server.MapName}\n\`\`\``,
          },
                    {
            name: "🌍 Day Time",
            value: `\`\`\`\n${server.DayTime}\n\`\`\``,
            inline: true,
          },
          {
            name: "⏱ 마지막 업데이트",
            value: `<t:${Math.floor(lastUpdateTime.getTime() / 1000)}:R>`
          }
        );

// 🔔 입장 / 퇴장 알림
if (Math.abs(diff) > 0 && nowTime - lastAlertTime > 30000) {
  const alertChannel = await client.channels.fetch(ALERT_CHANNEL_ID);

  const isJoin = diff > 0;

  const embed = new EmbedBuilder()
    .setTitle(isJoin ? "🟢 Player Join" : "🔴 Player Leave")
    .setDescription(`**${server.SessionName}**`)
    .addFields(
      {
        name: "👥 Online Players",
        value: `\`\`\`\n${current}/${server.MaxPlayers}\n\`\`\``,
        inline: true,
      },
      {
        name: "📊 Change Player",
        value: `\`\`\`\n${isJoin ? `+${diff}` : diff}\n\`\`\``,
        inline: true,
      },
      {
        name: "⏱ Last Update",
        value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
        inline: true,
      }
    )
    .setColor(isJoin ? 0x57f287 : 0xed4245)
    .setFooter({ text: "ARK Server Tracker" })
    .setTimestamp();

  await alertChannel.send({ embeds: [embed] });

  lastAlertTime = nowTime;
}

      lastPlayers = current;

    } else {
      embed.setDescription("🔴 서버 오프라인")
        .addFields({
          name: "⏱ Last Update",
          value: `<t:${Math.floor(lastUpdateTime.getTime() / 1000)}:R>`
        });
    }

    const channel = await client.channels.fetch(updateChannelId);
    const msg = await channel.messages.fetch(messageId);

    await msg.edit({ embeds: [embed] });

  } catch (err) {
    console.error("❌ 업데이트 오류:", err.message);
  }

}, 60000);

client.login(process.env.DISCORD_BOT_TOKEN);
