// commands/g/help.js
import { helpEmbed } from "../utils/embeds.js";

export function helpCommand(client, message) {
  return message.reply({ embeds: [helpEmbed()] });
}
