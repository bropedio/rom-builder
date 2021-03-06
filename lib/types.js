"use strict";

/* Type Definitions */

class Lookup {
  constructor (input) {
    this.values = {};
    this.invert = {};

    input.seeds.forEach(obj => this.from(obj));
  }
  from (obj) {
    for (let key in obj) {
      this.set(key, obj[key]);
    }
  }
  set (key, val) {
    if (this.values.hasOwnProperty(key)) {
      //throw new Error(`Lookup already has key: ${key}`);
    }
    if (this.invert.hasOwnProperty(val)) {
      //throw new Error(`Lookup already has value: ${val}`);
    }
    this.values[key] = val;
    this.invert[val] = key;
  }
  has_val (val) {
    return Boolean(this.invert.hasOwnProperty(val));
  }
  has_key (key) {
    return Boolean(this.values.hasOwnProperty(key));
  }
  get_key (val) {
    if (!this.has_val(val)) {
      throw new Error(`Lookup missing value: ${val}`);
    }
    return this.invert[val];
  }
  get_val (key) {
    if (!this.has_key(key)) {
      throw new Error(`Lookup missing key: ${key} (0x${key.toString(16)})`);
    }
    return this.values[key];
  }
};

class Empty {
  decode () { return null; }
  encode () { return null; }
  parse ()  { return null; }
  format () { return null; }
}

class Placeholder extends Empty {
  constructor (placeholder) {
    super();
    this.placeholder = placeholder;
  }
  format () { return this.placeholder; }
}

class Closure {
  constructor (input) {
    this.type = input && input.type;
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

class UInt {
  constructor (size, radix) {
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

class Enum extends UInt {
  constructor (...seeds) {
    super('byte');
    this.lookup = new Lookup({ seeds });
  }
  parse (str) {
    return parseInt(this.lookup.get_key(str));
  }
  format (uint) {
    return this.lookup.get_val(uint);
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

class Fixed {
  constructor (uint) {
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

class Struct {
  constructor (fields) {
    this.fields = fields;
  }
  search (name) {
    return this.fields.filter(field => field.name === name)[0];
  }
  decode (rom) {
    const data = {};
    this.fields.forEach(field => {
      catcher(field.name, () => {
        data[field.name] = field.type.decode(rom);
      });
    });
    return data;
  }
  encode (data, rom) {
    return this.fields.forEach(field => {
      catcher(field.name, () => {
        field.type.encode(data[field.name], rom);
      });
    });
  }
  parse (json) {
    const data = {};
    this.fields.forEach(field => {
      catcher(field.name, () => {
        data[field.name] = field.type.parse(json[field.name]);
      });
    });
    return data; 
  }
  format (data) {
    const json = {};
    this.fields.forEach(field => {
      catcher(field.name, () => {
        json[field.name] = field.type.format(data[field.name]);
      });
    });
    return json;
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
    return max > 255 ? 'word' : 'byte';
  }
  decode (rom) {
    const data = {};
    let value = rom.read(this.size);

    this.fields.forEach(field => {
      let mask = field.mask;
      let bits = value & mask;
      value -= bits;

      while (mask && mask % 2 !== 1) {
        bits = bits >>> 1;
        mask = mask >>> 1;
      }

      data[field.name] = bits;
    });

    if (value !== 0) {
      throw new Error(`Unhandled bits: 0x${value.toString(16)}`);
    }

    return data;
  }
  encode (data, rom) {
    var value = 0x00;

    this.fields.forEach(field => {
      let bits = data[field.name];
      let mask = field.mask;
      
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
    const fields = [];
    for (let mask in input.flags) {
      let name = input.flags[mask];
      fields.push({ name: name, mask: +mask });

      if (name === input.off_state) {
        throw new Error(`Off state ${name} matches flag name`);
      }
    }
    super(fields);
    this.lookup = new Lookup({ seeds: [input.flags] });
    this.off_state = input.off_state;
  }
  parse (array) {
    if (array[0] === this.off_state) return {};
    return array.reduce((data, name) => {
      this.lookup.get_key(name); // Validation
      data[name] = 1;
      return data;
    }, {});
  }
  format (data) {
    const list = Object.keys(data).filter(name => data[name]);
    return list.length || !this.off_state ? list : [this.off_state];
  }
}

class List {
  constructor (input) {
    this.size = input.size;
    this.type = input.type;
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
    return grid.match(regex).map(match => this.mapper(match, true));
  }
  format (data) {
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
  constructor (size, table) {
    super({ size: size, type: new Char(table) });
  }
  parse (string) {
    return super.parse(string.split(/(?![^\[]*\])/).filter(Boolean));
  }
  format (list) {
    return super.format(list).join('');
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

class Reader {
  constructor (input) {
    this.offset = input.offset;
    this.warn = input.warn;
    this.type = input.type; 
  }
  warn_check (rom) {
    if (this.warn != null && rom.offset() > this.warn) {
      throw new Error(`Reader past range`);
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
        let offset = list.length > count ? this.wrap : this.offset;
        let pointer = this.point.decode(rom) + offset;

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
          let reader = new Reader({
            offset: pointer,
            warn: this.warn,
            type: this.type
          });

          seen[key] = pointer;
          pointer = reader.encode(item, rom);
        }

        this.point.encode(seen[key] - offset, rom);

        if (unwrapped && pointer >= this.wrap) {
          offset = this.wrap;
          unwrapped = false;
          seen = {};
          counter.encode(i, rom);
        }
      });
    }

    var unused = this.warn - pointer;
    console.log(`Unused pointer table space: ${unused}`);

    rom.jsr(pointer, () => {
      while (unused--) rom.write(0xFF);
    });
  }
}

class Fork {
  constructor (input) {
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
      json[field.name] = combined_list.map(item => item[field.name]);
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

class JSONer extends Closure {
  extension = 'json';
  constructor (input) {
    super(input);
  }
  parse (string) {
    const json = JSON.parse(string);
    return super.parse(json);
  }
  format (data) {
    const formatted = super.format(data); 
    return JSON.stringify(formatted, null, 4);
  }
}

class Rewind {
  constructor (input) {
    this.steps = input.steps;
    this.type = input.type;
  }
  decode (rom) {
    rom.offset(rom.offset() - this.steps);
    return this.type.decode(rom);
  }
  encode (data, rom) {
    rom.offset(rom.offset() - this.steps);
    return this.type.encode(data, rom);
  }
  parse (json) {
    return this.type.parse(json);
  }
  format (data) {
    return this.type.format(data);
  }
}

class Looker {
  constructor (decoder) {
    this.decoder = decoder;
  }
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

module.exports = {
  Empty,
  Placeholder,
  UInt,
  Char,
  Grid,
  Text,
  TextLong,
  TextScript,
  Lookup,
  Enum,
  Bool,
  Fixed,
  Bits,
  List,
  Struct,
  Fork,
  PointerTable,
  PointerStruct,
  Reader,
  ParallelList,
  Bitmask,
  FlatStruct,
  Closure,
  Looker,
  Rewind,
  JSONer
};
