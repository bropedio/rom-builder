"use strict";

/* Schema */

class Schema {
  constructor (Schemes, migration = {}) {
    this.Schemes = Schemes;
    this.migration = migration; 
    this.schemes = null;
  }

  decode (rom) {
    return this.load('decode', rom);
  }

  parse (object) {
    return this.load('parse', object);
  }

  load (method, source) {
    const Schemes = this.Schemes;
    const migration = this.migration;
    const schemes = {};
    const data = {};

    for (let scheme_name in Schemes) {
      load_one(scheme_name);
    }

    this.schemes = schemes;
    return data;

    function load_one (scheme_name) {
      try {
        const one_source = method === 'decode' ? source : source[scheme_name];

        if (!data.hasOwnProperty(scheme_name)) {
          const Scheme = Schemes[scheme_name];
          const scheme = new Scheme(load_one);

          if (migration.hasOwnProperty(scheme_name)) {
            migration[scheme_name](scheme);
          }

          schemes[scheme_name] = scheme;
          data[scheme_name] = scheme[method](one_source);
        }

        return data[scheme_name];
      } catch (e) {
        e.message = `${scheme_name}::${e.message}`;
        throw e;
      }
    }
  }

  optimize (data) {
    const optimized = {};
    const schemes = this.schemes;

    for (let scheme_name in schemes) {
      optimize_one(scheme_name);
    }

    return optimized;

    function optimize_one (scheme_name) {
      console.log(`optimize one ${scheme_name}`);
      if (!optimized.hasOwnProperty(scheme_name)) {
        let scheme = schemes[scheme_name];
        let scheme_data = data[scheme_name];

        if (scheme.optimize) {
          scheme_data = scheme.optimize(scheme_data, optimize_one);
        }

        optimized[scheme_name] = scheme_data;
      }

      return optimized[scheme_name];
    }
  }

  encode (data, init_rom) {
    const rom = init_rom.clone();

    for (let scheme_name in this.schemes) {
      const scheme = this.schemes[scheme_name];
      scheme.encode(data[scheme_name], rom);
    }

    return rom;
  }

  format (data) {
    const formatted = {};

    for (let scheme_name in this.schemes) {
      let scheme = this.schemes[scheme_name];
      formatted[scheme_name] = scheme.format(data[scheme_name]);
    }

    return formatted;
  }

  get_extensions () {
    const extensions = {};

    for (let scheme_name in this.schemes) {
      extensions[scheme_name] = this.schemes[scheme_name].extension || 'txt';
    }

    return extensions;
  }
}

module.exports = Schema;
