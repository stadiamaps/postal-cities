const _ = require('lodash');
const through = require('through2');
const ZIP_PLUS_4 = /^[0-9]{5}-[0-9]{4}$/;
const withinUSA = (row) => {
  const lon = parseFloat(row.lon);
  const lat = parseFloat(row.lat);
  if (!isNaN(lon) && !isNaN(lat)) {
    if (_.inRange(lon, -170, -50) && _.inRange(lat, 25, 72)) {
      return true;
    }
  }
  return false;
};

function streamFactory(db){

  // create database tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS lastline (
      postcode TEXT NOT NULL,
      city TEXT NOT NULL,
      lon REAL NOT NULL,
      lat REAL NOT NULL,
      weight INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS aggregate (
      weight INTEGER NOT NULL,
      postcode TEXT NOT NULL,
      city TEXT NOT NULL,
      lon REAL NOT NULL,
      lat REAL NOT NULL
    );
    PRAGMA JOURNAL_MODE=OFF;
    PRAGMA SYNCHRONOUS=OFF;
    PRAGMA LOCKING_MODE=EXCLUSIVE;
    PRAGMA PAGE_SIZE=4096;
    PRAGMA CACHE_SIZE=100;
    PRAGMA TEMP_STORE=MEMORY;
  `);

  // Custom Median Function
  db.aggregate('median', {
    start: () => [],
    step: (array, nextValue) => {
      array.push(nextValue);
    },
    result: (array) => {
      array.sort((a, b) => a - b);
      const mid = Math.floor(array.length / 2);
      return (array.length % 2 !== 0) ? array[mid] : (array[mid - 1] + array[mid]) / 2;
    }
  });

  // prepare insert statement
  const stmt = db.prepare(`
    INSERT INTO lastline (postcode, city, lon, lat, weight)
    VALUES ($postcode, $city, $lon, $lat, $weight);
  `);

  // insert a row in the database per row of the TSV file
  const transform = (row, _, next) => {

    // truncate USA ZIP+4 postcodes to 5 digit ZIP codes
    if (row.postcode.length === 10) {
      if (ZIP_PLUS_4.test(row.postcode) && withinUSA(row)) {
        row.postcode = row.postcode.slice(0, 5);
      }
    }

    stmt.run(row);
    next();
  };

  // populate aggregate table after all rows imported
  // ensure that SQLite has enough tmp space
  // export SQLITE_TMPDIR=/large/directory
  const flush = (done) => {
    // TODO: This needs to be rewritten.
    // In SQLite, there is no enforcement that every column selected appears in GROUP BY. For every expression in a
    // query containing a GROUP BY that doesn't involve an aggregate expression, an arbitrary value will be selected.
    // The original implementation of this used just `lon` and `lat`, meaning that arbitrary values would be selected,
    // leading to completely nonsensical results in the presence of bad data.
    //
    // This attempts to avoid that by using a median aggregate, which should ignore outliers. HOWEVER......
    // TODO: This doesn't account for the fact that multiple countries use similar postal code formats, so
    // what we really need here is some sort of grouping by clusters, because two postal codes may be half a
    // world away from each other! For example, 33028 appears in the US, Lithuania, Germany, and Italy.
    // These are NOT the same!
    //
    // I'm also not quite sold on the trim business. As far as I can tell,
    // if a city name contains a comma, it trims the string to only return everything AFTER the comma, and I don't
    // understand why.
    db.exec(`
      PRAGMA TEMP_STORE=FILE;
      INSERT INTO aggregate
      SELECT
          SUM(weight) AS weight,
          TRIM(postcode) as postcode,
          TRIM(TRIM(SUBSTR(city, INSTR(city,',')),',')) as city,
          median(lon),
          median(lat)
      FROM lastline
      WHERE TRIM(postcode) != ''
      AND TRIM(city) != ''
      GROUP BY
          UPPER(REPLACE(TRIM(postcode),' ','')),
          UPPER(TRIM(TRIM(SUBSTR(city, INSTR(city,',')),',')))
      ORDER BY
          postcode ASC,
          weight DESC;
    `);
    done();
  };

  return through.obj(transform, flush);
}

module.exports = streamFactory;
