import { helpEmbed } from "../../utils/embeds/helpEmbed.js";

export function helpCommand(client, message) {
  return message.reply({ embeds: [helpEmbed()] });
}
