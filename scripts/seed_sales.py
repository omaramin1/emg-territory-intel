#!/usr/bin/env python3
"""
Sales Orders Seeder for EMG Territory App
Loads large sales_orders.json into Supabase PostgreSQL database
Designed to handle 32,000+ records in batches
"""

import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional
import requests
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
BATCH_SIZE = 500
DATA_FILE = 'data/sales_orders.json'

def parse_date(date_str: Optional[str]) -> Optional[str]:
    """Parse date string to YYYY-MM-DD format"""
    if not date_str or date_str.strip() == '':
        return None
    try:
        # Handle format: "2026-02-22 00:00:00"
        if ' ' in date_str:
            date_str = date_str.split(' ')[0]
        return date_str
    except Exception:
        return None

def map_lmi_type(lmi_qualification: Optional[str], program_type: Optional[str]) -> Optional[str]:
    """Map LMI qualification type to lmi_program_type enum"""
    if not lmi_qualification and not program_type:
        return None

    lmi_str = (lmi_qualification or '').lower()
    prog_str = (program_type or '').lower()

    # Map various LMI qualification strings to enum values
    if 'medicaid' in lmi_str:
        return 'Medicaid'
    elif 'snap' in lmi_str or 'food stamps' in lmi_str or 'ebt' in lmi_str:
        return 'SNAP'
    elif 'liheap' in lmi_str or 'energy assistance' in lmi_str:
        return 'LIHEAP'
    elif 'lifeline' in lmi_str or 'usac' in lmi_str:
        return 'Lifeline'
    elif 'free lunch' in lmi_str:
        return 'Free Lunch'
    elif 'reduced lunch' in lmi_str:
        return 'Reduced Lunch'
    elif 'lmi' in prog_str:
        return 'Other'

    return None

def map_order_status(status_str: Optional[str]) -> str:
    """Map order status to order_status_enum"""
    if not status_str:
        return 'Draft'

    status = status_str.strip().lower()

    # Valid enum values: Test, Draft, Pending, Sent, Payable, Completed, Cancelled, Duplicate, Invalid
    status_map = {
        'test': 'Test',
        'draft': 'Draft',
        'pending': 'Pending',
        'sent': 'Sent',
        'payable': 'Payable',
        'completed': 'Completed',
        'complete': 'Completed',
        'cancelled': 'Cancelled',
        'cancel': 'Cancelled',
        'duplicate': 'Duplicate',
        'invalid': 'Invalid',
    }

    for key, value in status_map.items():
        if key in status:
            return value

    return 'Draft'

def map_dwelling_type(dwelling_str: Optional[str]) -> Optional[str]:
    """Map dwelling type to dwelling_type_enum"""
    if not dwelling_str:
        return None

    dwelling = dwelling_str.strip().lower()

    # Valid enum values: Single Family Home, Apartment (MDU), Townhouse, Condo, Mobile Home, Unknown, Commercial
    dwelling_map = {
        'single family': 'Single Family Home',
        'sfh': 'Single Family Home',
        'apartment': 'Apartment (MDU)',
        'mdu': 'Apartment (MDU)',
        'multi-unit': 'Apartment (MDU)',
        'townhouse': 'Townhouse',
        'condo': 'Condo',
        'mobile': 'Mobile Home',
        'commercial': 'Commercial',
    }

    for key, value in dwelling_map.items():
        if key in dwelling:
            return value

    return 'Unknown'

def extract_zip_from_address(address: Optional[str]) -> Optional[str]:
    """Extract ZIP code from customer address"""
    if not address:
        return None

    # Address format: "212 Chowan Dr, Apt E, Portsmouth, VA, 23701"
    # Try to get the last 5-digit segment
    parts = address.split(',')
    for part in reversed(parts):
        cleaned = part.strip()
        if len(cleaned) == 5 and cleaned.isdigit():
            return cleaned

    return None

def extract_state_from_address(address: Optional[str]) -> Optional[str]:
    """Extract state from customer address"""
    if not address:
        return None

    # Address format: "212 Chowan Dr, Apt E, Portsmouth, VA, 23701"
    parts = address.split(',')
    for part in parts:
        cleaned = part.strip()
        if len(cleaned) == 2 and cleaned.isalpha():
            return cleaned

    return None

def extract_city_from_address(address: Optional[str]) -> Optional[str]:
    """Extract city from customer address"""
    if not address:
        return None

    # Address format: "212 Chowan Dr, Apt E, Portsmouth, VA, 23701"
    # City is typically before the state
    parts = address.split(',')
    if len(parts) >= 3:
        # Return the part before the state (VA)
        return parts[-3].strip()
    elif len(parts) == 2:
        return parts[0].strip()

    return None

def transform_record(raw_record: Dict[str, Any]) -> Dict[str, Any]:
    """Transform raw sales order record to database schema"""
    return {
        'customer_name': raw_record.get('Customer Name') or None,
        'address': raw_record.get('Customer Address') or None,
        'city': extract_city_from_address(raw_record.get('Customer Address')),
        'state': extract_state_from_address(raw_record.get('Customer Address')),
        'zip_code': extract_zip_from_address(raw_record.get('Customer Address')),
        'sale_date': parse_date(raw_record.get('Sale Date')),
        'order_status': map_order_status(raw_record.get('Order Status')),
        'lmi_type': map_lmi_type(
            raw_record.get('LMI Qualification Type'),
            raw_record.get('Program Type')
        ),
        'dwelling_type': map_dwelling_type(raw_record.get('Dwelling Type')),
        'kwh': None,  # Not in source data
        'rep_name': raw_record.get('Rep Name') or None,
        'source_file': raw_record.get('Source File') or None,
        'zone_id': None,  # Will be populated separately if needed
    }

def supabase_insert_batch(batch: List[Dict[str, Any]], batch_num: int) -> bool:
    """Insert a batch of records via Supabase REST API"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print('ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
        return False

    url = f'{SUPABASE_URL}/rest/v1/sales_records'
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',  # Don't return inserted rows
    }

    try:
        response = requests.post(url, json=batch, headers=headers, timeout=30)

        if response.status_code in [200, 201]:
            print(f'  Batch {batch_num}: inserted {len(batch)} records')
            return True
        else:
            print(f'  Batch {batch_num}: ERROR {response.status_code}')
            print(f'  Response: {response.text[:200]}')
            return False
    except requests.exceptions.RequestException as e:
        print(f'  Batch {batch_num}: Request failed - {str(e)}')
        return False

def load_and_seed():
    """Load sales_orders.json and seed to Supabase"""

    print('=' * 70)
    print('EMG Territory App - Sales Orders Seeder')
    print('=' * 70)
    print()

    # Validate environment
    if not SUPABASE_URL:
        print('ERROR: NEXT_PUBLIC_SUPABASE_URL not set in environment')
        sys.exit(1)
    if not SUPABASE_KEY:
        print('ERROR: SUPABASE_SERVICE_ROLE_KEY not set in environment')
        sys.exit(1)

    print(f'Supabase URL: {SUPABASE_URL}')
    print()

    # Check file exists
    if not os.path.exists(DATA_FILE):
        print(f'ERROR: {DATA_FILE} not found')
        sys.exit(1)

    file_size_mb = os.path.getsize(DATA_FILE) / (1024 * 1024)
    print(f'Loading {DATA_FILE} ({file_size_mb:.1f} MB)...')
    print()

    # Load JSON
    try:
        with open(DATA_FILE, 'r') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f'ERROR: Failed to parse JSON - {str(e)}')
        sys.exit(1)

    metadata = data.get('metadata', {})
    sales_orders = data.get('sales_orders', [])

    total_records = len(sales_orders)
    print(f'Metadata: {metadata.get("total_records", 0)} records (file says)')
    print(f'Actual sales_orders array: {total_records} records')
    print()

    if total_records == 0:
        print('WARNING: No sales orders found in file')
        return

    # Transform records
    print('Transforming records...')
    transformed = []
    skipped = 0

    for i, raw in enumerate(sales_orders):
        try:
            transformed.append(transform_record(raw))
        except Exception as e:
            print(f'  Warning: Record {i} transform failed - {str(e)}')
            skipped += 1

    valid_count = len(transformed)
    print(f'  Transformed: {valid_count} records ({skipped} skipped)')
    print()

    # Batch and insert
    print(f'Inserting records in batches of {BATCH_SIZE}...')
    print()

    successful_batches = 0
    failed_batches = 0

    for batch_num in range(0, len(transformed), BATCH_SIZE):
        batch = transformed[batch_num:batch_num + BATCH_SIZE]
        batch_index = (batch_num // BATCH_SIZE) + 1
        total_batches = (len(transformed) + BATCH_SIZE - 1) // BATCH_SIZE

        print(f'[{batch_index}/{total_batches}]', end=' ')

        if supabase_insert_batch(batch, batch_index):
            successful_batches += 1
        else:
            failed_batches += 1

    print()
    print('=' * 70)
    print('SEEDING COMPLETE')
    print('=' * 70)
    print(f'Total records processed: {valid_count}')
    print(f'Successful batches: {successful_batches}')
    print(f'Failed batches: {failed_batches}')
    print()

    if failed_batches > 0:
        print('WARNING: Some batches failed. Check database and retry.')
        sys.exit(1)

    print('SUCCESS: All records inserted!')

if __name__ == '__main__':
    load_and_seed()
