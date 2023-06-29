#!/bin/bash
set -e  # Abort if any command exits with a nonzero status
set -u  # Abort if an unset variable is referenced

# NOTE: Assumes that Placeholder is running. See the README for details.

PBF="$1"
OA_PATH="$2"
LEVELDB='/tmp'
TAGS='addr:postcode+addr:city'


curl -LsO https://github.com/pelias/pbf2json/raw/master/build/pbf2json.darwin-arm64
chmod +x pbf2json.darwin-arm64

# Generate TSV data for OpenAddresses and OSM respectively
time cat <(find "${OA_PATH}" \
  -type f \
  -name '*.csv' \
  -print0 \
    | xargs -0 awk \
      -F ',' \
      'FNR > 1 {if ($1 && $2 && $6 && $9) print $9 "\t" $6 "\t" $1 "\t" $2}') \
    <(./pbf2json.darwin-arm64 \
      -tags="${TAGS}" \
      -leveldb="${LEVELDB}" \
      "${PBF}" \
        | jq -r 'select(.tags."addr:postcode" != null) | select(.tags."addr:city" != null) | [.tags."addr:postcode", .tags."addr:city", (.lon + .centroid.lon), (.lat + .centroid.lat)] | @tsv') \
  | DB_FILENAME=osm.postcodes.db node import.js 1> lastline.out 2> lastline.err

# sort and unique-ify results
LC_ALL=C sort -t$'\t' -k9 -k2n -k1nr lastline.out \
    | awk -F $'\t' '{ key = $4 OFS $2 }; !seen[key]++' \
    > lastline.results.tsv

rm lastline.out

# divide each line in to country-code files
mkdir -p 'country'
cut -f9 lastline.results.tsv | uniq | while read cc; do
  awk -F $'\t' -v cc="$cc" '$9==cc {print $2 "\t" $4 "\t" $5 "\t" $6 "\t" $7 "\t" $1}' lastline.results.tsv \
    > "country/$cc.tsv"
done