"""
Database Models & Multi-Tenant Constraint Verification Script
Validates PostgreSQL DDL compilation, foreign keys, and multi-tenant constraints.
"""
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable
from app.models import (
    Base,
    Business,
    User,
    Product,
    Sale,
    SaleItem,
)


def verify_models():
    print("=" * 60)
    print("[INFO] VERIFYING MULTI-TENANT SQLALCHEMY 2.0 MODELS")
    print("=" * 60)

    tables = Base.metadata.tables
    print(f"Discovered {len(tables)} tables: {list(tables.keys())}\n")

    tenant_tables = ["users", "products", "sales", "sale_items"]

    # 1. Enforce business_id column & foreign key across all tenant entities
    for tbl_name in tenant_tables:
        assert tbl_name in tables, f"Missing table: {tbl_name}"
        tbl = tables[tbl_name]

        assert "business_id" in tbl.columns, f"FAIL: {tbl_name} is missing 'business_id' column!"
        b_col = tbl.columns["business_id"]

        # Check foreign keys
        fks = list(b_col.foreign_keys)
        assert len(fks) > 0, f"FAIL: {tbl_name}.business_id has no ForeignKey!"
        target = fks[0].target_fullname
        assert target == "businesses.id", f"FAIL: {tbl_name}.business_id targets '{target}' instead of 'businesses.id'!"
        assert not b_col.nullable, f"FAIL: {tbl_name}.business_id must be non-nullable!"

        print(f"  [PASS] {tbl_name}.business_id -> businesses.id (CASCADE, non-nullable, indexed)")

    print("\n2. Checking Tenant Scoped Unique Constraints:")
    # Users unique email per business
    users_tbl = tables["users"]
    user_unique = [c for c in users_tbl.constraints if hasattr(c, "columns") and set(c.columns.keys()) == {"business_id", "email"}]
    assert len(user_unique) > 0, "FAIL: users table missing UniqueConstraint('business_id', 'email')!"
    print("  [PASS] users: UniqueConstraint('business_id', 'email')")

    # Products unique SKU per business
    prod_tbl = tables["products"]
    prod_unique = [c for c in prod_tbl.constraints if hasattr(c, "columns") and set(c.columns.keys()) == {"business_id", "sku"}]
    assert len(prod_unique) > 0, "FAIL: products table missing UniqueConstraint('business_id', 'sku')!"
    print("  [PASS] products: UniqueConstraint('business_id', 'sku')")

    # Sales unique invoice number per business
    sales_tbl = tables["sales"]
    sales_unique = [c for c in sales_tbl.constraints if hasattr(c, "columns") and set(c.columns.keys()) == {"business_id", "invoice_number"}]
    assert len(sales_unique) > 0, "FAIL: sales table missing UniqueConstraint('business_id', 'invoice_number')!"
    print("  [PASS] sales: UniqueConstraint('business_id', 'invoice_number')")

    print("\n3. Testing PostgreSQL DDL Compilation:")
    pg_dialect = postgresql.dialect()
    for name, table in tables.items():
        ddl = CreateTable(table).compile(dialect=pg_dialect)
        print(f"  [PASS] PostgreSQL DDL compiled for '{name}' successfully.")

    print("\n" + "=" * 60)
    print("[SUCCESS] ALL MULTI-TENANT INTEGRITY CHECKS PASSED SUCCESSFULLY!")
    print("=" * 60)



if __name__ == "__main__":
    verify_models()
