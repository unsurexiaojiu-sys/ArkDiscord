const { REST, Routes } =
  require("discord.js");

require("dotenv").config();

const commands = [
  // =========================
  // 조회
  // =========================

  {
    name: "조회",
    description: "서버 조회",
    options: [
      {
        name: "서버번호",
        description: "서버 번호 입력",
        type: 3,
        required: true,
      },
    ],
  },

  // =========================
  // 채널설정
  // =========================

  {
    name: "채널설정",
    description: "업데이트 채널 설정",
    options: [
      {
        name: "채널",
        description: "채널 선택",
        type: 7,
        required: true,
      },
    ],
  },

  // =========================
  // 등록
  // =========================

  {
    name: "등록",
    description: "서버 추적 시작",
    options: [
      {
        name: "서버번호",
        description: "서버 번호 입력",
        type: 3,
        required: true,
      },
    ],
  },

  // =========================
  // 해제
  // =========================

  {
    name: "해제",
    description: "서버 추적 중지",
  },

  // =========================
  // 맵 서버리스트
  // =========================

  {
    name: "맵",
    description: "맵 서버 리스트 조회",
    options: [
      {
        name: "맵",
        description: "맵 선택",
        type: 3,
        required: true,
        choices: [
          {
            name: "TheIsland",
            value: "TheIsland",
          },
          {
            name: "Scorched Earth",
            value: "Scorched Earth",
          },
          {
            name: "The Center",
            value: "The Center",
          },
          {
            name: "Aberration",
            value: "Aberration",
          },
          {
            name: "Extinction",
            value: "Extinction",
          },
          {
            name: "Astraeos",
            value: "Astraeos",
          },
          {
            name: "Ragnarok",
            value: "Ragnarok",
          },
          {
            name: "Valguero",
            value: "Valguero",
          },
          {
            name: "Lost Colony",
            value: "Lost Colony",
          },
        ],
      },
    ],
  },
];

const rest = new REST({
  version: "10",
}).setToken(
  process.env.DISCORD_BOT_TOKEN
);

(async () => {
  try {
    console.log(
      "🔄 슬래시 명령어 등록 중..."
    );

    await rest.put(
      Routes.applicationCommands(
        process.env.CLIENT_ID
      ),
      {
        body: commands,
      }
    );

    console.log(
      "✅ 슬래시 명령어 등록 완료"
    );
  } catch (error) {
    console.error(error);
  }
})();
