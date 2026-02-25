"""
MAIN ENTRY POINT FOR PYCODE
Centralized script to run various database operations and utilities.

Created by: Aman Mundra
Date: 2026-02-04
"""

from config.database.mongoDB import main as mongo_main
from config.database.qdrantDB import main as qdrant_main
from config.database.neonDB import main as neon_main


def main():
    """Main function to run database operations."""
    print("\n" + "="*60)
    print("PyCode Database Operations")
    print("="*60 + "\n")

    results = {}

    # Run MongoDB inspection
    print("Running MongoDB inspection...")
    mongo_success = mongo_main()
    results['MongoDB'] = mongo_success

    print("\n" + "-"*60 + "\n")

    # Run Qdrant inspection
    print("Running Qdrant inspection...")
    qdrant_success = qdrant_main()
    results['Qdrant'] = qdrant_success

    print("\n" + "-"*60 + "\n")

    # Run Neon inspection
    print("Running Neon inspection...")
    neon_success = neon_main()
    results['Neon'] = neon_success

    # Summary
    print("\n" + "="*60)
    print("Operations Summary:")
    print("="*60)
    for db_name, success in results.items():
        status = "✅ Success" if success else "❌ Failed"
        print(f"  {db_name}: {status}")

    all_success = all(results.values())
    if all_success:
        print("\n✅ All operations completed successfully")
    else:
        print("\n⚠️  Some operations failed - check logs for details")

    return all_success


if __name__ == "__main__":
    main()
