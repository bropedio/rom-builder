"use strict";

/*

CLI Usage: `node app [action_name] [...action_args]`

Available Actions:
  `dump rom_path dump_directory schema_directory`
  `import rom_path save_as data_directory schema_directory`
  `test rom_path schema_directory`

*/

const Builder = require('./builder').Builder;

const action = process.argv[2];
const action_args = process.argv.slice(3);

return new Builder(action, action_args);
