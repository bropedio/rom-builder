"use strict";

module.exports = {
  write_sheet: write_sheet,
  read_sheet: read_sheet
};

function write_sheet (json_array) {
  const flat_data = json_array.map(flatten);
  const headers = {};

  flat_data.forEach(flat => {
    for (let key in flat) {
      headers[key] = true;
    }
  });

  const columns = Object.keys(headers);
  const rows = [columns.join('\t')];

  flat_data.forEach(json => {
    rows.push(columns.map(col => {
      return encode_value(json[col], col);
    }).join('\t'));
  });
  
  return rows.join('\n');
}

function encode_value (value, heading) {
  if (value == null) return '-';
  if (Array.isArray(value)) return value.join(',');
  return value;
}

function read_sheet (string) {
  const rows = string.split('\n').map(row => row.split('\t'));
  const headers = rows[0];

  return rows.slice(1).map(row => {
    const json = {};
    row.forEach((col, i) => {
      const head = headers[i];
      json[head] = JSON.parse(col);
    });
    return json;
  });
}

function flatten (obj) {
  var flat = {};
  process_keys(obj, '');
  return flat;

  function process_keys (obj, prefix) {
    for (var key in obj) {
      var value = obj[key];
      var full_key = prefix + key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        process_keys(value, full_key + ':');
      } else {
        flat[full_key] = value;
      }
    }
  }
}
