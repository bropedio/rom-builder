"use strict";

/**
 * ROM Builder
 * Bropedio, 2020
 */

const fs = require('fs');
const path = require('path');

const HiRom = require('./lib/hirom');
const Schema = require('./lib/schema');
const types = require('./lib/types');
const { search, replace } = require('./lib/search');

/* Builder */

class Builder {
  constructor (action, args) {
    this.action = action;
    this.args = args;
    this[this.action].apply(this, this.args);
  }

  dump (rom_path, dump_dir = './dump', schema_dir = './schema') {
    const schema = new Schema(require_dir(schema_dir));
    const rom = new HiRom(fs.readFileSync(resolve(rom_path)));
    const game_data = schema.decode(rom);
    const formatted = schema.format(game_data);
    const extensions = schema.get_extensions();

    if (!fs.existsSync(resolve(dump_dir), { recursive: true })){
      fs.mkdirSync(resolve(dump_dir), { recursive: true });
    }

    for (let name in formatted) {
      let filename = `${name}.${extensions[name]}`;
      let output_path = resolve(dump_dir, filename);
      let output_string = formatted[name];
      fs.writeFileSync(output_path, output_string);
    }
  }

  import (rom_path, save_as, data_path = './data', schema_dir = './schema') {
    const schema = new Schema(require_dir(schema_dir));
    const game_data = schema.parse(read_dir(data_path));
    const init_rom = new HiRom(fs.readFileSync(resolve(rom_path)));
    const new_rom = schema.encode(game_data, init_rom);

    fs.writeFileSync(resolve(save_as || rom_path), new_rom.buffer);
  }

  test (rom_path, schema_dir = './schema') {
    const schema = new Schema(require_dir(schema_dir));
    const rom = new HiRom(fs.readFileSync(resolve(rom_path)));
    const game_data = schema.decode(rom);
    const formatted = schema.format(game_data);
    const parsed = schema.parse(formatted);
    const new_rom = schema.encode(parsed, rom);
    const new_schema = new Schema(require_dir(schema_dir));
    const new_game_data = new_schema.decode(new_rom);
    const new_formatted = new_schema.format(new_game_data);

    test_formatteds(formatted, new_formatted);
    console.log("Schema passed");
  }

  optimize (rom_path, save_as, schema_dir = './schema') {
    const schema = new Schema(require_dir(schema_dir));
    const rom = new HiRom(fs.readFileSync(resolve(rom_path)));
    const game_data = schema.decode(rom);
    const optimized = schema.optimize(game_data);

    // Reset schema based on optimized data
    const formatted = schema.format(optimized);
    const parsed = schema.parse(formatted);
    const new_rom = schema.encode(parsed, rom);

    // Test optimized data
    const new_data = schema.decode(new_rom);
    const new_format = schema.format(new_data);

    console.log("Testing optimized data after encoding...");
    test_formatteds(formatted, new_format);

    console.log("Optimization successful");
    fs.writeFileSync(resolve(save_as || rom_path), new_rom.buffer);
  }

  migrate () {
    // TODO
  }
}

/* Other Helpers */

function test_formatteds (formatted_a, formatted_b) {
  for (let key in formatted_a) {
    let one_formatted = formatted_a[key];
    let one_new_formatted = formatted_b[key];

    if (JSON.stringify(one_formatted) !== JSON.stringify(one_new_formatted)) {
      fs.writeFileSync(resolve('testdata1.txt'), one_formatted);
      fs.writeFileSync(resolve('testdata2.txt'), one_new_formatted);
      throw new Error(`Test failed: ${key}`);
    }
  }
}

/* fs Helpers */

function resolve (...args) {
  return path.resolve.apply(path, [process.cwd()].concat(args));
}
function require_dir (dir_path) {
  return reduce_dir(dir_path, require);
}
function read_dir (dir_path) {
  return reduce_dir(dir_path, filepath => {
    return fs.readFileSync(filepath).toString();
  });
}
function reduce_dir (dir_path, mapper) {
  const exports = {};

  fs.readdirSync(dir_path, {
    withFileTypes: true
  }).forEach(item => {
    if (item.isFile()) {
      const fullpath = resolve(dir_path, item.name);
      const [name, ext] = item.name.split('.');
      exports[name] = mapper(fullpath);
    }
  });

  return exports;
}

module.exports = {
  Builder,
  types,
  search,
  replace,
  require_dir
};
