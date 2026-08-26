#!/usr/bin/env python3
"""
Backend API Testing for Arvicon Operations & Inventory Management
Tests 4 new endpoints:
1. POST /api/sales-order (Sales Order Wizard with auto-reservation)
2. POST /api/insights/recompute (Alert regeneration)
3. POST /api/excel/preview (Excel validation)
4. POST /api/excel/commit (Excel import with per-row actions)
"""

import requests
import json
import os
from datetime import datetime
import io
import openpyxl
from openpyxl import Workbook

# Load base URL from environment
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://inventory-pro-1114.preview.emergentagent.com')
API_BASE = f"{BASE_URL}/api"

print(f"Testing API at: {API_BASE}")
print("=" * 80)

# Test results tracking
test_results = {
    'passed': 0,
    'failed': 0,
    'tests': []
}

def log_test(name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"  Details: {details}")
    test_results['tests'].append({'name': name, 'passed': passed, 'details': details})
    if passed:
        test_results['passed'] += 1
    else:
        test_results['failed'] += 1

def print_response(resp):
    """Print response for debugging"""
    print(f"  Status: {resp.status_code}")
    try:
        print(f"  Body: {json.dumps(resp.json(), indent=2)[:500]}")
    except Exception:
        print(f"  Body: {resp.text[:500]}")

# ============================================================================
# TEST 1: POST /api/sales-order (Sales Order Wizard)
# ============================================================================
print("\n" + "=" * 80)
print("TEST 1: POST /api/sales-order (Sales Order Wizard)")
print("=" * 80)

try:
    # Get a customer
    print("\n1.1: Getting customer for sales order...")
    resp = requests.get(f"{API_BASE}/customers")
    print_response(resp)
    customers = resp.json().get('data', [])
    if not customers:
        log_test("Get customers", False, "No customers found")
    else:
        customer = customers[0]
        customer_id = customer['id']
        log_test("Get customers", True, f"Found customer: {customer.get('company_name', 'N/A')}")
        
        # Get available inventory
        print("\n1.2: Getting available inventory...")
        resp = requests.get(f"{API_BASE}/inventory?status=available")
        print_response(resp)
        inventory = resp.json().get('data', [])
        if not inventory:
            log_test("Get available inventory", False, "No available inventory found")
        else:
            inv_item = inventory[0]
            inventory_id = inv_item['id']
            product_id = inv_item['product_id']
            available_qty = float(inv_item.get('quantity_sqm', 0)) - float(inv_item.get('reserved_sqm', 0))
            log_test("Get available inventory", True, f"Found inventory: {inv_item.get('stock_id', 'N/A')}, available: {available_qty} SQM")
            
            # Get initial reserved_sqm for comparison
            initial_reserved = float(inv_item.get('reserved_sqm', 0))
            print(f"  Initial reserved_sqm: {initial_reserved}")
            
            # Test 1.3: Happy path - Create sales order with auto-reserve
            print("\n1.3: Creating sales order with auto-reserve (status=confirmed)...")
            order_payload = {
                "customer_id": customer_id,
                "currency": "GBP",
                "customer_po": f"PO-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "status": "confirmed",
                "items": [
                    {
                        "inventory_id": inventory_id,
                        "product_id": product_id,
                        "quantity_sqm": 100,
                        "price_per_sqm": 30
                    }
                ]
            }
            resp = requests.post(f"{API_BASE}/sales-order", json=order_payload)
            print_response(resp)
            
            if resp.status_code == 200:
                data = resp.json().get('data', {})
                order_number = data.get('order_number', '')
                order_id = data.get('id', '')
                
                # Verify order number format
                import re
                if re.match(r'^SO-\d{4}-\d{4}$', order_number):
                    log_test("Sales order creation - order number format", True, f"Order number: {order_number}")
                else:
                    log_test("Sales order creation - order number format", False, f"Invalid format: {order_number}")
                
                # Verify side effect: reserved_sqm increased
                print("\n1.4: Verifying inventory reservation side effect...")
                resp = requests.get(f"{API_BASE}/inventory/{inventory_id}")
                print_response(resp)
                
                if resp.status_code == 200:
                    updated_inv = resp.json().get('data', {})
                    new_reserved = float(updated_inv.get('reserved_sqm', 0))
                    print(f"  New reserved_sqm: {new_reserved}")
                    print(f"  Expected increase: 100")
                    print(f"  Actual increase: {new_reserved - initial_reserved}")
                    
                    if new_reserved == initial_reserved + 100:
                        log_test("Inventory auto-reservation", True, f"Reserved increased by 100 SQM (from {initial_reserved} to {new_reserved})")
                    else:
                        log_test("Inventory auto-reservation", False, f"Expected {initial_reserved + 100}, got {new_reserved}")
                else:
                    log_test("Inventory auto-reservation verification", False, f"Failed to fetch inventory: {resp.status_code}")
                
                # Verify inventory_movements record
                print("\n1.5: Verifying inventory_movements record...")
                resp = requests.get(f"{API_BASE}/inventory_movements?product_id={product_id}")
                print_response(resp)
                
                if resp.status_code == 200:
                    movements = resp.json().get('data', [])
                    reserved_movement = [m for m in movements if m.get('movement_type') == 'Stock Reserved' and m.get('inventory_id') == inventory_id]
                    if reserved_movement:
                        log_test("Inventory movement record", True, f"Found 'Stock Reserved' movement for inventory {inventory_id}")
                    else:
                        log_test("Inventory movement record", False, "No 'Stock Reserved' movement found")
                else:
                    log_test("Inventory movement record verification", False, f"Failed to fetch movements: {resp.status_code}")
            else:
                log_test("Sales order creation", False, f"Status: {resp.status_code}")
            
            # Test 1.6: Missing customer_id
            print("\n1.6: Testing missing customer_id validation...")
            resp = requests.post(f"{API_BASE}/sales-order", json={
                "items": [{"inventory_id": inventory_id, "product_id": product_id, "quantity_sqm": 50, "price_per_sqm": 30}]
            })
            print_response(resp)
            
            if resp.status_code == 400 and 'customer_id' in resp.text.lower():
                log_test("Missing customer_id validation", True, "Correctly rejected with 400")
            else:
                log_test("Missing customer_id validation", False, f"Expected 400 with 'customer_id' error, got {resp.status_code}")
            
            # Test 1.7: Empty items array
            print("\n1.7: Testing empty items array validation...")
            resp = requests.post(f"{API_BASE}/sales-order", json={
                "customer_id": customer_id,
                "items": []
            })
            print_response(resp)
            
            if resp.status_code == 400 and 'line item' in resp.text.lower():
                log_test("Empty items validation", True, "Correctly rejected with 400")
            else:
                log_test("Empty items validation", False, f"Expected 400 with 'line item' error, got {resp.status_code}")
            
            # Test 1.8: Non-reserving status (enquiry)
            print("\n1.8: Testing non-reserving status (enquiry)...")
            resp = requests.get(f"{API_BASE}/inventory?status=available")
            inventory2 = resp.json().get('data', [])
            if len(inventory2) > 1:
                inv_item2 = inventory2[1]
                inventory_id2 = inv_item2['id']
                product_id2 = inv_item2['product_id']
                initial_reserved2 = float(inv_item2.get('reserved_sqm', 0))
                
                resp = requests.post(f"{API_BASE}/sales-order", json={
                    "customer_id": customer_id,
                    "status": "enquiry",
                    "items": [{"inventory_id": inventory_id2, "product_id": product_id2, "quantity_sqm": 50, "price_per_sqm": 30}]
                })
                print_response(resp)
                
                if resp.status_code == 200:
                    # Verify reserved_sqm did NOT change
                    resp = requests.get(f"{API_BASE}/inventory/{inventory_id2}")
                    if resp.status_code == 200:
                        updated_inv2 = resp.json().get('data', {})
                        new_reserved2 = float(updated_inv2.get('reserved_sqm', 0))
                        if new_reserved2 == initial_reserved2:
                            log_test("Non-reserving status (enquiry)", True, f"Reserved unchanged at {initial_reserved2}")
                        else:
                            log_test("Non-reserving status (enquiry)", False, f"Reserved changed from {initial_reserved2} to {new_reserved2}")
                    else:
                        log_test("Non-reserving status verification", False, "Failed to fetch inventory")
                else:
                    log_test("Non-reserving status (enquiry)", False, f"Order creation failed: {resp.status_code}")
            else:
                log_test("Non-reserving status test", False, "Not enough inventory items for test")
            
            # Test 1.9: Over-reservation
            print("\n1.9: Testing over-reservation warning...")
            resp = requests.post(f"{API_BASE}/sales-order", json={
                "customer_id": customer_id,
                "status": "confirmed",
                "items": [{"inventory_id": inventory_id, "product_id": product_id, "quantity_sqm": 999999, "price_per_sqm": 30}]
            })
            print_response(resp)
            
            if resp.status_code == 200:
                warnings = resp.json().get('warnings', [])
                if warnings:
                    log_test("Over-reservation warning", True, f"Warnings present: {len(warnings)} warning(s)")
                else:
                    # Check if reserved_sqm was capped
                    resp = requests.get(f"{API_BASE}/inventory/{inventory_id}")
                    if resp.status_code == 200:
                        inv_data = resp.json().get('data', {})
                        reserved = float(inv_data.get('reserved_sqm', 0))
                        total = float(inv_data.get('quantity_sqm', 0))
                        if reserved <= total:
                            log_test("Over-reservation capping", True, f"Reserved capped at {reserved} (total: {total})")
                        else:
                            log_test("Over-reservation handling", False, f"Reserved {reserved} exceeds total {total}")
            else:
                log_test("Over-reservation test", False, f"Request failed: {resp.status_code}")

except Exception as e:
    log_test("Sales Order Wizard tests", False, f"Exception: {str(e)}")
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 2: POST /api/insights/recompute (Alert regeneration)
# ============================================================================
print("\n" + "=" * 80)
print("TEST 2: POST /api/insights/recompute (Alert regeneration)")
print("=" * 80)

try:
    # Test 2.1: Call recompute
    print("\n2.1: Calling POST /api/insights/recompute...")
    resp = requests.post(f"{API_BASE}/insights/recompute")
    print_response(resp)
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get('ok') and data.get('generated', 0) > 0:
            generated_count = data.get('generated')
            log_test("Insights recompute", True, f"Generated {generated_count} alerts")
            
            # Test 2.2: Verify alerts have type='auto'
            print("\n2.2: Verifying auto-generated alerts...")
            resp = requests.get(f"{API_BASE}/alerts")
            print_response(resp)
            
            if resp.status_code == 200:
                alerts = resp.json().get('data', [])
                auto_alerts = [a for a in alerts if a.get('type') == 'auto']
                if auto_alerts:
                    log_test("Auto-generated alerts", True, f"Found {len(auto_alerts)} auto alerts")
                    
                    # Check for expected alert types
                    messages = ' '.join([a.get('message', '').lower() for a in auto_alerts])
                    has_expected = any(keyword in messages for keyword in ['overdue', 'unsold', 'in transit', 'delayed', 'low'])
                    if has_expected:
                        log_test("Alert content validation", True, "Found expected alert keywords")
                    else:
                        log_test("Alert content validation", False, "No expected keywords in alerts")
                else:
                    log_test("Auto-generated alerts", False, "No alerts with type='auto' found")
            else:
                log_test("Fetch alerts", False, f"Status: {resp.status_code}")
            
            # Test 2.3: Call recompute again - verify count stays same (replace not append)
            print("\n2.3: Calling recompute again to verify replacement...")
            initial_alert_count = len(auto_alerts) if 'auto_alerts' in locals() else 0
            
            resp = requests.post(f"{API_BASE}/insights/recompute")
            print_response(resp)
            
            if resp.status_code == 200:
                resp = requests.get(f"{API_BASE}/alerts")
                if resp.status_code == 200:
                    alerts2 = resp.json().get('data', [])
                    auto_alerts2 = [a for a in alerts2 if a.get('type') == 'auto']
                    new_count = len(auto_alerts2)
                    
                    # Allow some variance (±2) due to time-based conditions
                    if abs(new_count - initial_alert_count) <= 2:
                        log_test("Recompute replaces alerts", True, f"Count stable: {initial_alert_count} -> {new_count}")
                    else:
                        log_test("Recompute replaces alerts", False, f"Count changed significantly: {initial_alert_count} -> {new_count}")
                else:
                    log_test("Fetch alerts after recompute", False, f"Status: {resp.status_code}")
            else:
                log_test("Second recompute call", False, f"Status: {resp.status_code}")
            
            # Test 2.4: Verify dashboard includes alerts
            print("\n2.4: Verifying dashboard includes alerts...")
            resp = requests.get(f"{API_BASE}/dashboard")
            print_response(resp)
            
            if resp.status_code == 200:
                dashboard = resp.json()
                if 'alerts' in dashboard and isinstance(dashboard['alerts'], list):
                    log_test("Dashboard alerts array", True, f"Found {len(dashboard['alerts'])} alerts in dashboard")
                else:
                    log_test("Dashboard alerts array", False, "No alerts array in dashboard")
            else:
                log_test("Dashboard fetch", False, f"Status: {resp.status_code}")
        else:
            log_test("Insights recompute", False, f"No alerts generated or ok=false")
    else:
        log_test("Insights recompute", False, f"Status: {resp.status_code}")

except Exception as e:
    log_test("Insights recompute tests", False, f"Exception: {str(e)}")
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 3: POST /api/excel/preview (Excel validation)
# ============================================================================
print("\n" + "=" * 80)
print("TEST 3: POST /api/excel/preview (Excel validation)")
print("=" * 80)

try:
    # Test 3.1: Get template
    print("\n3.1: Getting Excel template...")
    resp = requests.get(f"{API_BASE}/excel/template/stock")
    
    if resp.status_code == 200 and resp.headers.get('content-type', '').startswith('application/vnd.openxmlformats'):
        template_bytes = resp.content
        log_test("Get Excel template", True, f"Downloaded {len(template_bytes)} bytes")
        
        # Test 3.2: Preview the template
        print("\n3.2: Previewing template with mapping...")
        
        mapping = {
            "SKU": "sku",
            "Product": "product_name",
            "Category": "category",
            "Colour": "colour",
            "Finish": "finish",
            "Size": "size",
            "Batch": "batch_lot",
            "Total SQM": "quantity_sqm",
            "Pallets": "pallets",
            "Weight MT": "weight_mt",
            "Source": "source",
            "Supplier": "supplier_code",
            "Supplier Cost": "supplier_cost",
            "Freight": "freight_cost",
            "Duty": "duty_tax",
            "Handling": "handling_cost",
            "Selling Price/SQM": "selling_price_sqm",
            "Status": "status",
            "Customer": "customer_code",
            "Notes": "notes"
        }
        
        files = {
            'file': ('template-stock.xlsx', template_bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        }
        data = {
            'mapping': json.dumps(mapping),
            'sheet_name': 'Template'
        }
        
        resp = requests.post(f"{API_BASE}/excel/preview", files=files, data=data)
        print_response(resp)
        
        if resp.status_code == 200:
            preview_data = resp.json()
            preview = preview_data.get('preview', [])
            summary = preview_data.get('summary', {})
            
            if summary.get('total', 0) >= 1:
                log_test("Excel preview", True, f"Preview returned {summary.get('total')} row(s)")
                
                # Verify row status
                if preview:
                    row = preview[0]
                    status = row.get('status')
                    if status in ['ready', 'duplicate']:
                        log_test("Preview row status", True, f"Row status: {status}")
                    else:
                        log_test("Preview row status", False, f"Unexpected status: {status}")
                    
                    # Verify product matching
                    if row.get('product_matched') or row.get('product_will_be_created'):
                        log_test("Product resolution", True, "Product matched or will be created")
                    else:
                        log_test("Product resolution", False, "No product match or creation flag")
                else:
                    log_test("Preview row data", False, "No preview rows returned")
            else:
                log_test("Excel preview", False, f"Expected at least 1 row, got {summary.get('total', 0)}")
        else:
            log_test("Excel preview", False, f"Status: {resp.status_code}")
    else:
        log_test("Get Excel template", False, f"Status: {resp.status_code} or wrong content-type")

except Exception as e:
    log_test("Excel preview tests", False, f"Exception: {str(e)}")
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 4: POST /api/excel/commit (Excel import with per-row actions)
# ============================================================================
print("\n" + "=" * 80)
print("TEST 4: POST /api/excel/commit (Excel import with per-row actions)")
print("=" * 80)

try:
    # Test 4.1: Commit with skip action
    print("\n4.1: Committing with skip action...")
    
    if 'template_bytes' in locals():
        files = {
            'file': ('template-stock.xlsx', template_bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        }
        data = {
            'mapping': json.dumps(mapping),
            'sheet_name': 'Template',
            'actions': json.dumps({"1": "skip"})
        }
        
        resp = requests.post(f"{API_BASE}/excel/commit", files=files, data=data)
        print_response(resp)
        
        if resp.status_code == 200:
            result = resp.json()
            if result.get('ok') and result.get('skipped', 0) == 1 and result.get('created', 0) == 0:
                log_test("Excel commit with skip", True, f"Skipped: {result.get('skipped')}, Created: {result.get('created')}")
            else:
                log_test("Excel commit with skip", False, f"Unexpected result: {result}")
        else:
            log_test("Excel commit with skip", False, f"Status: {resp.status_code}")
        
        # Test 4.2: Create a new row with unique batch
        print("\n4.2: Creating new inventory row with unique batch...")
        
        # Create a new Excel file with unique batch
        wb = Workbook()
        ws = wb.active
        ws.title = "Template"
        
        # Headers
        headers = ["SKU", "Product", "Category", "Colour", "Finish", "Size", "Batch", "Total SQM", 
                   "Pallets", "Weight MT", "Source", "Supplier", "Supplier Cost", "Freight", 
                   "Duty", "Handling", "Selling Price/SQM", "Status", "Customer", "Notes"]
        ws.append(headers)
        
        # Data row with unique batch
        unique_batch = f"B-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        row_data = ["SND-KAN-6040-25", "Kandla Grey Sandstone", "Sandstone", "Grey", "Natural", 
                    "600x400x25mm", unique_batch, 1200, 16, 30, "outsourced", "SUP-001", 
                    15000, 2500, 1200, 500, 25.50, "available", "", "Test import"]
        ws.append(row_data)
        
        # Save to bytes
        excel_buffer = io.BytesIO()
        wb.save(excel_buffer)
        excel_buffer.seek(0)
        new_excel_bytes = excel_buffer.read()
        
        # Get initial inventory count
        resp = requests.get(f"{API_BASE}/inventory")
        initial_count = len(resp.json().get('data', [])) if resp.status_code == 200 else 0
        print(f"  Initial inventory count: {initial_count}")
        
        files = {
            'file': ('test-stock.xlsx', new_excel_bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        }
        data = {
            'mapping': json.dumps(mapping),
            'sheet_name': 'Template',
            'actions': json.dumps({"1": "create"})
        }
        
        resp = requests.post(f"{API_BASE}/excel/commit", files=files, data=data)
        print_response(resp)
        
        if resp.status_code == 200:
            result = resp.json()
            if result.get('ok') and result.get('created', 0) == 1:
                log_test("Excel commit with create", True, f"Created: {result.get('created')}")
                
                # Verify inventory count increased
                resp = requests.get(f"{API_BASE}/inventory")
                if resp.status_code == 200:
                    new_count = len(resp.json().get('data', []))
                    print(f"  New inventory count: {new_count}")
                    if new_count == initial_count + 1:
                        log_test("Inventory count after create", True, f"Count increased from {initial_count} to {new_count}")
                    else:
                        log_test("Inventory count after create", False, f"Expected {initial_count + 1}, got {new_count}")
                else:
                    log_test("Verify inventory count", False, "Failed to fetch inventory")
                
                # Test 4.3: Update the same row
                print("\n4.3: Updating existing inventory row...")
                
                files = {
                    'file': ('test-stock.xlsx', new_excel_bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                }
                data = {
                    'mapping': json.dumps(mapping),
                    'sheet_name': 'Template',
                    'actions': json.dumps({"1": "update"})
                }
                
                resp = requests.post(f"{API_BASE}/excel/commit", files=files, data=data)
                print_response(resp)
                
                if resp.status_code == 200:
                    result = resp.json()
                    if result.get('ok') and result.get('updated', 0) == 1:
                        log_test("Excel commit with update", True, f"Updated: {result.get('updated')}")
                    else:
                        log_test("Excel commit with update", False, f"Unexpected result: {result}")
                else:
                    log_test("Excel commit with update", False, f"Status: {resp.status_code}")
            else:
                log_test("Excel commit with create", False, f"Unexpected result: {result}")
        else:
            log_test("Excel commit with create", False, f"Status: {resp.status_code}")
    else:
        log_test("Excel commit tests", False, "Template not available from previous test")

except Exception as e:
    log_test("Excel commit tests", False, f"Exception: {str(e)}")
    import traceback
    traceback.print_exc()

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total Tests: {test_results['passed'] + test_results['failed']}")
print(f"Passed: {test_results['passed']}")
print(f"Failed: {test_results['failed']}")
print(f"Success Rate: {(test_results['passed'] / (test_results['passed'] + test_results['failed']) * 100):.1f}%")

if test_results['failed'] > 0:
    print("\nFailed Tests:")
    for test in test_results['tests']:
        if not test['passed']:
            print(f"  ❌ {test['name']}")
            if test['details']:
                print(f"     {test['details']}")

print("\n" + "=" * 80)
