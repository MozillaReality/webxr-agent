const fs = require('fs');
const path = require('path');

const globHash = require('glob-hash');

const PUBLIC_DIR = path.join(__dirname, '..', 'public', '**');
const HASH_JS_FILENAME = path.join(__dirname, '..', '.hashes.json');

const generateHash = module.exports = (opts) => {
  opts = opts || {};
  let includeList = opts.includeList;
  if (typeof opts.includeList === 'undefined') {
    includeList = [PUBLIC_DIR];
  } else if (typeof opts.includeList === 'string') {
    includeList = [opts.includeList];
  }

  return globHash({
    include: includeList
  }).then(hash => {
    return new Promise((resolve, reject) => {
      fs.writeFile(HASH_JS_FILENAME, JSON.stringify({public: hash}, null, 2) + '\n', err => {
        if (err) {
          reject(err);
        } else {
          resolve(hash);
        }
      });
    });
  });
};

if (!module.parent) {
  generateHash().then(hash => {
    console.log('Generated hash: %s', hash);
  }).catch(err => {
    console.error('Could not generate hash:', err);
  });
}
