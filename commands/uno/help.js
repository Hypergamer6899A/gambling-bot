import { EmbedBuilder } from "discord.js";

export function helpHandler(msg) {
  msg.channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("UNO Commands")
        .setDescription(
          "`!uno play <card>` — play a card\n" +
          "`!uno play wild <color>` — choose color\n" +
          "`!uno draw` — draw 1 card\n" +
          "`!uno endgame` — forfeit\n"
        )
    ]
  }).then(m => setTimeout(() => m.delete().catch(()=>{}), 10000));
}

