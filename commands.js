require("dotenv").config();

const {
  REST,
  Routes,
  ApplicationCommandOptionType,
} = require("discord.js");

// =========================
// 슬래시 명령어
// =========================

const commands = [
  // =========================
  // 서버 조회
  // =========================

  {
    name: "조회",
    description: "서버 조회",
    options: [
      {
        name: "서버번호",
        description: "서버 번호 입력",
        type:
          ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  {
    name: "서버정보",
    description: "서버 상세 정보 확인",
    options: [
      {
        name: "서버번호",
        description: "조회할 서버 번호",
        type:
          ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  // =========================
  // 맵 서버 리스트
  // =========================

  {
    name: "맵",
    description: "맵 서버 리스트 조회",
    options: [
      {
        name: "맵",
        description: "맵 선택",
        type:
          ApplicationCommandOptionType.String,
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

  // =========================
  // 서버 추적
  // =========================

  {
    name: "채널설정",
    description: "업데이트 채널 설정",
    options: [
      {
        name: "채널",
        description: "채널 선택",
        type:
          ApplicationCommandOptionType.Channel,
        required: true,
      },
    ],
  },

  {
    name: "등록",
    description: "서버 추적 시작",
    options: [
      {
        name: "서버번호",
        description: "서버 번호 입력",
        type:
          ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  {
    name: "해제",
    description: "서버 추적 중지",
  },

  // =========================
  // 메모
  // =========================

  {
    name: "메모",
    description: "서버 메모 저장",
    options: [
      {
        name: "서버",
        description: "서버 이름 입력",
        type:
          ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "내용",
        description: "메모 내용",
        type:
          ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  {
    name: "메모확인",
    description: "서버 메모 확인",
    options: [
      {
        name: "서버",
        description: "서버 이름 입력",
        type:
          ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  {
    name: "메모삭제",
    description: "서버 메모 삭제",
    options: [
      {
        name: "서버",
        description: "서버 이름 입력",
        type:
          ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },

  // =========================
  // 배율
  // =========================

  {
    name: "배율",
    description:
      "ARK 공식 서버 배율 확인",
  },

  // =========================
  // 공지
  // =========================

  {
    name: "공지",
    description:
      "ARK 공식 공지 확인",
  },
];

// =========================
// REST
// =========================

const rest = new REST({
  version: "10",
}).setToken(
  process.env.DISCORD_BOT_TOKEN
);

// =========================
// 글로벌 명령어 등록
// =========================

(async () => {
  try {
    console.log(
      "🌍 글로벌 슬래시 명령어 등록 중..."
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
      "✅ 글로벌 슬래시 명령어 등록 완료"
    );
  } catch (error) {
    console.error(
      "❌ 등록 실패:",
      error
    );
  }
})();
