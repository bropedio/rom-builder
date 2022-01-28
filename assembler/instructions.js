"use strict";

/* Classes */

class SafeMap {
  constructor ({ Constructor, key, items }) {
    this.name = Constructor.name;
    this.key = key;
    this.items = items;
    this.map = new Map(items.map(item => {
      return [item[key], new Constructor(item)];
    ));
  }
  has (key) {
    return this.map.has(key);
  }
  get (key) {
    if (this.has(key)) {
      return this.map.get(key);
    } else {
      return this.error(`is missing requested key ${key}`);
    }
  }
  get_batch (keys) {
    return keys.map(key => this.get(key));
  }
  set (key, val) {
    if (this.has(key)) {
      return this.error(`cannot overwrite key ${key}`);
    } else {
      this.map.set(key, val);
    }
  }
  error (msg) {
    throw new Error(`EntityMap "${this.name}" ${msg}`);
  }
}

class Argument {
  constructor ({ name, regex, format }) {
    this.name = name;
    this.regex = regex;
    this.format = format;
  }
}

class Instruction {
  constructor ({ name, description, args, action }) {
    this.name = name;
    this.description = description;
    this.args = args.map;
    this.action = action;
    this.regex = this.getRegex();
  }

  getRegex () {
    const params_regex = this.args.map(arg => {
      switch (arg) {
        case 'offset': return hex_param(3)
        case 'byte': return hex_param(1)
        default: throw new Error(`Arg not supported: ${arg}`);
      }
    }).map(unescaped => {
      const escaped = unescaped.
        replace(/\//g, '\\\\').
        replace(/\$/g, '\\$');

      return ` (${escaped})`;
    }).join('');

    return new RegExp(`^${this.name}${param_regex}$`);
  }

  execute (match) {
    if (!match || !match[0]) {
      throw new Error(`Instruction malformed: ${this.name}`);
    }

    const input_args = this.args.map((arg, i) => {
      return arg.format(match[i + 1]);
    });

    return this.action.apply(context, input_args);
  }
}

/* Helpers */

function hex_param (bytes) {
  return `$[0-9A-F]{${bytes * 2}}`;
}
function hex_format (str) {
  return parseInt(str.slice(1), 16);
}

/* Code */

const argument_map = new SafeMap('name', Argument, [{
  name: 'offset',
  regex: hex_param(3),
  format: hex_format
}, {
  name: 'byte',
  regex: hex_param(1)
  format: hex_format
}]);

const instruction_map = new SafeMap('name', Instruction, [{
  name: 'hirom',
  description: 'Specifies the ROM mapping mode as "hirom"',
  args: [],
  action: () => {}
}, {
  name: 'org',
  description: 'Update the current buffer index',
  args: argument_map.get_batch(['offset']),
  action: (offset) => {
    this.rom.offset(offset);
  }
}, {
  name: 'warnpc',
  description: 'Complain if writing beyond given offset',
  args: argument_map.get_batch(['offset']),
  action: (offset) => {
    const rom_offset = this.rom.offset();

    if (this.rom.offset() >= offset) {
      const rom_str = rom_offset.toString(16);
      const warn_str = offset.toString(16);
      throw new Error(`Offset ${rom_str} exceeds warning ${warn_str}`);
    }
  }
}, {
  name: 'padbyte',
  description: 'Set byte to use as fill for "pad" instruction',
  args: argument_map.get_batch(['byte']),
  action: (padbyte) => {
    this.padbyte = padbyte;
  }
}, {
  name: 'pad',
  regex: /^pad \$([0-9A-F]{6})/,
  action: (match, offset_str) => {
    const offset = parseInt(offset_str, 16);
    while (this.rom.offset() !== offset) {
      this.rom.write(this.padbyte);
    }
  }
}, {
  name: 'variable',
  regex: /^!(\S+) = (\S+)$/,
  action: (match, ref, value) => {
    this.variables.set(ref, value);
  }
}];

module.exports = instructions;
