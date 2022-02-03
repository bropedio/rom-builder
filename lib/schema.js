"use strict";

/* Schema */

class Schema {
  constructor (schemata) {
    this.schemata = schemata;
  }

  decode (rom, options) {
    return this.load('decode', rom, options);
  }

  parse (object) {
    return this.load('parse', object);
  }

  load (method, source, options={}) {
    const { optimize } = options;
    const schemata = this.schemata;
    const data = {};
    const api = {
      fetch: (name, state) => {
        return load_one(name, state || 'formatted');
      }
    };

    Object.keys(schemata).forEach(name => load_one(name));

    return data;

    function load_one (name, state) {
      try {
        const one_source = method === 'decode' ? source : source[name];
        const scheme = schemata[name];

        if (!data.hasOwnProperty(name)) {
          scheme.initialize(api);
          data[name] = scheme[method](one_source);

          if (optimize) {
            console.log(`optimizing: ${name}`);
            data[name] = scheme.optimize(data[name], api);
          }
        }

        switch (state) {
          case 'formatted': return scheme.type.format(data[name]);
          case 'decoded': return data[name];
        }
      } catch (e) {
        e.message = `${name}::${e.message}`;
        throw e;
      }
    }
  }

  encode (data, init_rom) {
    const rom = init_rom.clone();

    for (let name in this.schemata) {
      const scheme = this.schemata[name];
      scheme.encode(data[name], rom);
    }

    return rom;
  }

  format (data) {
    const formatted = {};

    for (let name in this.schemata) {
      let scheme = this.schemata[name];
      formatted[name] = scheme.format(data[name]);
    }

    return formatted;
  }

  get_extensions () {
    const extensions = {};

    for (let name in this.schemata) {
      extensions[name] = this.schemata[name].extension || 'txt';
    }

    return extensions;
  }
}

module.exports = Schema;
