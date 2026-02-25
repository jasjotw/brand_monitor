############################################################################################################
#
# Store Data in MongoDB (welzin database, geo collection)
#
# Step 1: The program loads customer assessment data from a JSON file.
# Step 2: It extracts the customer_name and prepares a logger for tracking operations.
# Step 3: It connects to MongoDB (welzin database, geo collection).
# Step 4: It checks if the customer already exists:
#         ->  If yes → updates their record with new data.
#         -> If no → inserts a new record.
#
# How to run: python3 mongoDB_append.py (Arg1, Arg2, ...)
#
# Developers: Aman, Ishan
#
# ToDo: 
# seed_db(customer_name, ) - create a empty record for the new customer with full schema
# insert_db(PK, date, columns) - insert a new record on the basis of date
# update_db(PK, date, columns) - update the existing record with new data
# main() - orchestrates the workflow
# It is properly, modularly, and efficiently structured.
# Implement proper logs and error handling.





# import sys
# import json
# from pymongo import MongoClient


# #  Read JSON data from stdin

# try:
#     # Read the entire stdin input (n8n passes JSON here)
#     input_data = sys.stdin.read().strip()

#     if not input_data:
#         print("⚠️ No input data received from stdin.")
#         sys.exit(0)

#     # Parse JSON data
#     merge_data = json.loads(input_data)

#     # If n8n sends array of items with {"json": {...}}, extract them
#     if isinstance(merge_data, list) and "json" in merge_data[0]:
#         merge_data = [item["json"] for item in merge_data]

# except json.JSONDecodeError as e:
#     print("❌ Error decoding JSON from stdin:", e)
#     sys.exit(1)


# #  Connect to MongoDB

# try:
#       
#     db = client["welzin"]                       
#     collection = db["geo"]                     
# except Exception as e:
#     print("❌ MongoDB connection error:", e)
#     sys.exit(1)


# try:
#     if merge_data:
#         collection.insert_many(merge_data)
#         print(f"✅ Inserted {len(merge_data)} records into MongoDB.")
#     else:
#         print("⚠️ No records to insert.")
# except Exception as e:
#     print("❌ MongoDB insertion error:", e)






# import sys
# import json
# from pymongo import MongoClient

# # -----------------------------
# # 1️⃣ Read JSON data from stdin
# # -----------------------------
# try:
#     input_data = sys.stdin.read().strip()
#     if not input_data:
#         print("⚠️ No input data received from stdin.")
#         sys.exit(0)

#     # Parse JSON
#     merge_data = json.loads(input_data)

#     # If n8n sends array of items with {"json": {...}}, extract them
#     if isinstance(merge_data, list) and "json" in merge_data[0]:
#         merge_data = [item["json"] for item in merge_data]

# except json.JSONDecodeError as e:
#     print("❌ Error decoding JSON from stdin:", e)
#     sys.exit(1)

# # -----------------------------
# # 2️⃣ Connect to MongoDB
# # -----------------------------
# try:
#     client = MongoClient(
#         "mongodb+srv://Welzin:yYsuyoXrWcxPKmPV@welzin.1ln7rs4.mongodb.net/welzin?retryWrites=true&w=majority&appName=Welzin"
#     )
#     db = client["welzin"]
#     collection = db["geo"]
# except Exception as e:
#     print("❌ MongoDB connection error:", e)
#     sys.exit(1)

# # -----------------------------
# # 3️⃣ Insert in Batches to Avoid Limits
# # -----------------------------
# batch_size = 500  # safe batch size, adjust as needed
# try:
#     total = len(merge_data)
#     if total == 0:
#         print("⚠️ No records to insert.")
#         sys.exit(0)

#     for i in range(0, total, batch_size):
#         batch = merge_data[i:i + batch_size]
#         collection.insert_many(batch)
#         print(f"✅ Inserted batch {i//batch_size + 1}: {len(batch)} records")

#     print(f"🎉 Successfully inserted {total} records into MongoDB!")

# except Exception as e:
#     print("❌ MongoDB insertion error:", e)





import sys
import json
import tempfile
import os
from pymongo import MongoClient

# -----------------------------
# 1️⃣ Read JSON data from file instead of stdin
# -----------------------------
try:
    # n8n should write data to a temp file and pass the path as argument
    if len(sys.argv) > 1:
        file_path = sys.argv[1].strip().strip('"').strip("'")
    else:
        # Manually ask for file path if not passed as argument
        file_path = input("📂 Enter the path to the JSON file: ").strip().strip('"').strip("'")

    with open(file_path, 'r', encoding='utf-8') as f:
        input_data = f.read()

    if not input_data:
        print("⚠️ No input data received.")
        sys.exit(0)

    # Parse JSON
    merge_data = json.loads(input_data)

    # If n8n sends array of items with {"json": {...}}, extract them
    if isinstance(merge_data, list) and len(merge_data) > 0 and "json" in merge_data[0]:
        merge_data = [item["json"] for item in merge_data]

except json.JSONDecodeError as e:
    print(f"❌ Error decoding JSON: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error reading input: {e}")
    sys.exit(1)

# -----------------------------
# 2️⃣ Connect to MongoDB
# -----------------------------
try:
    client = MongoClient(
        "mongodb+srv://Welzin:yYsuyoXrWcxPKmPV@welzin.1ln7rs4.mongodb.net/welzin?retryWrites=true&w=majority&appName=Welzin",
        serverSelectionTimeoutMS=5000
    )
    db = client["welzin"]
    collection = db["geo"]
    # Test connection
    client.server_info()
except Exception as e:
    print(f"❌ MongoDB connection error: {e}")
    sys.exit(1)

# -----------------------------
# 3️⃣ Insert in Batches
# -----------------------------
batch_size = 500
try:
    total = len(merge_data)
    if total == 0:
        print("⚠️ No records to insert.")
        sys.exit(0)

    inserted_count = 0
    for i in range(0, total, batch_size):
        batch = merge_data[i:i + batch_size]
        result = collection.insert_many(batch, ordered=False)
        inserted_count += len(result.inserted_ids)
        print(f"✅ Inserted batch {i // batch_size + 1}: {len(batch)} records")

    print(f"🎉 Successfully inserted {inserted_count} records into MongoDB!")

except Exception as e:
    print(f"❌ MongoDB insertion error: {e}")
    sys.exit(1)
finally:
    client.close()































# import sys
# import json
# from pymongo import MongoClient
# from datetime import datetime, timezone
# sys.path.insert(0, "/home/cygwin/GEO")
# from utils.logging_config import setup_logging


# def create_empty_customer_record(customer_name):
#     return {
#         "customer_name": customer_name,
#         "date": datetime.now(timezone.utc).isoformat(),
#         "site_url": None,
#         "Email_id": None,
#         "sitemap_link": [],
#         "robots_txt": None,
#         "schema_org": None,
#         "llms_txt": None,
#         "keywords": [],
#         "metadata": None,
#         "landng_page": None,
#         "business_domain": None,
#         "search_queries": [],
#         "site_analysis": {
#             "links_analysis": [],
#         },
#         "personas": [],
#         "qa_pairs": None,
#         "proposed_robots_content": None,
#         "proposed_llms_content": None,
#         "proposed_schema_org_content": None,
#         "extra_fields1": {},
#         "extra_fields2": [],
#         "extra_fields3": None,
#     }


# def get_collection():
#     client = MongoClient(
#         "mongodb+srv://Welzin:yYsuyoXrWcxPKmPV@welzin.1ln7rs4.mongodb.net/welzin?retryWrites=true&w=majority&appName=Welzin"
#     )
#     db = client["welzin"]
#     return client, db["geo"]


# def insert_from_file(file_path, logger=None):
#     """
#     Read assessment JSON file and insert/update into MongoDB.
#     """
#     with open(file_path, "r") as f:
#         data = json.load(f)

#     customer_name = data["customer_name"]
#     date = datetime.now(timezone.utc).isoformat()
#     data["date"] = date  # ensure date field exists

#     insert_db(customer_name, date, data, logger)
#     return data



# def insert_db(customer_name, date, columns, logger):
#     client, collection = get_collection()
#     try:
#         filter_criteria = {"customer_name": customer_name}
#         existing_record = collection.find_one(filter_criteria, sort=[("date", -1)])

#         if not existing_record:
#             print(f"No record found for {customer_name}, creating empty record...")
#             logger.info(f"No record found for {customer_name}, creating empty record...")
#             new_record = create_empty_customer_record(customer_name)
#             new_record.update(columns)
#             new_record["date"] = date
#             collection.insert_one(new_record)
#             logger.info(f"Inserted new record for {customer_name} on {date}")
#             return

#         changes = {k: v for k, v in columns.items() if k != "date" and existing_record.get(k) != v}

#         if not changes:
#             logger.info(f"⚡ No changes detected for {customer_name}, skipping insert.")
#             return

#         old_date = existing_record.get("date")
#         if old_date.split("T")[0] != date.split("T")[0]:
#             new_record = create_empty_customer_record(customer_name)
#             new_record.update({**existing_record, **columns})
#             new_record["date"] = date
#             new_record.pop("_id", None)
#             collection.insert_one(new_record)
#             logger.info(f" Inserted new version for {customer_name} on {date}")
#         else:
#             collection.update_one(
#                 {"_id": existing_record["_id"]},
#                 {"$set": {**changes, "date": date}}
#             )
#             logger.info(f" Updated today's record for {customer_name} with changes: {list(changes.keys())}")

#     except Exception as e:
#         logger.error(f" Error in insert_db for {customer_name}: {e}", exc_info=True)
#     finally:
#         client.close()


# def update_db(customer_name, columns, logger):
#     client, collection = get_collection()
#     try:
#         filter_criteria = {"customer_name": customer_name}
#         existing_record = collection.find_one(filter_criteria, sort=[("date", -1)])

#         date = datetime.now(timezone.utc).isoformat()

#         if not existing_record:
#             print(f"No record found for {customer_name}, creating empty record...")
#             logger.info(f"No record found for {customer_name}, creating empty record...")
#             new_record = create_empty_customer_record(customer_name)
#             new_record.update(columns)
#             new_record["date"] = date
#             collection.insert_one(new_record)
#             logger.info(f" Inserted new record for {customer_name} on {date}")
#             return

#         changes = {k: v for k, v in columns.items() if k != "date" and existing_record.get(k) != v}

#         if not changes:
#             logger.info(f"⚡ No changes detected for {customer_name}, skipping update.")
#             return

#         old_date = existing_record.get("date")
#         if old_date.split("T")[0] != date.split("T")[0]:
#             new_record = create_empty_customer_record(customer_name)
#             new_record.update(existing_record)
#             new_record.update(columns)
#             new_record["date"] = date
#             new_record.pop("_id", None)
#             collection.insert_one(new_record)
#             logger.info(f"🆕 Inserted new version (merged) for {customer_name} on {date}")
#         else:
#             collection.update_one(
#                 {"_id": existing_record["_id"]},
#                 {"$set": {**changes, "date": date}}
#             )
#             logger.info(f" Updated today's record for {customer_name} with changes: {list(changes.keys())}")

#     except Exception as e:
#         logger.error(f" Error in update_db for {customer_name}: {e}", exc_info=True)
#     finally:
#         client.close()


# def main():
#     mode = sys.argv[1] if len(sys.argv) > 1 else "insert"
#     input_data = sys.stdin.read().strip()
#     if not input_data:
#         print(json.dumps({
#             "status": "error",
#             "message": " No input data provided"
#         }))
#         return None

#     try:
#         data = json.loads(input_data)
#     except json.JSONDecodeError as e:
#         print(json.dumps({
#             "status": "error",
#             "message": f"Invalid JSON input: {e}"
#         }))
#         return None

#     customer_name = data["customer_name"]
#     logger = setup_logging(customer_name, __file__)

#     date = datetime.now(timezone.utc).isoformat()
#     data["date"] = date

#     try:
#         if mode == "insert":
#             insert_db(customer_name, date, data, logger)
#         elif mode == "update":
#             update_db(customer_name, data, logger)
#         else:
#             print(json.dumps({
#                 "status": "error",
#                 "message": f" Unknown mode: {mode}"
#             }))
#             return None
#     except Exception as e:
#         logger.error(f" Unexpected error in main: {e}", exc_info=True)
#         print(json.dumps({
#             "status": "error",
#             "message": f"Unexpected error: {e}"
#         }))
#         return None

#     return data


# if __name__ == "__main__":
#     crawled_data = main()
#     if crawled_data:
#         print(json.dumps({
#             "status": "success",
#             "message": "Record inserted/updated in MongoDB",
#             "data": crawled_data
#         }))


