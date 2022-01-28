function tokenize (string) {
  return string.split('\n').map(tokenize_line).filter(tokens => tokens.length);
}

function tokenize_line (string) {
  const tokens = [];
  let i = 0;
  let start = i;
  let length = string.length;

  function add (type, value) {
    tokens.push({ type, value, col: start });
  }

  function error (msg) {
    let context = string.slice(i - 10, i + 10);
    throw new Error(`${msg} (${context})`);
  }

  function getWord (regex) {
    const init = i;
    while (i < length && regex.test(string[i])) {
      i++;
    }
    if (i - init === 0) {
      error(`Invalid word starting with ${string[init]}`);
    }
    return string.slice(start, i);
  }

  while (i < length) {
    start = i;
    let curr = string[i];

    // Comments
    if (curr === ';') {
      //add('comment', string.slice(start));
      break;
    }

    // New Line
    if (curr === ':') {
      add('new_line');
      ++i;
      continue;
    }

    // Whitespace
    if (curr === ' ') {
      if (start === 0) {
        add('indent', getWord(/ /));
      } else {
        ++i;
      }
      continue;
    }

    // Variables
    if (curr === '!') {
      i++;
      add('variable', getWord(/\w/));
      continue;
    }

    // Hex
    if (curr === '$') {
      i++;
      add('hex', getWord(/[0-9A-F]/));
      continue;
    }

    // Literal or Repeater
    if (curr === '#') {
      i++;
      if (string[i] === '$') {
        i++;
        add('literal', getWord(/[0-9A-F]/));
      } else {
        add('repeater', getWord(/\d/));
      }
      continue;
    }

    // Assign variable value
    if (curr === '=') {
      add('assign');
      i++;
      continue;
    }

    // Comma (for db separation or indexing)
    if (curr === ',') {
      add('comma');
      i++;
      continue;
    }

    // Support addition
    if (curr === '+') {
      add('plus');
      i++;
      continue;
    }

    // Sublabel
    if (curr === '.') {
      add('sublabel', getWord(/\w/));
      continue;
    }

    // Label or operation
    if (/[A-Za-z]/.test(curr)) {
      const label = getWord(/\w/);
      if (string[i] === ':') { 
        i++;
        add('label', label);
      } else {
        add('word', label);
      }
      continue;
    }

    // Decimal number (used with addition)
    if (/[1-9]/.test(curr)) {
      add('number', getWord(/\d/));
      continue;
    }

    // No match
    return error(`Unknown token: ${curr}`);
  }

  return tokens;
}

function tokenizeFile (path) {
  const str = require('fs').readFileSync(path).toString();
  return tokenize(str);
}

module.exports = {
  tokenize,
  tokenizeFile
};
