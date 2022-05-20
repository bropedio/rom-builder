"use strict";

const yaml = require('js-yaml');

/* Type Definitions */

class Lookup {
  constructor (input) {
    const { seeds, fallback } = input;

    this.values = new Map();
    this.invert = new Map();
    this.fallback = fallback;
    this.strict = typeof fallback === 'undefined';

    input.seeds.forEach(seed => {
      if (seed instanceof Map) {
        seed.forEach((val, key) => this.set(key, val));
      } else {
        Object.keys(seed).forEach(key => this.set(key, seed[key]));
      }
    });
  }
  set (key, val) {
    if (this.values.has(key)) {
      throw new Error(`Lookup already has key: ${key}`);
    }
    if (this.invert.has(val)) {
      throw new Error(`Lookup already has value: ${val}`);
    }
    this.values.set(key, val);
    this.invert.set(val, key);
  }
  has_val (val) {
    return this.invert.has(val);
  }
  has_key (key) {
    return this.values.has(key) || this.values.has(String(key));
  }
  get_key (val) {
    if (this.has_val(val)) {
      return this.invert.get(val);
    } else if (this.strict) {
      throw new Error(`Lookup missing value: ${val}`);
    } else {
      return this.fallback;
    }
  }
  get_val (key) {
    if (this.has_key(key)) {
      return this.values.get(key) || this.values.get(String(key));
    } else if (this.strict) {
      throw new Error(`Lookup missing key: ${key} (0x${key.toString(16)})`);
    } else {
      return this.fallback;
    }
  }
};

class Empty {
  initialize () { return null; }
  decode () { return null; }
  encode () { return null; }
  parse ()  { return null; }
  format () { return null; }
}

class Base extends Empty {
  parse (data) { return data; }
  format (data) { return data; }
}

class Static extends Empty {
  constructor (value) {
    super();
    this.value = value;
  }
  decode () { return this.value; }
  parse () { return this.value; }
  format () { return this.value; }
}

class Placeholder extends Empty {
  constructor (placeholder) {
    super();
    this.placeholder = placeholder;
  }
  format () { return this.placeholder; }
}

class Closure extends Empty {
  constructor (input) {
    super();
    this.type = input && input.type;
  }
  initialize (api) {
    return this.type.initialize(api);
  }
  decode (rom) {
    return this.type.decode(rom);
  }
  encode (data, rom) {
    return this.type.encode(data, rom);
  }
  parse (json) {
    return this.type.parse(json);
  }
  format (data) {
    return this.type.format(data);
  }
}

class UInt extends Empty {
  constructor (size, radix) {
    super();
    if (typeof size === 'number') {
      [size, radix] = [radix, size];
    }
    this.size = size || 'byte';
    this.radix = radix || 16;
    this.prefix = radix === 10 ? '' : '0x';
  }
  decode (rom) {
    return rom.read(this.size);
  }
  encode (uint, rom) {
    return rom.write(uint, this.size);
  }
  parse (str) {
    return parseInt(str, this.radix);
  }
  format (uint) {
    return `${this.prefix}${uint.toString(this.radix)}`;
  }
}

class BaseEnum extends UInt {
  constructor ({ size, seeds }) {
    super(size);
    this.lookup = new Lookup({ seeds });
  }
  parse (str) {
    return parseInt(this.lookup.get_key(str));
  }
  format (uint) {
    return this.lookup.get_val(uint);
  }
}

class Enum extends BaseEnum {
  constructor (...seeds) {
    super({ size: 'byte', seeds });
  }
}

class EnumWord extends BaseEnum {
  constructor (...seeds) {
    super({ size: 'word', seeds });
  }
}

class Bool extends Enum {
  constructor () {
    super(['false', 'true']);
  }
}

class Char extends Enum {
  constructor (table) {
    super(table);
  }
  parse (text) {
    if (this.lookup.has_val(text)) {
      return parseInt(super.parse(text));
    } else {
      return parseInt(text.slice(3, -1), 16);
    }
  }
  format (uint) {
    if (this.lookup.has_key(uint)) {
      return super.format(uint);
    } else {
      return `[0x${uint.toString(16)}]`;
    }
  }
}

class Literal extends Empty {
  constructor (value) {
    super();
    this.value = value;
  }
  format () {
    return this.value;
  }
}

class Fixed extends Empty {
  constructor (uint) {
    super();
    this.uint = uint;
  }
  validate (value) {
    if (value !== this.uint) {
      throw new Error(`Fixed type expected ${this.uint}, found ${value}`);
    }
    return value;
  }
  decode (rom) {
    const uint = rom.read();
    return this.validate(uint);
  }
  encode (uint, rom) {
    return rom.write(this.validate(uint));
  }
  parse (str) {
    return parseInt(str.slice(2), 16);
  }
  format (uint) {
    return `0x${uint.toString(16)}`;
  }
}

function catcher (name, func) {
  let result = null;

  try {
    result = func();
  } catch (e) {
    e.message = `${name}::${e.message}`;
    throw e;
  }

  return result;
}

class Struct extends Empty {
  constructor (fields) {
    super();
    this.fields = fields;
  }
  search (name) {
    return this.fields.filter(field => field.name === name)[0];
  }
  field_loop (func) {
    this.fields.forEach(field => {
      catcher(field.name, () => {
        func(field);
      });
    });
  }
  initialize (api) {
    this.field_loop(field => {
      field.type.initialize(api);
    });
  }
  decode (rom) {
    const data = {};
    this.field_loop(field => {
      const exists = !field.condition || field.condition(data);
      data[field.name] = exists ? field.type.decode(rom) : null;
    });
    return data;
  }
  encode (data, rom) {
    return this.field_loop(field => {
      const exists = !field.condition || field.condition(data);
      if (exists) field.type.encode(data[field.name], rom);
    });
  }
  parse (json) {
    const data = {};
    this.field_loop(field => {
      const exists = !field.condition || field.condition(data);
      data[field.name] = exists ? field.type.parse(json[field.name]) : null;
    });
    return data; 
  }
  format (data) {
    const json = {};
    this.field_loop(field => {
      const exists = !field.condition || field.condition(data);
      json[field.name] = exists ? field.type.format(data[field.name]) : null;
    });
    return json;
  }
}

class Pointer extends Closure {
  constructor (input) {
    super(input);
    this.pointer = new UInt(input.size || 'word');
    this.shift = input.shift || 0;
    this.offset = input.offset;
    this.warn = input.warn;
    this.data = null;
  }
  reset_data () {
    this.data = {
      index: this.offset,
      lookup: {}
    };
  }
  decode (rom) {
    this.data = null;
    const reader = new Reader({
      offset: this.pointer.decode(rom) + this.shift,
      type: this.type
    });
    return reader.decode(rom);
  }
  encode (data, rom) {
    if (this.data == null) {
      this.reset_data();
    }

    const key = JSON.stringify(data);
    let offset = this.data.lookup[key];

    if (offset == null) {
      this.data.lookup[key] = this.data.index - this.shift;

      rom.jsr(this.data.index, () => {
        this.type.encode(data, rom);
        this.data.index = rom.offset();
        if (this.data.index > this.warn) {
          throw new Error('Pointer wrote past warning');
        }
      });
    }

    return this.pointer.encode(this.data.lookup[key], rom);
  }
  parse (json) {
    this.data = null;
    return super.parse(json);
  }
}

class Pointed extends Closure {
  constructor (input) {
    super();
    this.type = input.type;
    this.shift = input.shift || 0x000000;
    this.pointer = new Reader({
      offset: input.offset,
      type: new UInt(input.pointer_size || 'word')
    });
  }
  decode (rom) {
    const offset = this.pointer.decode(rom) + this.shift;
    const data_reader = new Reader({
      offset: offset,
      type: this.type
    });
    return data_reader.decode(rom);
  }
  encode (data, rom) {
    this.pointer.encode(rom.offset() - this.shift, rom);
    return super.encode(data, rom);
  }
}

class PointerStruct extends Struct {
  constructor (input) {
    const pointer_width = { sword: 3, word: 2 }[input.pointer_size] || 1;

    super(input.fields.map((field, i) => {
      return {
        name: field.name,
        type: new Pointed({
          offset: input.offset + (i * pointer_width),
          pointer_size: input.pointer_size,
          shift: input.shift,
          type: field.type
        })
      };
    }));
  }
}

class FlatStruct extends Struct {
  constructor (fields) {
    super(fields); 
  }
  get_size (field) {
    return field.size != null ? field.size : this.get_size(field.type); 
  }
  parse (list) {
    const json = {};

    this.fields.reduce((start_index, field) => {
      const end_index = start_index + this.get_size(field.type);
      json[field.name] = list.slice(start_index, end_index);
      return end_index; 
    }, 0);

    return super.parse(json);
  }
  format (data) {
    const json = super.format(data);
    return this.fields.reduce((list, field) => {
      return list.concat(json[field.name]);
    }, []);
  }
}

class Bits extends Struct {
  constructor (fields) {
    super(fields);
    this.size = this.get_size();
  }
  get_size () {
    const max = Math.max.apply(Math, this.fields.map(field => field.mask));
    return max > 0xFFFFFF ? 'double' : max > 0xFFFF ? 'sword' : max > 0xFF ? 'word' : 'byte';
  }
  get_proxy_rom (value) {
    // TODO: Make this more robust
    return {
      value: value,
      read: function () { return this.value; },
      write: function (value) { this.value = value; }
    };
  }
  decode (rom) {
    const data = {};
    let value = rom.read(this.size);

    this.field_loop(field => {
      let mask = field.mask;
      let bits = value & mask;
      value -= bits;

      while (mask && mask % 2 !== 1) {
        bits = bits >>> 1;
        mask = mask >>> 1;
      }

      let proxy_rom = this.get_proxy_rom(bits);
      data[field.name] = field.type.decode(proxy_rom);
    });

    if (value !== 0) {
      throw new Error(`Unhandled bits: 0x${value.toString(16)}`);
    }

    return data;
  }
  encode (data, rom) {
    var value = 0x00;

    this.field_loop(field => {
      let field_data = data[field.name];
      let mask = field.mask;
      let proxy_rom = this.get_proxy_rom(rom);

      field.type.encode(field_data, proxy_rom);
      let bits = proxy_rom.read();

      while (mask && mask % 2 !== 1) {
        bits = bits << 1;
        mask = mask >>> 1;
      }

      value |= bits;
    });

    rom.write(value, this.size);
  }
}

class Bitmask extends Bits {
  constructor (input) {
    const type = new UInt();
    const seed = {};
    const fields = [];

    input.flags.forEach((name, i) => {
      if (name === input.off_state) {
        throw new Error(`Off state ${name} matches flag name`);
      }
      const mask = Math.pow(2, i);
      seed[mask] = name;
      fields.push({ name, mask, type });
    });

    super(fields);
    this.off_state = input.off_state;
    this.verbose = input.verbose;
    this.lookup = new Lookup({ seeds: [seed] });
  }
  parse (array) {
    if (this.verbose) {
      array = Object.keys(array).filter(k => array[k]);
    }
    if (array[0] === this.off_state) return {};
    return array.reduce((data, name) => {
      this.lookup.get_key(name); // Validation
      data[name] = 1;
      return data;
    }, {});
  }
  format (data) {
    if (this.verbose) {
      return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Boolean(v)]));
    }
    const list = Object.keys(data).filter(name => data[name]);
    return list.length || !this.off_state ? list : [this.off_state];
  }
}

class List extends Closure {
  constructor (input) {
    super(input);
    this.size = input.size;
  }
  ended (list) {
    if (typeof this.size === 'function') {
      return this.size(list);
    } else {
      return list.length >= this.size;
    }
  }
  decode (rom) {
    const list = [];
    while (!this.ended(list)) {
      catcher(`List(${list.length})`, () => list.push(this.type.decode(rom)));
    }
    return list;
  }
  encode (list, rom) {
    return list.forEach((item, i) => {
      catcher(`List(${i})`, () => this.type.encode(item, rom));
    });
  }
  parse (array) {
    return array.map((item, i) => {
      return catcher(`List(${i})`, () => this.type.parse(item));
    });
  }
  format (list) {
    return list.map((item, i) => {
      return catcher(`List(${i})`, () => this.type.format(item));
    });
  }
}

class Grid extends List {
  constructor (input) {
    super({
      size: input.width * input.height,
      type: new UInt()
    });

    this.width = input.width;
    this.height = input.height;
    this.mapper = input.mapper;
  }
  mapper_size () {
    return this.mapper(0).length;
  }
  parse (grid) {
    const unit = new Array(this.mapper_size()).fill('[^\\s]').join('');
    const regex = new RegExp(unit, 'g');
    const items = grid.match(regex);
    return items.map(item => this.mapper(item, true));
  }
  format (data) {
    if (data.length > this.width * this.height) {
      throw new Error(`Parsed data (${data.length}) > ${this.width * this.height}`);
    }

    const lines = [];

    for (let i = 0; i < data.length; i += this.width) {
      let line = [];

      for (let j = 0; j < this.width; j++) {
        line.push(this.mapper(data[i + j]));
      }

      lines.push(line.join(''));
    }

    return lines.join('\n');
  }
}

class Text extends List {
  constructor (size, table, trim) {
    super({ size: size, type: new Char(table) });
    this.trim_char = trim != null ? trim : ' ';
    this.trim = this.trim_char && new RegExp(`${this.trim_char}+$`) || '';
  }
  parse (string) {
    const token_regex = /\{.*?\}|<.*?>|\[.*?\]|./g;
    const chars = string.match(token_regex) || [];
    if (this.trim_char) {
      while (chars.length < this.size) {
        chars.push(this.trim_char);
      }
    }
    return super.parse(chars);
  }
  format (list) {
    return super.format(list).join('').replace(this.trim, '');
  }
}

class TextLong extends Text {
  constructor (table) {
    super(list => list[list.length - 1] === 0, table);
  }
  parse (string) {
    return super.parse(string).concat(0);
  }
  format (list) {
    return super.format(list.slice(0, -1));
  }
}

class TextScript extends List {
  constructor (input) {
    if (Object.values(input.map).every(o => o.name !== 'end')) {
      throw new Error(`TextScript missing "end" option`);
    }
    super({
      size: list => list.length && list[list.length - 1].name === 'end',
      type: new Fork({
        control: new UInt(),
        map: {
          default: {
            name: 'default',
            use_control: true,
            type: new Char(input.table)
          },
          ...input.map
        }
      })
    });
  }
  parse (string) {
    const token_regex = /\{.*?\}|<.*?>|\[.*?\]|./g;
    const command_regex = /\[(.*?)(?::(.*))?\]/;

    return catcher('TextScript', () => {
      const list = string.match(token_regex).map(token => {
        if (token[0] === '[') {
          const [full, name, data] = token.match(command_regex);
          return { name, data };
        } else {
          return { name: 'default', data: token };
        }
      });

      return super.parse(list);
    });
  }
  format (list) {
    return catcher('TextScript', () => {
      return super.format(list).map(obj => {
        return obj.name === 'default' ? obj.data
          : obj.data == null ? `[${obj.name}]`
          : `[${obj.name}:${obj.data}]`;
      }).join('');
    });
  }
}

class Reader extends Closure {
  constructor (input) {
    super(input);
    this.offset = input.offset;
    this.warn = input.warn;
  }
  warn_check (rom) {
    if (this.warn != null && rom.offset() > this.warn) {
      throw new Error(`Reader past range (${rom.offset().toString(16)} > ${this.warn.toString(16)})`);
    }
  }
  decode (rom) {
    return rom.jsr(this.offset, () => {
      const data = this.type.decode(rom);
      this.warn_check(rom);
      return data;
    });
  }
  encode (data, rom) {
    return rom.jsr(this.offset, () => {
      this.type.encode(data, rom);
      this.warn_check(rom);
      return rom.offset();
    });
  }
  parse (json) {
    return this.type.parse(json); 
  }
  format (data) {
    return this.type.format(data);
  }
}

class IndexTable extends Closure {
  constructor (input) {
    super(input);
    this.index = new UInt();
    this.pointer = new UInt('word');
    this.table_offset = input.table_offset;
    this.table_warn = input.table_warn;
    this.data_offset = input.data_offset;
    this.data_warn = input.data_warn;
  }
  add_to_map (key, data) {
    if (!this.map[key]) {
      this.map[key] = this.values.length;
      this.values.push(data);
    }
  }
  initialize (api) {
    super.initialize(api);
    this.values = [];
    this.indexes = {};
    this.map = {};
  }
  decode (rom) {
    const index = this.index.decode(rom);

    if (!this.indexes[index]) {
      const pointer_reader = new Reader({
        offset: this.table_offset + index * 2,
        type: this.pointer
      });

      const pointer = pointer_reader.decode(rom);
      const data_reader = new Reader({
        offset: this.data_offset + pointer,
        type: this.type
      });

      const data = data_reader.decode(rom);
      const key = JSON.stringify(data);
      this.indexes[index] = data;
      this.add_to_map(key, data);
    }

    return this.indexes[index];
  }
  encode_table (values, rom) {
    const table = new PointerTable({
      size: values.length,
      offset: this.data_offset,
      warn: this.data_warn,
      type: this.type
    });
    const table_reader = new Reader({
      offset: this.table_offset,
      warn: this.table_warn,
      type: table
    });

    table_reader.encode(values, rom);
  }
  encode (data, rom) {
    if (this.values != null) {
      this.encode_table(this.values, rom);
      this.values = null;
    }
    const index = this.map[JSON.stringify(data)];
    if (index == null) throw new Error("Data not found");

    this.index.encode(index, rom);
  }
  parse (json) {
    const data = this.type.parse(json);
    const key = JSON.stringify(data);
    this.add_to_map(key, data);

    return data;
  }
  format (data) {
    return this.type.format(data);
  }
}

class PointerTable extends List {
  constructor (input) {
    super(input);
    this.offset = input.offset;
    this.warn = input.warn;
    this.wrap = input.wrap;
    this.start = input.start != null ? input.start : input.offset;
    this.wrapper = new UInt('word');
    this.point = new UInt(input.pointer_type || 'word');
  }
  decode (rom) {
    const list = [];
    const seen = {};

    var count = this.wrap ? this.wrapper.decode(rom) : Infinity;

    while (!super.ended(list)) {
      catcher(`PointerTable(${list.length})`, () => {
        let offset = list.length >= count ? this.wrap : this.offset;
        let point_value = this.point.decode(rom);
        let pointer = point_value + offset;

        if (!seen.hasOwnProperty(pointer)) {
          let reader = new Reader({
            offset: pointer,
            warn: this.warn,
            type: this.type
          });

          seen[pointer] = reader.decode(rom);
        }

        list.push(seen[pointer]);
      });
    }

    return list;
  }
  encode (list, rom) {
    let seen = {};
    let offset = this.offset;
    let pointer = this.start;
    let unwrapped = this.wrap;
    let counter;

    if (this.wrap) {
      counter = new Reader({
        offset: rom.offset(),
        type: this.wrapper
      });
      rom.offset(counter.offset + 2);
    }

    for (let i = 0; i < list.length; i++) {
      catcher(`PointerTable(${i})`, () => {
        let item = list[i];
        let key = JSON.stringify(item);

        if (!seen.hasOwnProperty(key)) {
          if (unwrapped && pointer >= this.wrap) {
            offset = this.wrap;
            unwrapped = false;
            seen = {};
            counter.encode(i, rom);
          }

          let reader = new Reader({
            offset: pointer,
            warn: this.warn,
            type: this.type
          });

          seen[key] = pointer;
          pointer = reader.encode(item, rom);
        }

        this.point.encode(seen[key] - offset, rom);
      });
    }

    var unused = this.warn - pointer;
    console.log(`Unused pointer table space: ${unused}`);

    rom.jsr(pointer, () => {
      while (unused--) rom.write(0xFF);
    });
  }
}

class Fork extends Empty {
  constructor (input) {
    super();
    this.control = input.control;
    this.lookahead = new Looker(rom => this.control.decode(rom));
    this.map = input.map;
    this.lookup = {};

    for (let key in input.map) {
      this.lookup[input.map[key].name] = key;
    }
  }
  search (name) {
    return this.map[this.lookup[name]];
  }
  get_option (key) {
    const option = this.map[key] || this.map.default;

    if (!option) {
      const context = Object.values(this.map).map(val => val.name).join('\n');
      throw new Error(`Map id ${key} is missing\n\n${context}`);
    }

    return option;
  }
  initialize (api) {
    this.control.initialize(api);
    Object.values(this.map).forEach(option => {
      option.type && option.type.initialize(api);
    });
  }
  decode (rom) {
    return catcher('Fork', () => {
      const key = this.lookahead.decode(rom);
      const option = this.get_option(key);

      // If control byte not needed by option, skip past it
      if (!option.use_control) this.control.decode(rom);

      return catcher(option.name, () => {
        return {
          name: option.name,
          data: option.type.decode(rom)
        };
      });
    });
  }
  encode (obj, rom) {
    return catcher('Fork', () => {
      const key = this.lookup[obj.name];
      const option = this.get_option(key);

      // If control byte not included in option data, encode it now
      if (!option.use_control) this.control.encode(key, rom);

      return catcher(option.name, () => {
        option.type.encode(obj.data, rom)
      });
    });
  }
  parse (json) {
    return catcher('Fork', () => {
      const key = this.lookup[json.name];
      const option = this.get_option(key);

      return catcher(option.name, () => {
        return {
          name: option.name,
          data: option.type.parse(json.data)
        };
      });
    });
  }
  format (obj) {
    return catcher('Fork', () => {
      const key = this.lookup[obj.name];
      const option = this.get_option(key);

      return catcher(option.name, () => {
        return {
          name: option.name,
          data: option.type.format(obj.data)
        };
      });
    });
  }
}

class ParallelList extends Struct {
  constructor (fields) {
    super(fields);
  }
  parse (combined_list) {
    const json = this.fields.reduce((json, field) => {
      json[field.name] = combined_list
        .filter(item => item.hasOwnProperty(field.name))
        .map(item => item[field.name]);
      return json; 
    }, {});

    return super.parse(json);
  }
  format (data) {
    const json = super.format(data);
    const combined_list = [];

    function get_combined_item (i) {
      if (!combined_list[i]) {
        combined_list[i] = {};
      }
      return combined_list[i];
    }

    this.fields.forEach(field => {
      json[field.name].forEach((item, i) => {
        get_combined_item(i)[field.name] = item;
      });
    });

    return combined_list;
  }
}

class Custom extends Closure {
  constructor (input) {
    super(input);
    this.initializer = input.initializer;
    this.decoder = input.decoder;
    this.encoder = input.encoder;
    this.parser = input.parser;
    this.formatter = input.formatter;
  }
  initialize (api) {
    return this.initializer ? this.initializer(api) : super.initialize(api);
  }
  decode (rom) {
    return this.decoder ? this.decoder(rom) : super.decode(rom);
  }
  encode (data, rom) {
    return this.encoder ? this.encoder(data, rom) : super.encode(data, rom);
  }
  parse (json) {
    return this.parser ? this.parser(json) : super.parse(json);
  }
  format (data) {
    return this.formatter ? this.formatter(data) : super.format(data);
  }
}

class JSONer extends Closure {
  constructor (input) {
    super(input);
  }
  parse (string) {
    return super.parse(JSON.parse(string));
  }
  format (data) {
    return JSON.stringify(super.format(data), null, 4);
  }
}

class File extends Custom {
  constructor (input) {
    super (input)
    this.name = input.name;
    this.extension = input.extension;
    this.optimizer = input.optimizer;
    this.index_key = input.index_key;
  }
  optimize (data, api) {
    return this.optimizer ? this.optimizer(data, api) : data;
  }
  parse (string) {
    const finish = (arr) => {
      if (this.index_key) {
        arr.forEach(item => delete item[this.index_key]);
      }
      return arr;
    };

    return super.parse(finish((() => {
      switch (this.extension) {
        case 'json': return JSON.parse(string);
        case 'yaml': return yaml.load(string);
        default: return string;
      }
    })()));
  }
  format (data) {
    let formatted = super.format(data);

    if (this.index_key) {
      formatted = formatted.map((item, i) => {
        if (this.index_key in item) {
          throw new Error(`Index key cannot overwrite field ${this.index_key}`);
        }
        return {
          [this.index_key]: i,
          ...item
        };
      });
    }

    switch (this.extension) {
      case 'json': return JSON.stringify(formatted, null, 4);
      case 'yaml': return yaml.dump(formatted);
      default: return formatted;
    }
  }
}

class Tile extends Grid {
  constructor (input) {
    super({
      width: 8,
      height: 8,
      mapper: (val, reverse) => {
        const map = ['-','@','~','0','$','#',':','x','o','8','W','E','U','+','?','7','.'];
        return reverse ? map.indexOf(val) : map[val];
      }
    });

    this.bpp = input.bpp;
  }
  decode (rom) {
    const data = new Array(64).fill(0x00);
    const bitplanes = []

    for (let i = 0; i < this.bpp; i += 2) {
      let plane_a = [];
      let plane_b = i + 1 === this.bpp ? null : [];

      for (let j = 0; j < 8; j++) {
        plane_a.push(rom.read());
        if (plane_b) plane_b.push(rom.read());
      }

      bitplanes.push(plane_a);
      if (plane_b) bitplanes.push(plane_b);
    }

    for (let i = 0, mask = 0x01; i < this.bpp; i++, mask <<= 1) {
      let bitplane = bitplanes[i];

      for (let j = 0; j < bitplane.length; j++) {
        let row = bitplane[j];

        for (let k = 0, bit = 0x01; k < 8; k++, bit <<= 1) {
          if (row & bit) {
            let index = j * 8 + (7 - k);
            data[index] |= mask;
          }
        }
      }
    }

    return data;
  }
  encode (data, rom) {
    const bitplanes = [];

    for (let i = 0, mask = 0x01; i < this.bpp; i++, mask <<= 1) {
      let bitplane = []; 

      for (let j = 0; j < data.length; j += 8) {
        let row_byte = 0x00;

        for (let k = 0; k < 8; k++) {
          let pixel = data[j + k];
          let bit = pixel & mask ? 1 : 0;
          row_byte = (row_byte << 1) | bit;
        }

        bitplane.push(row_byte);
      }

      bitplanes.push(bitplane);
    }

    for (let i = 0; i < this.bpp; i += 2) {
      let plane_a = bitplanes[i];
      let plane_b = bitplanes[i + 1];

      for (let j = 0; j < 8; j++) {
        rom.write(plane_a[j]);
        if (plane_b) rom.write(plane_b[j]);
      }
    }
  }
}

class Rewind extends Closure {
  constructor (input) {
    super(input);
    this.steps = input.steps;
  }
  decode (rom) {
    rom.offset(rom.offset() - this.steps);
    return super.decode(rom);
  }
  encode (data, rom) {
    rom.offset(rom.offset() - this.steps);
    return super.encode(data, rom);
  }
}

class Looker extends Empty {
  constructor (decoder) {
    super();
    this.decoder = decoder;
  }
  initialize (api) {}
  decode (rom) {
    return rom.jsr(rom.offset(), () => {
      return this.decoder(rom);
    });
  }
  encode (val, rom) {
    return null;
  }
  parse (json) {
    return json;
  }
  format (data) {
    return data;
  }
}

class Transformer extends Closure {
  constructor ({ type, transform }) {
    super();
    this.input_type = type;
    this.transform = transform;
  }
  initialize (api) {
    this.input_type.initialize(api);
    this.type = this.transform(this.input_type.data);
    super.initialize(api);
  }
}

class Ref extends Empty {
  constructor (name, state) {
    super();
    this.name = name;
    this.state = state;
    this.data = null;
  }
  initialize (api) {
    this.data = api.fetch(this.name, this.state);
  }
}

class RefEnum extends Transformer {
  constructor ({ ref, path, inject }) {
    const get_by_path = (item) => {
      return path.reduce((value, key) => {
        return value[key];
      }, item).trim();
    };

    const get_value = Array.isArray(path) ? get_by_path : path;

    super({
      type: new Ref(ref),
      transform: items => {
        const seen = new Set();

        return new Enum({
          ...items.map((item, i) => {
            const value = get_value(item);

            if (seen.has(value)) {
              return `${i}:${value}`;
            } else {
              seen.add(value);
              return value;
            }
          }),
          ...inject
        })
      }
    })
  }
}

module.exports = {
  Empty,
  Static,
  Literal,
  Placeholder,
  UInt,
  Char,
  Grid,
  Tile,
  Text,
  TextLong,
  TextScript,
  Lookup,
  Enum,
  EnumWord,
  Bool,
  Fixed,
  Bits,
  List,
  Struct,
  Fork,
  Pointer,
  PointerTable,
  PointerStruct,
  IndexTable,
  Reader,
  ParallelList,
  Bitmask,
  FlatStruct,
  Closure,
  Looker,
  Rewind,
  Custom,
  File,
  JSONer,
  RefEnum,
  Ref,
  Transformer
};
