require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("등록")
    .setDescription("서버 추적 시작")
    .addStringOption(option =>
      option.setName("서버번호").setDescription("예: 1033").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("조회")
    .setDescription("서버 조회")
    .addStringOption(option =>
      option.setName("서버번호").setDescription("예: 1033").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("해제")
    .setDescription("서버 추적 중지"),

  new SlashCommandBuilder()
    .setName("채널설정")
    .setDescription("업데이트 채널 설정")
    .addChannelOption(option =>
      option.setName("채널").setDescription("채널 선택").setRequired(true)
    ),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("✅ 명령어 등록 완료");
  } catch (err) {
    console.error(err);
  }
})();