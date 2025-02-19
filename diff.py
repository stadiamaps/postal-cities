import sys

def print_records(records):
    for record_id, name, weight in records:
        print(f'\tID: {record_id}, Name: {name}, Weight: {weight}')

def read_file(file_path):
    data = {}
    with open(file_path, 'r') as file:
        for line in file:
            postal_code, record_id, name, _, _, weight = line.strip().split('\t')
            if postal_code not in data:
                data[postal_code] = []
            data[postal_code].append((record_id, name, int(weight)))
    return data

def compare_files(old_file, new_file):
    old_data = read_file(old_file)
    new_data = read_file(new_file)
    removed_records = []
    changed_ids = 0
    changed_names = 0

    for postal_code, old_records in old_data.items():
        # Check if postal code is present in the new file
        if postal_code in new_data:
            new_records = new_data[postal_code]

            # Check if the first ID+name record associated with the postal code is different
            old_first_record = old_records[0] if old_records else None
            new_first_record = new_records[0] if new_records else None

            if new_first_record and not old_first_record:
                pass  # no action
            elif old_first_record[0] != new_first_record[0] or old_first_record[1].lower() != new_first_record[1].lower():
                if old_first_record[2] <= 3 and new_first_record[2] <= 3:
                    continue
                if old_first_record[1].lower() == new_first_record[1].lower():
                    changed_ids += 1
                    change_type = "ID"
                    print(f'Postal code: {postal_code} changed ID {old_first_record[0]} -> {new_first_record[0]}')
                else:
                    changed_names += 1

                    print(f'Postal code: {postal_code} changed name {old_first_record[1]} ({old_first_record[0]}) -> {new_first_record[1]} ({new_first_record[0]})')
                    print('Old records:')
                    print_records(old_records)

                    print('New records:')
                    print_records(new_records)
                    print()
        elif len(postal_code) == 5 and postal_code.isdigit() and old_records[0][2] > 5:
            removed_records.append(postal_code)

    print("Summary:")
    print(f"\tChanged IDs (same name): {changed_ids}")
    print(f"\tChanged names: {changed_names}")
    print(f"\tRemoved records): {len(removed_records)}")
    print(removed_records)

if __name__ == '__main__':
    old_file_path = sys.argv[1]
    new_file_path = sys.argv[2]
    compare_files(old_file_path, new_file_path)
