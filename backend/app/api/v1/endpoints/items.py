import json
from pathlib import Path
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query, status

router = APIRouter()

CATALOG_STORAGE_PATH = Path(__file__).resolve().parent.parent.parent / "storage" / "active_catalog.json"


class InventoryItem(BaseModel):
    id: int = Field(..., description="Unique item ID")
    sku: str = Field(..., description="Stock Keeping Unit code")
    name: str = Field(..., description="Product name")
    category: str = Field(..., description="Product category")
    quantity: int = Field(..., ge=0, description="Available stock quantity")
    price_npr: float = Field(..., gt=0, description="Retail price in Nepalese Rupees (NPR)")
    reorder_level: int = Field(default=10, description="Threshold quantity to trigger restocking alert")


class ItemCreate(BaseModel):
    sku: str = Field(..., description="Stock Keeping Unit code")
    name: str = Field(..., description="Product name")
    category: str = Field(..., description="Product category")
    quantity: int = Field(..., ge=0, description="Available stock quantity")
    price_npr: float = Field(..., gt=0, description="Retail price in NPR")
    reorder_level: int = Field(default=10, ge=0, description="Restock threshold")


class ItemUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = Field(None, ge=0)
    price_npr: Optional[float] = Field(None, gt=0)
    reorder_level: Optional[int] = Field(None, ge=0)


# Modern retail inventory catalog replacing old grocery items
SAMPLE_ITEMS: List[InventoryItem] = [
    InventoryItem(
        id=1,
        sku="ELEC-AIR-PRO",
        name="Noise-Cancelling Wireless Earbuds Pro",
        category="Electronics",
        quantity=42,
        price_npr=4500.0,
        reorder_level=15,
    ),
    InventoryItem(
        id=2,
        sku="CLOTH-HOOD-01",
        name="Oversized Heavy Fleece Winter Hoodie",
        category="Clothing",
        quantity=28,
        price_npr=2450.0,
        reorder_level=10,
    ),
    InventoryItem(
        id=3,
        sku="BEAU-GLOW-02",
        name="Vitamin C Glow Facial Serum 30ml",
        category="Beauty",
        quantity=35,
        price_npr=1650.0,
        reorder_level=12,
    ),
    InventoryItem(
        id=4,
        sku="ELEC-WATCH-03",
        name="AMOLED Smart Fitness Watch Series 9",
        category="Electronics",
        quantity=8,
        price_npr=5200.0,
        reorder_level=10,
    ),
    InventoryItem(
        id=5,
        sku="CLOTH-DENIM-04",
        name="Classic Straight Stretch Denim Jeans",
        category="Clothing",
        quantity=19,
        price_npr=2950.0,
        reorder_level=10,
    ),
    InventoryItem(
        id=6,
        sku="BEAU-SUN-05",
        name="Ultra-Light Daily Sunscreen SPF 50+ PA++++",
        category="Beauty",
        quantity=7,
        price_npr=950.0,
        reorder_level=10,
    ),
]

# Stores for dynamic catalog ingested from POS/Excel ETL
ACTIVE_CATALOG: List[InventoryItem] = []
TENANT_CATALOGS: Dict[str, List[InventoryItem]] = {}


def save_catalog_to_disk():
    try:
        CATALOG_STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "active": [i.dict() for i in ACTIVE_CATALOG],
            "tenants": {k: [i.dict() for i in v] for k, v in TENANT_CATALOGS.items()},
        }
        with open(CATALOG_STORAGE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Failed to persist catalog to disk:", e)


def load_catalog_from_disk():
    global ACTIVE_CATALOG, TENANT_CATALOGS
    if CATALOG_STORAGE_PATH.exists():
        try:
            with open(CATALOG_STORAGE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "active" in data and isinstance(data["active"], list) and data["active"]:
                    ACTIVE_CATALOG = [InventoryItem(**x) for x in data["active"]]
                if "tenants" in data and isinstance(data["tenants"], dict):
                    TENANT_CATALOGS = {k: [InventoryItem(**x) for x in v] for k, v in data["tenants"].items()}
        except Exception as e:
            print("Failed to load catalog from disk:", e)


# Load saved catalog if available on startup
load_catalog_from_disk()


def update_catalog_from_etl_records(business_id: str, items: List[InventoryItem]):
    global ACTIVE_CATALOG
    ACTIVE_CATALOG = items
    TENANT_CATALOGS[str(business_id)] = items
    save_catalog_to_disk()


@router.get(
    "",
    response_model=List[InventoryItem],
    summary="List inventory items",
    description="Retrieve catalog items with category and stock filtering options.",
)
async def list_items(
    business_id: Optional[str] = Query(None, description="Optional tenant business UUID"),
    category: Optional[str] = None,
    low_stock_only: bool = False,
    search: Optional[str] = None,
) -> List[InventoryItem]:
    items: List[InventoryItem] = []
    if business_id and str(business_id) in TENANT_CATALOGS:
        items = TENANT_CATALOGS[str(business_id)]
    elif ACTIVE_CATALOG:
        items = ACTIVE_CATALOG
    else:
        items = SAMPLE_ITEMS

    if category and category.lower() != "all":
        items = [i for i in items if i.category.lower() == category.lower()]
    if low_stock_only:
        items = [i for i in items if i.quantity <= i.reorder_level]
    if search:
        s = search.strip().lower()
        items = [i for i in items if s in i.name.lower() or s in i.sku.lower() or s in i.category.lower()]

    return items


@router.get(
    "/{item_id}",
    response_model=InventoryItem,
    summary="Get single inventory item by ID",
)
async def get_item(item_id: int) -> InventoryItem:
    pool = ACTIVE_CATALOG if ACTIVE_CATALOG else SAMPLE_ITEMS
    for item in pool:
        if item.id == item_id:
            return item
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Item with id {item_id} not found",
    )


@router.post(
    "",
    response_model=InventoryItem,
    status_code=status.HTTP_201_CREATED,
    summary="Add new inventory item",
)
async def create_item(payload: ItemCreate, business_id: Optional[str] = None) -> InventoryItem:
    global ACTIVE_CATALOG
    if not ACTIVE_CATALOG:
        ACTIVE_CATALOG = list(SAMPLE_ITEMS)

    new_id = max([i.id for i in ACTIVE_CATALOG], default=0) + 1
    new_item = InventoryItem(
        id=new_id,
        sku=payload.sku.strip().upper(),
        name=payload.name.strip(),
        category=payload.category.strip(),
        quantity=payload.quantity,
        price_npr=payload.price_npr,
        reorder_level=payload.reorder_level,
    )
    ACTIVE_CATALOG.insert(0, new_item)
    if business_id:
        if str(business_id) not in TENANT_CATALOGS:
            TENANT_CATALOGS[str(business_id)] = list(ACTIVE_CATALOG)
        else:
            TENANT_CATALOGS[str(business_id)].insert(0, new_item)
    save_catalog_to_disk()
    return new_item


@router.put(
    "/{item_id}",
    response_model=InventoryItem,
    summary="Update inventory item stock or price",
)
async def update_item(item_id: int, payload: ItemUpdate, business_id: Optional[str] = None) -> InventoryItem:
    global ACTIVE_CATALOG
    if not ACTIVE_CATALOG:
        ACTIVE_CATALOG = list(SAMPLE_ITEMS)

    target: Optional[InventoryItem] = None
    for i, item in enumerate(ACTIVE_CATALOG):
        if item.id == item_id:
            updated_data = item.dict()
            if payload.sku is not None:
                updated_data["sku"] = payload.sku.strip().upper()
            if payload.name is not None:
                updated_data["name"] = payload.name.strip()
            if payload.category is not None:
                updated_data["category"] = payload.category.strip()
            if payload.quantity is not None:
                updated_data["quantity"] = payload.quantity
            if payload.price_npr is not None:
                updated_data["price_npr"] = payload.price_npr
            if payload.reorder_level is not None:
                updated_data["reorder_level"] = payload.reorder_level

            target = InventoryItem(**updated_data)
            ACTIVE_CATALOG[i] = target
            break

    if not target:
        raise HTTPException(status_code=404, detail="Item not found")

    if business_id and str(business_id) in TENANT_CATALOGS:
        TENANT_CATALOGS[str(business_id)] = list(ACTIVE_CATALOG)

    save_catalog_to_disk()
    return target


@router.delete(
    "/{item_id}",
    summary="Delete inventory item",
)
async def delete_item(item_id: int, business_id: Optional[str] = None):
    global ACTIVE_CATALOG
    if not ACTIVE_CATALOG:
        ACTIVE_CATALOG = list(SAMPLE_ITEMS)

    ACTIVE_CATALOG = [i for i in ACTIVE_CATALOG if i.id != item_id]
    if business_id and str(business_id) in TENANT_CATALOGS:
        TENANT_CATALOGS[str(business_id)] = [i for i in TENANT_CATALOGS[str(business_id)] if i.id != item_id]
    save_catalog_to_disk()
    return {"status": "success", "message": f"Item {item_id} deleted"}


@router.post(
    "/reset",
    summary="Reset catalog to modern retail defaults",
)
async def reset_catalog(business_id: Optional[str] = None):
    global ACTIVE_CATALOG
    ACTIVE_CATALOG = list(SAMPLE_ITEMS)
    if business_id and str(business_id) in TENANT_CATALOGS:
        TENANT_CATALOGS[str(business_id)] = list(SAMPLE_ITEMS)
    save_catalog_to_disk()
    return {"status": "success", "message": "Catalog reset to defaults", "items": ACTIVE_CATALOG}

