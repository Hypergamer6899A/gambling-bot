// src/commands/utils/commandLoader.js
import fs from "fs";
import path from "path";

export function loadCommands(client) {
  client.commands = new Map();

  const commandsPath = path.resolve("./src/commands/g");
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    import(filePath).then(cmdModule => {
      const commandName = file.replace(".js", "");
      client.commands.set(commandName, cmdModule.default || cmdModule);
      console.log(`Loaded command: ${commandName}`);
    }).catch(err => console.error(`Failed to load ${file}:`, err));
  }
}
