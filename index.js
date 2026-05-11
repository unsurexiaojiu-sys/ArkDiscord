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

// =========================
// URL
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

const ALERT_CHANNEL_ID =
  process.env.ALERT_CHANNEL_ID;

const NOTIFICATION_CHANNEL_ID =
  process.env.NOTIFICATION_CHANNEL_ID;

// =========================
// 상태 변수
// =========================

let trackedServerNumber = null;
let updateChannelId = null;
let messageId = null;

let lastPlayers = 0;
let lastAlertTime = 0;
let lastUpdateTime = null;

let lastNotification = null;

let maintenanceState = false;

// 이미 감지한 밴 저장
const knownBans = new Set();

// =========================
// 맵 이름 매핑
// =========================

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
// 서버 번호 검색
// =========================

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
      !s.Name.includes("SOTFSolos") &&
      s.Name.endsWith(number)
  );
}

// =========================
// 맵 서버 검색
// =========================

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

    const apiMap = s.MapName
      .replace(/\s/g, "")
      .toLowerCase();

    const targetMap = mapName
      .replace(/\s/g, "")
      .toLowerCase();

    return apiMap.includes(targetMap);
  });
}

// =========================
// 공식 서버 배율
// =========================

let rates = {
  xp: 1,
  harvest: 1,
  taming: 1,
  breeding: 1,
  hatch: 1,
};

// =========================
// 공식 배율 가져오기
// =========================

async function updateRates() {
  try {
    const res = await axios.get(CONFIG_URL);

    const text = res.data;

    const getValue = (key) => {
      const match = text.match(
        new RegExp(`${key}=([0-9.]+)`)
      );

      return match ? match[1] : "1";
    };

    rates = {
      xp: getValue("XPMultiplier"),
      harvest: getValue(
        "HarvestAmountMultiplier"
      ),
      taming: getValue(
        "TamingSpeedMultiplier"
      ),
      breeding: getValue(
        "BabyMatureSpeedMultiplier"
      ),
      hatch: getValue(
        "EggHatchSpeedMultiplier"
      ),
    };

    console.log(
      "✅ 배율 업데이트 완료",
      rates
    );
  } catch (err) {
    console.error(
      "❌ 배율 불러오기 실패:",
      err.message
    );
  }
}

// =========================
// 공식 공지 감지
// =========================

async function checkNotifications() {
  try {
    const res = await axios.get(
      NOTIFICATION_URL
    );

    const html = res.data;

    const text = html
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!text || text.length < 5)
      return;

    // 최초 실행
    if (!lastNotification) {
      lastNotification = text;

      console.log(
        "📢 최초 공지 저장 완료"
      );

      return;
    }

    // 새 공지 감지
    if (text !== lastNotification) {
      console.log(
        "📢 새로운 공지 감지"
      );

      const channel =
        await client.channels.fetch(
          NOTIFICATION_CHANNEL_ID
        );

      const lowerText =
        text.toLowerCase();

      // =========================
      // 점검 시작 감지
      // =========================

      const maintenanceKeywords = [
        "maintenance",
        "servers will go down",
        "deploying patch",
        "offline",
        "downtime",
      ];

      if (
        !maintenanceState &&
        maintenanceKeywords.some((k) =>
          lowerText.includes(k)
        )
      ) {
        maintenanceState = true;

        const embed =
          new EmbedBuilder()
            .setTitle(
              "🛠 ARK 공식 서버 점검 시작"
            )
            .setDescription(text)
            .setColor(0xed4245)
            .setTimestamp();

        await channel.send({
          content: "@everyone",
          embeds: [embed],
        });
      }

      // =========================
      // 점검 종료 감지
      // =========================

      const recoveryKeywords = [
        "maintenance completed",
        "back online",
        "online again",
        "servers are back",
        "servers restored",
      ];

      if (
        maintenanceState &&
        recoveryKeywords.some((k) =>
          lowerText.includes(k)
        )
      ) {
        maintenanceState = false;

        const embed =
          new EmbedBuilder()
            .setTitle(
              "✅ ARK 공식 서버 점검 종료"
            )
            .setDescription(text)
            .setColor(0x57f287)
            .setTimestamp();

        await channel.send({
          content: "@everyone",
          embeds: [embed],
        });
      }

      // =========================
      // 일반 공지
      // =========================

      const embed = new EmbedBuilder()
        .setTitle("📢 ARK 공식 공지")
        .setDescription(text)
        .setColor(0xf1c40f)
        .setFooter({
          text: "ARK Official Notification",
        })
        .setTimestamp();

      await channel.send({
        embeds: [embed],
      });

      lastNotification = text;
    }
  } catch (err) {
    console.error(
      "❌ 공지 확인 실패:",
      err.message
    );
  }
}

// =========================
// 밴 리스트 감지
// =========================

async function checkBanList() {
  try {
    const res = await axios.get(
      BANLIST_URL
    );

    const text = res.data;

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // 최초 실행
    if (knownBans.size === 0) {
      lines.forEach((line) =>
        knownBans.add(line)
      );

      console.log(
        `🔨 밴 리스트 초기화 완료 (${lines.length}명)`
      );

      return;
    }

    // 신규 밴 감지
    const newBans = [];

    for (const line of lines) {
      if (!knownBans.has(line)) {
        knownBans.add(line);

        newBans.push(line);
      }
    }

    // 신규 밴 없으면 종료
    if (newBans.length === 0) return;

    console.log(
      `🔨 신규 밴 감지 (${newBans.length}명)`
    );

    const channel =
      await client.channels.fetch(
        NOTIFICATION_CHANNEL_ID
      );

    const embed = new EmbedBuilder()
      .setTitle(
        "🔨 ARK 신규 글로벌 밴 감지"
      )
      .setDescription(
        newBans
          .slice(0, 20)
          .map(
            (ban) =>
              `• https://steamcommunity.com/profiles/${ban}`
          )
          .join("\n")
      )
      .addFields(
        {
          name: "📊 신규 밴 수",
          value: `\`\`\`\n${newBans.length}\n\`\`\``,
          inline: true,
        },
        {
          name: "📦 전체 저장 수",
          value: `\`\`\`\n${knownBans.size}\n\`\`\``,
          inline: true,
        }
      )
      .setColor(0xed4245)
      .setFooter({
        text: "ARK Global Ban Detection",
      })
      .setTimestamp();

    await channel.send({
      embeds: [embed],
    });
  } catch (err) {
    console.error(
      "❌ 밴 리스트 확인 실패:",
      err.message
    );
  }
}

// =========================
// 봇 시작
// =========================

client.once("ready", async () => {
  console.log(
    `✅ 로그인됨: ${client.user.tag}`
  );

  await updateRates();

  await checkNotifications();

  await checkBanList();
});

// =========================
// 명령어 처리
// =========================

client.on(
  "interactionCreate",
  async (interaction) => {
    if (!interaction.isChatInputCommand())
      return;

    // =========================
    // 조회
    // =========================

    if (interaction.commandName === "조회") {
      try {
        const number =
          interaction.options.getString(
            "서버번호"
          );

        const res = await axios.get(
          API_URL
        );

        const server = findServer(
          res.data,
          number
        );

        if (!server) {
          return interaction.reply(
            "❌ 서버 없음"
          );
        }

        const embed =
          new EmbedBuilder()
            .setTitle("🔍 서버 조회")
            .setDescription(
              `**${server.SessionName}**`
            )
            .addFields(
              {
                name: "👥 Players",
                value:
                  `\`\`\`\n${server.NumPlayers}` +
                  `/${server.MaxPlayers}\n\`\`\``,
                inline: true,
              },
              {
                name: "🟢 State",
                value:
                  "```yaml\n🟢 Online\n```",
                inline: true,
              },
              {
                name: "🌐 Ping",
                value:
                  `\`\`\`\n${server.ServerPing || 0}\n\`\`\``,
                inline: true,
              },
              {
                name: "🌍 Map",
                value:
                  `\`\`\`\n${server.MapName}\n\`\`\``,
              },
              {
                name: "☀️ Day Time",
                value:
                  `\`\`\`\n${server.DayTime || "Unknown"}\n\`\`\``,
                inline: true,
              },
              {
                name: "🎮 Platform",
                value:
                  `\`\`\`\n${server.PlatformType || "Unknown"}\n\`\`\``,
                inline: true,
              },
              {
                name: "⚡ Rates",
                value:
                  "```yaml\n" +
                  `XP: x${rates.xp}\n` +
                  `Harvest: x${rates.harvest}\n` +
                  `Taming: x${rates.taming}\n` +
                  `Breed: x${rates.breeding}\n` +
                  `Hatch: x${rates.hatch}\n` +
                  "```",
              },
              {
                name: "🌐 Server IP",
                value:
                  `\`\`\`\n${server.IP}\n\`\`\``,
              },
              {
                name: "🌐 Server Port",
                value:
                  `\`\`\`\n${server.Port}\n\`\`\``,
                inline: true,
              }
            )
            .setColor("Blue")
            .setTimestamp();

        return interaction.reply({
          embeds: [embed],
        });
      } catch (err) {
        console.error(err);

        return interaction.reply(
          "❌ 조회 실패"
        );
      }
    }

    // =========================
// 맵 서버리스트
// =========================

if (interaction.commandName === "맵") {
  try {
    const mapInput =
      interaction.options.getString("맵");

    const mapName =
      MAP_NAMES[mapInput];

    if (!mapName) {
      return interaction.reply(
        "❌ 지원하지 않는 맵"
      );
    }

    const res = await axios.get(
      API_URL
    );

    const servers =
      findServersByMap(
        res.data,
        mapName
      );

    if (servers.length === 0) {
      return interaction.reply(
        "❌ 서버 없음"
      );
    }


// 플레이어 많은 순 정렬
servers.sort((a, b) => {
  return (
    (b.NumPlayers || 0) -
    (a.NumPlayers || 0)
  );
});

// 서버 목록 생성
const serverLines = servers.map(
  (server) => {
    const number =
      server.Name.match(/(\d+)$/)?.[1] ||
      "Unknown";

    const players =
      server.NumPlayers || 0;

    const maxPlayers =
      server.MaxPlayers || 70;

    let status = "🟢";

    if (players >= 70) {
      status = "🔴";
    } else if (players >= 50) {
      status = "🟡";
    }

    return `${server.Name} ${status} (${players}/${maxPlayers})`;
  }
);

// 20개씩 분할
const chunkSize = 100;

const chunks = [];

for (
  let i = 0;
  i < serverLines.length;
  i += chunkSize
) {
  chunks.push(
    serverLines.slice(i, i + chunkSize)
  );
}

const embeds = chunks.map(
  (chunk, index) => {
    return new EmbedBuilder()
      .setTitle(
        `🗺 ${mapInput} Server Number List`
      )
      .setDescription(
        "```yaml\n" +
          chunk.join("\n") +
          "\n```"
      )
      .setFooter({
        text:
          `페이지 ${index + 1}/${
            chunks.length
          } | 🟢 Good 🟡 Half 🔴 Capped`,
      })
      .setColor(0x3498db)
      .setTimestamp();
  }
);

// 총 플레이어 계산
const totalPlayers = servers.reduce(
  (sum, server) =>
    sum + (server.NumPlayers || 0),
  0
);

// 온라인 서버 수
const onlineServers =
  servers.filter(
    (s) => (s.NumPlayers || 0) >= 0
  ).length;

// 요약 Embed 추가
embeds.push(
  new EmbedBuilder()
    .setTitle("📊 Server Statistics")
    .addFields(
      {
        name: "🖥 Server List",
        value:
          `\`\`\`\n${servers.length}\n\`\`\``,
        inline: true,
      },
      {
        name: "👥 Player List",
        value:
          `\`\`\`\n${totalPlayers}\n\`\`\``,
        inline: true,
      },
      {
        name: "🟢 Online Server",
        value:
          `\`\`\`\n${onlineServers}\n\`\`\``,
        inline: true,
      }
    )
    .setColor(0x2ecc71)
    .setFooter({
      text: "ARK Official Server Statistics",
    })
    .setTimestamp()
);

// 여러 Embed 전송
return interaction.reply({
  embeds: embeds,
});
  } catch (err) {
    console.error(err);

    return interaction.reply(
      "❌ 맵 서버 리스트 조회 실패"
    );
  }
}


    // =========================
    // 채널 설정
    // =========================

    if (
      interaction.commandName ===
      "채널설정"
    ) {
      const channel =
        interaction.options.getChannel(
          "채널"
        );

      updateChannelId = channel.id;

      return interaction.reply(
        `✅ 업데이트 채널 설정 완료: ${channel}`
      );
    }

    // =========================
    // 등록
    // =========================

    if (interaction.commandName === "등록") {
      if (!updateChannelId) {
        return interaction.reply(
          "❌ 먼저 /채널설정 해줘"
        );
      }

      trackedServerNumber =
        interaction.options.getString(
          "서버번호"
        );

      lastPlayers = 0;

      const channel =
        await client.channels.fetch(
          updateChannelId
        );

      const msg = await channel.send(
        "📡 서버 추적 시작..."
      );

      messageId = msg.id;

      return interaction.reply(
        `✅ 서버 ${trackedServerNumber} 추적 시작`
      );
    }

    // =========================
    // 해제
    // =========================

    if (interaction.commandName === "해제") {
      trackedServerNumber = null;
      messageId = null;

      return interaction.reply(
        "🛑 서버 추적 중지됨"
      );
    }
  }
);

// =========================
// 서버 상태 자동 업데이트
// =========================

setInterval(async () => {
  if (
    !trackedServerNumber ||
    !updateChannelId ||
    !messageId
  )
    return;

  try {
    const res = await axios.get(API_URL);

    const server = findServer(
      res.data,
      trackedServerNumber
    );

    const isOnline = !!server;

    lastUpdateTime = new Date();

    const embed = new EmbedBuilder()
      .setTitle("🦖 ARK 서버 상태")
      .setColor(isOnline ? "Green" : "Red")
      .setFooter({
        text: "자동 업데이트 (60초)",
      })
      .setTimestamp();

    if (isOnline) {
      const current = server.NumPlayers;

      const diff = current - lastPlayers;

      const nowTime = Date.now();

      embed
        .setDescription(
          `**${server.SessionName}**`
        )
        .addFields(
          {
            name: "👥 Players",
            value:
              `\`\`\`\n${current}/${server.MaxPlayers}\n\`\`\``,
            inline: true,
          },
          {
            name: "🟢 State",
            value:
              "```yaml\n🟢 Online\n```",
            inline: true,
          },
          {
            name: "🌐 Ping",
            value:
              `\`\`\`\n${server.ServerPing || 0}\n\`\`\``,
            inline: true,
          },
          {
            name: "🌍 Map",
            value:
              `\`\`\`\n${server.MapName}\n\`\`\``,
          },
          {
            name: "☀️ Day Time",
            value:
              `\`\`\`\n${server.DayTime || "Unknown"}\n\`\`\``,
            inline: true,
          },
          {
            name: "⏱ 마지막 업데이트",
            value: `<t:${Math.floor(
              lastUpdateTime.getTime() /
                1000
            )}:R>`,
          }
        );

      // 플레이어 입장/퇴장 감지
      if (
        Math.abs(diff) > 0 &&
        nowTime - lastAlertTime >
          30000
      ) {
        const alertChannel =
          await client.channels.fetch(
            ALERT_CHANNEL_ID
          );

        const isJoin = diff > 0;

        const alertEmbed =
          new EmbedBuilder()
            .setTitle(
              isJoin
                ? "🟢 플레이어 입장"
                : "🔴 플레이어 퇴장"
            )
            .setDescription(
              `**${server.SessionName}**`
            )
            .addFields(
              {
                name: "👥 Players",
                value:
                  `\`\`\`\n${current}/${server.MaxPlayers}\n\`\`\``,
                inline: true,
              },
              {
                name: "📊 변화량",
                value:
                  `\`\`\`\n${
                    isJoin
                      ? `+${diff}`
                      : diff
                  }\n\`\`\``,
                inline: true,
              }
            )
            .setColor(
              isJoin
                ? 0x57f287
                : 0xed4245
            )
            .setTimestamp();

        await alertChannel.send({
          embeds: [alertEmbed],
        });

        lastAlertTime = nowTime;
      }

      lastPlayers = current;
    } else {
      embed
        .setDescription(
          "🔴 서버 오프라인"
        )
        .addFields({
          name: "⏱ 마지막 업데이트",
          value: `<t:${Math.floor(
            lastUpdateTime.getTime() /
              1000
          )}:R>`,
        });
    }

    const channel =
      await client.channels.fetch(
        updateChannelId
      );

try {
  const msg =
    await channel.messages.fetch(
      messageId
    );

  if (!msg) return;

  await msg.edit({
    embeds: [embed],
  });
} catch (err) {
  console.error(
    "❌ 메시지 수정 실패:",
    err.message
  );
}
}, 60000);

// =========================
// 자동 감시
// =========================

// 배율 갱신 (12시간)
setInterval(updateRates, 300000);

// 공지 감시 (5분)
setInterval(
  checkNotifications,
  300000
);

// 밴 리스트 감시 (5분)
setInterval(checkBanList, 300000);

// =========================
// 로그인
// =========================

client.login(
  process.env.DISCORD_BOT_TOKEN
);
