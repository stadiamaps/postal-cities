const Sqlite3 = require('better-sqlite3');
const postalDbFile = process.env.POSTAL_DB_FILENAME;
const db = new Sqlite3(postalDbFile);

var cache = {};

const sql = `
        SELECT g.body, name
        FROM geojson g
        INNER JOIN spr s ON g.id = s.id
        WHERE
            g.body IS NOT NULL
            AND g.body != ''
            AND s.parent_id > 1
            AND s.is_current = 1
            AND s.placetype = 'postalcode';
    `;

const rows = db.prepare(sql).all();

for (const row of rows) {
  const geojson = JSON.parse(row.body);

  if ('properties' in geojson && 'mz:postal_locality' in geojson.properties &&
    'geom:latitude' in geojson.properties && 'geom:longitude' in geojson.properties) {
    const lat = geojson.properties['geom:latitude'];
    const lon = geojson.properties['geom:longitude'];
    const postal_locality = geojson.properties['mz:postal_locality'];
    const postal_locality_alt = geojson.properties['mz:postal_locality_alt'] || [];

    if (!(row.name in cache)) {
      cache[row.name] = [];
    }

    cache[row.name].push({
      lat, lon, postal_locality, postal_locality_alt
    });
  }
}

function getPostalLocalities(postalcode) {
    return cache[postalcode] || [];
}

module.exports = getPostalLocalities;