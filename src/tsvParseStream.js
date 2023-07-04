const through = require('through2');
const wofPostalLookup = require('./wofPostalLookup');

function streamFactory(){
  return through.obj(function( row, _, next ){

    try {
      const columns = row.toString('utf8').split('\t');

      // Postcode, City Name, Longitude, Latitude
      if (columns.length !== 4) {
        throw new Error(`invalid column count: ${columns.length}`);
      }

      const postalCode = columns[0].trim();
      const lon = columns[2].trim();
      const lat = columns[3].trim();

      // TODO: At some point this should have improved handling of multiple results; I don't think it's an issue currently
      // since AFAIK this data is only available in the US so there should not be any conflicting records.
      // If the data becomes more broadly available though, we will want to have some sort of either filtering or ranking
      // so that irrelevant records (ex: from another country) don't screw it up.
      for (const result of wofPostalLookup(postalCode)) {
        const num_alts = result.postal_locality_alt.length;
        // Add city with mz:postal_locality here if it exists.
        // TODO: I'm not quite sure what the best solution is to be honest, but the coordinate selection for large areas is a problem.
        // Adding postal code coords from WOF can mess with the original address data. These probably should be
        // location-less strings (or heck, even postcode entries would work), not full localities.
        //
        // An example problematic postal code is 99701.
        const primary = {
          postcode: postalCode,
          city: result.postal_locality,
          lon: result.lon,
          lat: result.lat,
          weight: num_alts + 2
        };

        this.push(primary);

        // Push any alts as well
        for (let i = 0; i < num_alts; ++i) {
          const alt = result.postal_locality_alt[i];
          this.push({
            postcode: postalCode,
            city: alt,
            lon: lon,
            lat: lat,
            weight: num_alts - i + 1
          });
        }
      }

      this.push({
        postcode: postalCode,
        city: columns[1].trim(),
        lon: lon,
        lat: lat,
        weight: 1
      });
    } catch( e ){
      console.error('invalid tsv row', e);
      console.error(row);
    }

    next();
  });
}

module.exports = streamFactory;
