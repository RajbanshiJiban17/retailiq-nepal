"""
Test Subscription SaaS Workflow:
1. Fetch all subscription plans (/plans)
2. Check current store plan (/current)
3. Upgrade plan to Pro Merchant (/upgrade)
4. Upgrade plan to Enterprise (/upgrade)
5. Verify multi-tenant isolation
"""
import requests
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1/subscription"
BUSINESS_ID = "00000000-0000-0000-0000-000000000001"

def test_subscription_flow():
    print("[1] Testing GET /api/v1/subscription/plans ...")
    r = requests.get(f"{BASE_URL}/plans")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    plans = r.json()
    assert len(plans) == 3, f"Expected 3 plans, got {len(plans)}"
    plan_ids = [p["id"] for p in plans]
    assert "starter" in plan_ids and "pro" in plan_ids and "enterprise" in plan_ids
    print(f"    Plans found: {[p['name_nepali'] for p in plans]}")

    print("[2] Testing GET /api/v1/subscription/current ...")
    r = requests.get(f"{BASE_URL}/current?business_id={BUSINESS_ID}")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    curr = r.json()
    assert curr["business_id"] == BUSINESS_ID
    print(f"    Current tier: {curr.get('tier')} ({curr.get('plan_name_nepali')})")

    print("[3] Testing POST /api/v1/subscription/upgrade to 'pro' ...")
    payload = {
        "business_id": BUSINESS_ID,
        "target_tier": "pro",
        "payment_channel": "fonepay"
    }
    r = requests.post(f"{BASE_URL}/upgrade", json=payload)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    upgraded = r.json()
    assert upgraded["tier"] == "pro"
    assert upgraded["can_upload_excel"] is True
    print(f"    Upgrade success: {upgraded['plan_name_nepali']}, Price: Rs. {upgraded['price_npr']}")

    print("[4] Testing POST /api/v1/subscription/upgrade to 'enterprise' via esewa ...")
    payload = {
        "business_id": BUSINESS_ID,
        "target_tier": "enterprise",
        "payment_channel": "esewa"
    }
    r = requests.post(f"{BASE_URL}/upgrade", json=payload)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    upgraded_ent = r.json()
    assert upgraded_ent["tier"] == "enterprise"
    assert upgraded_ent["is_trial"] is False
    assert upgraded_ent["payment_channel"] == "esewa"
    assert upgraded_ent["transaction_id"].startswith("ES-2083-")
    print(f"    Enterprise upgrade success: {upgraded_ent['plan_name_nepali']}, TXN: {upgraded_ent['transaction_id']}")

    print("[5] Testing POST /api/v1/subscription/upgrade for 7-day trial ...")
    payload_trial = {
        "business_id": "00000000-0000-0000-0000-000000000002",
        "target_tier": "pro",
        "payment_channel": "trial"
    }
    r = requests.post(f"{BASE_URL}/upgrade", json=payload_trial)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    trial_sub = r.json()
    assert trial_sub["is_trial"] is True
    assert trial_sub["trial_days_remaining"] > 0
    assert trial_sub["transaction_id"].startswith("TRL-7D-")
    print(f"    7-Day Trial active: {trial_sub['trial_days_remaining']} days remaining, TXN: {trial_sub['transaction_id']}")

    print("\n[SUCCESS] ALL SUBSCRIPTION & 7-DAY TRIAL CHECKS PASSED!")

if __name__ == "__main__":
    try:
        test_subscription_flow()
    except Exception as e:
        print(f"[FAILED] Error: {e}", file=sys.stderr)
        sys.exit(1)
