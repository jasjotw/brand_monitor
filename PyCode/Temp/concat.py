import glob
import json
import os
import sys

def main():
    # Check if the user provided folder arguments
    if len(sys.argv) != 3:
        print("Usage: python merge_json.py <date-folder> <subfolder>")
        print("Example: python merge_json.py 2025-10-17 QORWeb_files")
        sys.exit(1)

    date_folder = sys.argv[1]      # e.g., "2025-10-17"
    subfolder = sys.argv[2]        # e.g., "QORWeb_files"

    # Construct the path to the JSON folder dynamically using an absolute path
    json_folder = os.path.join("/home/cygwin/GEO/output/logs", date_folder, subfolder)

    if not os.path.exists(json_folder):
        print(f"Folder does not exist: {json_folder}")
        sys.exit(1)

    # Get all JSON files in that folder, sorted for deterministic merging
    json_files = sorted(glob.glob(os.path.join(json_folder, "*.json")))
    
    # Exclude the final output file from being read as an input
    output_filename = "final_concatenated.json"
    json_files = [f for f in json_files if os.path.basename(f) != output_filename]

    if not json_files:
        print(f"No source JSON files found in {json_folder} (excluding {output_filename})")
        sys.exit(1)

    merged_data = {}
    for file_path in json_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
                
                # The data in a file can be a single object or a list of objects
                if not isinstance(data, list):
                    data = [data]

                for item in data:
                    if not isinstance(item, dict):
                        continue # Skip non-object items in lists
                    for key, value in item.items():
                        # If value is not None and key doesn't exist, add it.
                        # This logic keeps the first non-null value found for each key.
                        if value is not None and key not in merged_data:
                            merged_data[key] = value

            except json.JSONDecodeError:
                print(f"Warning: Skipping {file_path} because it contains invalid JSON.")
                continue

    # Save the merged dictionary as a single JSON object
    output_file = os.path.join(json_folder, output_filename)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(merged_data, f, indent=4)

    print(f"JSON files were merged into a single document.")
    print(f"Output saved at: {output_file}")
    print("\nYou can now import this file into MongoDB. Remember to remove the --jsonArray flag.")
    print(f'''Example: mongoimport --uri="mongodb+srv://<user>:<password>@..." --db=welzin --collection=geo --file={output_file}''')

if __name__ == "__main__":
    main()
