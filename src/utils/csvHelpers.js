// src/utils/csvHelpers.js
const csv = require('fast-csv');

function streamToJsonArray(readStream) {
  return new Promise((resolve, reject) => {
    const results = [];
    const parser = csv.parse({ headers: true, trim: true })
      .on('error', err => reject(err))
      .on('data', row => results.push(row))
      .on('end', rowCount => resolve(results));
    readStream.pipe(parser);
  });
}

module.exports = { streamToJsonArray };
