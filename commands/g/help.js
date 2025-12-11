import { helpEmbed } from "../utils/helpEmbed.js";

export function helpCommand(client, message) {
  return message.reply({ embeds: [helpEmbed()] });
}
