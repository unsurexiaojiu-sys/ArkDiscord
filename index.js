require("dotenv").config();

const fs = require("fs");
const axios = require("axios");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
} = require("discord.js");

// =========================
// URLs
// =========================

const API_URL =
  "https://cdn2.arkdedicated.com/servers/asa/officialserverlist.json";
const CONFIG_URL =
  "https://cdn2.arkdedicated.com/asa/dynamicconfig.ini";
const NOTIFICATION_URL =
  "https://cdn2.arkdedicated.com/asa/notification.html";
const BANLIST_URL =
  "https://cdn2.arkdedicated.com/asa/BanList.txt";

// =========================
// ENV
// =========================

const ALERT_CHANNEL_ID = process.env.ALERT_CHANNEL_ID;
const NOTIFICATION_CHANNEL_ID = process.env.NOTIFICATION_CHANNEL_ID;

// =========================
// Files & constants
// =========================

const MEMO_FILE = "./serverMemo.json";

const MAP_NAMES = {
  TheIsland: "TheIsland",
  "Scorched Earth": "Scorched",
  "The Center": "Center",
  Aberration: "Aberration",
  Extinction: "Extinction",
  Astraeos: "Astraeos",
  Ragnarok: "Ragnarok",
  Valguero: "Valguero",
  "Lost Colony": "Lost",
};

// =========================
// Discord client
// =========================

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// =========================
// State
// =========================

let trackedServerNumber = null;
let updateChannelId = null;
let messageId = null;

let lastPlayers = 0;
let lastAlertTime = 0;
let lastUpdateTime = null;

let lastNotification = null;
let maintenanceState = false;

const knownBans = new Set();

let rates = {
  xp: 1,
  harvest: 1,
  taming: 1,
  breeding: 1,
  hatch: 1,
};

let serverMemo = {};
if (fs.existsSync(MEMO_FILE)) {
  serverMemo = JSON.parse(fs.readFileSync(MEMO_FILE, "utf8"));
}

// =========================
// Helpers
// =========================

function saveMemo() {
  fs.writeFileSync(MEMO_FILE, JSON.stringify(serverMemo, null, 2));
}

function parseNotificationHtml(html) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findServer(list, number) {
  return list.find(
    (s) =>
      s.Name &&
      s.Name.includes("PVP") &&
      !s.Name.includes("SmallTribes") &&
      !s.Name.includes("PVE") &&
      !s.Name.includes("Conquest") &&
      !s.Name.includes("Modded") &&
      !s.Name.includes("Consoles") &&
      !s.Name.includes("Arkpocalypse") &&
      s.Name.endsWith(number)
  );
}

function findServersByMap(list, mapName) {
  return list.filter((s) => {
    if (
      !s.Name ||
      !s.Name.includes("PVP") ||
      s.Name.includes("SmallTribes") ||
      s.Name.includes("PVE") ||
      s.Name.includes("Conquest") ||
      s.Name.includes("Modded") ||
      s.Name.includes("Arkpocalypse") ||
      s.Name.includes("Consoles") ||
      s.Name.includes("SOTFSolos")
    ) {
      return false;
    }

    if (!s.MapName) return false;

    const apiMap = s.MapName.replace(/\s/g, "").toLowerCase();
    const targetMap = mapName.replace(/\s/g, "").toLowerCase();

    return apiMap.includes(targetMap);
  });
}

// =========================
// Background tasks
// =========================

async function updateRates() {
  try {
    const res = await axios.get(CONFIG_URL);
    const text = res.data;

    const getValue = (key) => {
      const match = text.match(new RegExp(`${key}=([0-9.]+)`));
      return match ? match[1] : "1";
    };

    rates = {
      xp: getValue("XPMultiplier"),
      harvest: getValue("HarvestAmountMultiplier"),
      taming: getValue("TamingSpeedMultiplier"),
      breeding: getValue("BabyMatureSpeedMultiplier"),
      hatch: getValue("EggHatchSpeedMultiplier"),
    };

    console.log("✅ 배율 업데이트 완료");
  } catch (err) {
    console.error("❌ 배율 업데이트 실패:", err.message);
  }
}

async function checkNotifications() {
  try {
    const res = await axios.get(NOTIFICATION_URL);
    const text = parseNotificationHtml(res.data);

    if (!text || text.length < 5) return;

    if (!lastNotification) {
      lastNotification = text;
      console.log("📢 최초 공지 저장 완료");
      return;
    }

    if (text === lastNotification) return;

    const channel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID);
    const lowerText = text.toLowerCase();

    const maintenanceKeywords = [
      "maintenance",
      "servers will go down",
      "deploying patch",
      "offline",
      "wildcard",
      "greetings survivors",
      "downtime",
    ];

    if (
      !maintenanceState &&
      maintenanceKeywords.some((k) => lowerText.includes(k))
    ) {
      maintenanceState = true;

      const embed = new EmbedBuilder()
        .setTitle("🛠 ARK 공식 서버 점검 시작")
        .setDescription(text)
        .setColor(0xed4245)
        .setTimestamp();

      await channel.send({ content: "@everyone", embeds: [embed] });
    }

    const recoveryKeywords = [
      "maintenance completed",
      "back online",
      "online again",
      "servers are back",
      "servers restored",
    ];

    if (
      maintenanceState &&
      recoveryKeywords.some((k) => lowerText.includes(k))
    ) {
      maintenanceState = false;

      const embed = new EmbedBuilder()
        .setTitle("✅ ARK 공식 서버 점검 종료")
        .setDescription(text)
        .setColor(0x57f287)
        .setTimestamp();

      await channel.send({ content: "@everyone", embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setTitle("📢 ARK 공식 공지")
      .setDescription(text)
      .setColor(0xf1c40f)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    lastNotification = text;
  } catch (err) {
    console.error("❌ 공지 확인 실패:", err.message);
  }
}

async function checkBanList() {
  try {
    const res = await axios.get(BANLIST_URL);
    const lines = res.data
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (knownBans.size === 0) {
      lines.forEach((line) => knownBans.add(line));
      console.log(`🔨 밴 리스트 저장 완료 (${lines.length})`);
      return;
    }

    const newBans = [];

    for (const line of lines) {
      if (!knownBans.has(line)) {
        knownBans.add(line);
        newBans.push(line);
      }
    }

    if (newBans.length === 0) return;

    const channel = await client.channels.fetch(NOTIFICATION_CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setTitle("🔨 ARK 신규 글로벌 밴 감지")
      .setDescription(
        newBans
          .slice(0, 20)
          .map((ban) => `• ${ban}`)
          .join("\n")
      )
      .addFields(
        {
          name: "📊 New Ban Player",
          value: `\`\`\`\n${newBans.length}\n\`\`\``,
          inline: true,
        },
        {
          name: "📦 Total Saved Bans",
          value: `\`\`\`\n${knownBans.size}\n\`\`\``,
          inline: true,
        }
      )
      .setColor(0xed4245)
      .setFooter({ text: "ARK Global Ban Detection" })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error("❌ 밴 리스트 확인 실패:", err.message);
  }
}

async function updateTrackedServerEmbed() {
  if (!trackedServerNumber || !updateChannelId || !messageId) return;

  try {
    const res = await axios.get(API_URL);
    const server = findServer(res.data, trackedServerNumber);
    const isOnline = !!server;

    lastUpdateTime = new Date();

    const embed = new EmbedBuilder()
      .setTitle("🦖 ARK 서버 상태")
      .setColor(isOnline ? "Green" : "Red")
      .setFooter({ text: "자동 업데이트 (60초)" })
      .setTimestamp();

    if (isOnline) {
      const current = server.NumPlayers;
      const diff = current - lastPlayers;
      const nowTime = Date.now();

      embed
        .setDescription(`**${server.SessionName}**`)
        .addFields(
          {
            name: "👥 Players",
            value: `\`\`\`\n${current}/${server.MaxPlayers}\n\`\`\``,
            inline: true,
          },
          {
            name: "🟢 State",
            value: "```yaml\n🟢 Online\n```",
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
            name: "☀️ Day Time",
            value: `\`\`\`\n${server.DayTime || "Unknown"}\n\`\`\``,
            inline: true,
          },
          {
            name: "⏱ 마지막 업데이트",
            value: `<t:${Math.floor(lastUpdateTime.getTime() / 1000)}:R>`,
          }
        );

      if (Math.abs(diff) > 0 && nowTime - lastAlertTime > 30000) {
        const alertChannel = await client.channels.fetch(ALERT_CHANNEL_ID);
        const isJoin = diff > 0;

        const alertEmbed = new EmbedBuilder()
          .setTitle(isJoin ? "🟢 플레이어 입장" : "🔴 플레이어 퇴장")
          .setDescription(`**${server.SessionName}**`)
          .addFields(
            {
              name: "👥 Players",
              value: `\`\`\`\n${current}/${server.MaxPlayers}\n\`\`\``,
              inline: true,
            },
            {
              name: "📊 변화량",
              value: `\`\`\`\n${isJoin ? `+${diff}` : diff}\n\`\`\``,
              inline: true,
            }
          )
          .setColor(isJoin ? 0x57f287 : 0xed4245);

        await alertChannel.send({ embeds: [alertEmbed] });
        lastAlertTime = nowTime;
      }

      lastPlayers = current;
    } else {
      embed.setDescription("🔴 서버 오프라인");
    }

    const channel = await client.channels.fetch(updateChannelId);
    const msg = await channel.messages.fetch(messageId);
    await msg.edit({ embeds: [embed] });
  } catch (err) {
    console.error("❌ 자동 업데이트 실패:", err.message);
  }
}

// =========================
// Events: ready
// =========================

client.once("ready", async () => {
  console.log(`✅ 로그인됨: ${client.user.tag}`);

  await updateRates();
  await checkNotifications();
  await checkBanList();
});

// =========================
// Events: slash commands
// =========================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // /배율
  if (commandName === "배율") {
    try {
      await updateRates();

      const embed = new EmbedBuilder()
        .setTitle("⚙️ ARK Official Rates")
        .addFields(
          {
            name: "⭐ XP",
            value: `\`\`\`\n${rates.xp}x\n\`\`\``,
            inline: true,
          },
          {
            name: "⛏ Harvest",
            value: `\`\`\`\n${rates.harvest}x\n\`\`\``,
            inline: true,
          },
          {
            name: "🍖 Taming",
            value: `\`\`\`\n${rates.taming}x\n\`\`\``,
            inline: true,
          },
          {
            name: "🐣 Breeding",
            value: `\`\`\`\n${rates.breeding}x\n\`\`\``,
            inline: true,
          },
          {
            name: "🥚 Hatch",
            value: `\`\`\`\n${rates.hatch}x\n\`\`\``,
            inline: true,
          }
        )
        .setColor(0xf1c40f)
        .setFooter({ text: "Official Server Rates" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return interaction.reply("❌ 배율 조회 실패");
    }
  }

  // /공지
  if (commandName === "공지") {
    try {
      const res = await axios.get(NOTIFICATION_URL);
      const text = parseNotificationHtml(res.data);

      if (!text || text.length < 5) {
        return interaction.reply("❌ 현재 공지가 없음");
      }

      const lowerText = text.toLowerCase();

      let color = 0xf1c40f;
      let title = "📢 ARK 공식 공지";

      if (
        lowerText.includes("maintenance") ||
        lowerText.includes("downtime") ||
        lowerText.includes("greetings survivors") ||
        lowerText.includes("wildcard") ||
        lowerText.includes("offline")
      ) {
        color = 0xed4245;
        title = "🛠 ARK 서버 점검 공지";
      }

      if (
        lowerText.includes("back online") ||
        lowerText.includes("maintenance completed") ||
        lowerText.includes("servers restored")
      ) {
        color = 0x57f287;
        title = "✅ ARK 서버 복구 공지";
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(text)
        .setColor(color)
        .setFooter({ text: "ARK Official Notification" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return interaction.reply("❌ 공지 확인 실패");
    }
  }

  // /맵
  if (commandName === "맵") {
    try {
      const mapInput = interaction.options.getString("맵");
      const mapName = MAP_NAMES[mapInput];

      if (!mapName) {
        return interaction.reply("❌ 지원하지 않는 맵");
      }

      const res = await axios.get(API_URL);
      const servers = findServersByMap(res.data, mapName);

      if (servers.length === 0) {
        return interaction.reply("❌ 서버 없음");
      }

      servers.sort(
        (a, b) => (b.NumPlayers || 0) - (a.NumPlayers || 0)
      );

      const serverLines = servers.map((server) => {
        const players = server.NumPlayers || 0;
        const maxPlayers = server.MaxPlayers || 70;

        let status = "🟢";
        if (players >= 50) status = "🔴";
        else if (players >= 10) status = "🟡";

        return `${server.Name} ${status} (${players}/${maxPlayers})`;
      });

      const chunkSize = 100;
      const chunks = [];

      for (let i = 0; i < serverLines.length; i += chunkSize) {
        chunks.push(serverLines.slice(i, i + chunkSize));
      }

      const embeds = chunks.map((chunk, index) =>
        new EmbedBuilder()
          .setTitle(`🗺 ${mapInput} Server List`)
          .setDescription("```yaml\n" + chunk.join("\n") + "\n```")
          .setFooter({ text: `페이지 ${index + 1}/${chunks.length}` })
          .setColor(0x3498db)
          .setTimestamp()
      );

      const totalPlayers = servers.reduce(
        (sum, s) => sum + (s.NumPlayers || 0),
        0
      );

      embeds.push(
        new EmbedBuilder()
          .setTitle("📊 Server Statistics")
          .addFields(
            {
              name: "🖥 Servers",
              value: `\`\`\`\n${servers.length}\n\`\`\``,
              inline: true,
            },
            {
              name: "👥 Players",
              value: `\`\`\`\n${totalPlayers}\n\`\`\``,
              inline: true,
            }
          )
          .setColor(0x2ecc71)
      );

      return interaction.reply({ embeds: embeds.slice(0, 10) });
    } catch (err) {
      console.error(err);
      return interaction.reply("❌ 맵 조회 실패");
    }
  }

  // /메모
  if (commandName === "메모") {
    const server = interaction.options.getString("서버");
    const text = interaction.options.getString("내용");

    if (!serverMemo[server]) {
      serverMemo[server] = [];
    }

    serverMemo[server].push(text);
    saveMemo();

    return interaction.reply(`📝 서버 ${server} 메모 저장 완료`);
  }

  // /메모확인
  if (commandName === "메모확인") {
    const server = interaction.options.getString("서버");
    const serverMemos = serverMemo[server];

    if (!serverMemos || serverMemos.length === 0) {
      return interaction.reply("❌ 저장된 메모 없음");
    }

    const embed = new EmbedBuilder()
      .setTitle(`📝 서버 ${server} 메모`)
      .setDescription(
        serverMemos.map((m, i) => `${i + 1}. ${m}`).join("\n")
      )
      .setColor(0x5865f2)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // /메모삭제
  if (commandName === "메모삭제") {
    const server = interaction.options.getString("서버");

    delete serverMemo[server];
    saveMemo();

    return interaction.reply(`🗑 서버 ${server} 메모 삭제 완료`);
  }

  // /등록
  if (commandName === "등록") {
    if (!updateChannelId) {
      return interaction.reply("❌ 먼저 /채널설정 해줘");
    }

    trackedServerNumber = interaction.options.getString("서버번호");
    lastPlayers = 0;

    const channel = await client.channels.fetch(updateChannelId);
    const msg = await channel.send("📡 서버 추적 시작...");

    messageId = msg.id;

    return interaction.reply(
      `✅ 서버 ${trackedServerNumber} 추적 시작`
    );
  }

  // /서버정보
  if (commandName === "서버정보") {
    try {
      const number = interaction.options.getString("서버번호");
      const res = await axios.get(API_URL);
      const server = findServer(res.data, number);

      if (!server) {
        return interaction.reply("❌ 서버 없음");
      }

      const players = server.NumPlayers || 0;
      const maxPlayers = server.MaxPlayers || 70;
      const ping = server.ServerPing || 0;
      const dayTime = server.DayTime || "Unknown";
      const map = server.MapName || "Unknown";
      const ip = server.IP || "Hidden";
      const port = server.Port || "Unknown";

      let state = "🟢 Normal";
      if (players >= 70) state = "🔴 Full";
      else if (players >= 50) state = "🟡 Busy";

      const embed = new EmbedBuilder()
        .setTitle("🦖 ARK Official Server Info")
        .setDescription(`**${server.Name}**`)
        .addFields(
          {
            name: "🌍 Map",
            value: `\`\`\`\n${map}\n\`\`\``,
            inline: true,
          },
          {
            name: "👥 Players",
            value: `\`\`\`\n${players}/${maxPlayers}\n\`\`\``,
            inline: true,
          },
          {
            name: "📶 Ping",
            value: `\`\`\`\n${ping}\n\`\`\``,
            inline: true,
          },
          {
            name: "🕒 Day Time",
            value: `\`\`\`\n${dayTime}\n\`\`\``,
            inline: true,
          },
          {
            name: "⚡ Status",
            value: `\`\`\`\n${state}\n\`\`\``,
            inline: true,
          },
          {
            name: "🛠 Version",
            value: `\`\`\`\n${server.BuildId || "Unknown"}\n\`\`\``,
            inline: true,
          },
          {
            name: "🌐 IP",
            value: `\`\`\`\n${ip}:${port}\n\`\`\``,
          },
          {
            name: "🌐 SessionID",
            value: `\`\`\`\n${server.SessionID || "Unknown"}\n\`\`\``,
          },
          {
            name: "📶 AllowDownloadChars",
            value: `\`\`\`\n${
              server.AllowDownloadChars === 1
                ? "True ✅"
                : server.AllowDownloadChars === 0
                  ? "False ❌"
                  : "Unknown"
            }\n\`\`\``,
          },
          {
            name: "📶 AllowDownloadDinos",
            value: `\`\`\`\n${
              server.AllowDownloadDinos === 1
                ? "True ✅"
                : server.AllowDownloadDinos === 0
                  ? "False ❌"
                  : "Unknown"
            }\n\`\`\``,
          },
          {
            name: "🌐 PlatformType",
            value: `\`\`\`\n${server.PlatformType || "Unknown"}\n\`\`\``,
          }
        )
        .setColor(0x3498db)
        .setFooter({ text: "ARK Official Server Info" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return interaction.reply("❌ 서버 정보 조회 실패");
    }
  }

  // /조회
  if (commandName === "조회") {
    try {
      const number = interaction.options.getString("서버번호");
      const res = await axios.get(API_URL);
      const server = findServer(res.data, number);

      if (!server) {
        return interaction.reply("❌ 서버 없음");
      }

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
            name: "🌍 Map",
            value: `\`\`\`\n${server.MapName}\n\`\`\``,
            inline: true,
          },
          {
            name: "🌐 Ping",
            value: `\`\`\`\n${server.ServerPing || 0}\n\`\`\``,
            inline: true,
          },
          {
            name: "☀️ Day Time",
            value: `\`\`\`\n${server.DayTime || "Unknown"}\n\`\`\``,
            inline: true,
          },
          {
            name: "🌐 IP",
            value: `\`\`\`\n${server.IP || "Unknown"}\n\`\`\``,
          },
          {
            name: "🌐 Port",
            value: `\`\`\`\n${server.Port || "Unknown"}\n\`\`\``,
            inline: true,
          }
        )
        .setColor("Blue")
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return interaction.reply("❌ 조회 실패");
    }
  }

  // /채널설정
  if (commandName === "채널설정") {
    const channel = interaction.options.getChannel("채널");
    updateChannelId = channel.id;

    return interaction.reply(`✅ 채널 설정 완료: ${channel}`);
  }

  // /해제
  if (commandName === "해제") {
    trackedServerNumber = null;
    messageId = null;

    return interaction.reply("🛑 서버 추적 종료");
  }
});

// =========================
// Intervals
// =========================

setInterval(updateTrackedServerEmbed, 60000);
setInterval(updateRates, 600000);
setInterval(checkNotifications, 300000);
setInterval(checkBanList, 300000);

// =========================
// Login
// =========================

client.login(process.env.DISCORD_BOT_TOKEN);
