"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Package,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Tag,
  Hash,
} from "lucide-react";
import { fetchInventoryItems } from "@/lib/api";
import { updateInventoryItem, deleteInventoryItem, createInventoryItem } from "@/lib/api";

interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  price_npr: number;
  reorder_level: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  businessId?: string;
  storeName?: string;
  onDataChanged?: () => void;
}

export function InventoryManagementModal({
  isOpen,
  onClose,
  businessId,
  storeName = "तपाईंको स्टोर",
  onDataChanged,
}: Props) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states for Add / Edit
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    category: "खाद्यान्न (Groceries)",
    quantity: 10,
    price_npr: 100,
    reorder_level: 5,
  });

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await fetchInventoryItems(businessId);
      setItems(data || []);
    } catch {
      setMsg({ type: "error", text: "इन्भेन्टरी लोड गर्न सकिएन।" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadItems();
      setMsg(null);
      setEditingItem(null);
      setIsAddingNew(false);
    }
  }, [isOpen, businessId]);

  if (!isOpen) return null;

  const handleStartEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setIsAddingNew(false);
    setFormData({
      sku: item.sku,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      price_npr: item.price_npr,
      reorder_level: item.reorder_level,
    });
    setMsg(null);
  };

  const handleStartAdd = () => {
    setIsAddingNew(true);
    setEditingItem(null);
    setFormData({
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      name: "",
      category: "खाद्यान्न (Groceries)",
      quantity: 20,
      price_npr: 250,
      reorder_level: 5,
    });
    setMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setMsg({ type: "error", text: "सामानको नाम अनिवार्य छ।" });
      return;
    }

    setActionLoading(true);
    setMsg(null);

    try {
      if (editingItem) {
        // Update existing item
        await updateInventoryItem(
          editingItem.id,
          {
            sku: formData.sku,
            name: formData.name,
            category: formData.category,
            quantity: Number(formData.quantity),
            price_npr: Number(formData.price_npr),
            reorder_level: Number(formData.reorder_level),
          },
          businessId
        );
        setMsg({ type: "success", text: "सामान सफलतापूर्वक अपडेट गरियो!" });
      } else if (isAddingNew) {
        // Create new item
        await createInventoryItem(
          {
            sku: formData.sku,
            name: formData.name,
            category: formData.category,
            quantity: Number(formData.quantity),
            price_npr: Number(formData.price_npr),
            reorder_level: Number(formData.reorder_level),
          },
          businessId
        );
        setMsg({ type: "success", text: "नयाँ सामान सफलतापूर्वक थपियो!" });
      }

      setEditingItem(null);
      setIsAddingNew(false);
      await loadItems();
      if (onDataChanged) onDataChanged();
      window.dispatchEvent(new Event("retailiq_data_updated"));
    } catch (err: any) {
      setMsg({ type: "error", text: err?.message || "कार्य असफल भयो।" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (itemId: number, itemName: string) => {
    if (!window.confirm(`के तपाईं '${itemName}' लाई डाटाबेसबाट मेटाउन निश्चित हुनुहुन्छ?`)) {
      return;
    }

    setActionLoading(true);
    try {
      await deleteInventoryItem(itemId, businessId);
      setMsg({ type: "success", text: `'${itemName}' सफलतापूर्वक हटाइयो!` });
      await loadItems();
      if (onDataChanged) onDataChanged();
      window.dispatchEvent(new Event("retailiq_data_updated"));
    } catch (err: any) {
      setMsg({ type: "error", text: err?.message || "मेटाउन सकिएन।" });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredItems = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.sku.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  इन्भेन्टरी व्यवस्थापन (Live Stock CRUD)
                </h2>
                <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                  {items.length} सामानहरू
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {storeName} • डाटाबेसमा प्रत्यक्ष सम्पादन र व्यवस्थापन गर्नुहोस्
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStartAdd}
              disabled={isAddingNew}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              नयाँ सामान थप्नुहोस्
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {msg && (
          <div
            className={`px-4 py-2.5 text-xs flex items-center gap-2 border-b ${
              msg.type === "success"
                ? "bg-emerald-950/50 border-emerald-800/60 text-emerald-300"
                : "bg-rose-950/50 border-rose-800/60 text-rose-300"
            }`}
          >
            {msg.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Add / Edit Form Panel */}
        {(editingItem || isAddingNew) && (
          <div className="p-4 bg-slate-850 border-b border-slate-750 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                {editingItem ? `सामान सम्पादन: ${editingItem.name}` : "नयाँ सामान दर्ता फारम"}
              </span>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setIsAddingNew(false);
                }}
                className="text-xs text-slate-400 hover:text-white transition"
              >
                रद्द गर्नुहोस् (Cancel)
              </button>
            </div>

            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">SKU कोड</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1">सामानको नाम (Product Name)</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="उदा: बासमती चामल २५ केजी"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">वर्ग (Category)</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">बिक्री दर (Price NPR)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={formData.price_npr}
                  onChange={(e) => setFormData({ ...formData, price_npr: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">उपलब्ध मौज्दात (Stock Quantity)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
                  required
                />
              </div>

              <div className="sm:col-span-3 flex justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setIsAddingNew(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  रद्द (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow transition disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {actionLoading ? "सेभ हुँदैछ..." : editingItem ? "अपडेट सुरक्षित गर्नुहोस्" : "सामान थप्नुहोस्"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search Bar */}
        <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="नाम, वर्ग वा SKU बाट खोज्नुहोस्..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
          <button
            onClick={loadItems}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition"
            title="Reload items"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            ताजा (Refresh)
          </button>
        </div>

        {/* Items Table List */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-400 mb-2" />
              <span className="text-xs">इन्भेन्टरी डाटा लोड हुँदैछ...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              कुनै सामान फेला परेन। माथिको 'नयाँ सामान थप्नुहोस्' बटनबाट सामान दर्ता गर्नुहोस्।
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-3.5 py-3">SKU</th>
                    <th className="px-3.5 py-3">सामानको नाम (Product)</th>
                    <th className="px-3.5 py-3">वर्ग (Category)</th>
                    <th className="px-3.5 py-3 text-right">दर (Price)</th>
                    <th className="px-3.5 py-3 text-right">मौज्दात (Stock)</th>
                    <th className="px-3.5 py-3 text-center">अवस्था (Status)</th>
                    <th className="px-3.5 py-3 text-right">कार्यहरू (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-900/50">
                  {filteredItems.map((item) => {
                    const isOut = item.quantity === 0;
                    const isLow = item.quantity <= item.reorder_level;

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/50 transition group">
                        <td className="px-3.5 py-3 font-mono font-bold text-slate-300">
                          {item.sku}
                        </td>
                        <td className="px-3.5 py-3 font-medium text-white">
                          {item.name}
                        </td>
                        <td className="px-3.5 py-3 text-slate-400">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px]">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-right font-bold text-emerald-400">
                          रु. {item.price_npr.toLocaleString("en-NP")}
                        </td>
                        <td className="px-3.5 py-3 text-right font-bold text-white">
                          {item.quantity} युनिट
                        </td>
                        <td className="px-3.5 py-3 text-center">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-950/60 text-rose-400 border border-rose-800/60">
                              स्टक सकियो
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/60">
                              न्यून स्टक ({item.quantity})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                              पर्याप्त
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleStartEdit(item)}
                              disabled={actionLoading}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition"
                              title="सम्पादन गर्नुहोस् (Edit)"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.name)}
                              disabled={actionLoading}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition"
                              title="मेटाउनुहोस् (Delete)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 text-[11px] text-slate-500 flex items-center justify-between">
          <span>नेपालको आधिकारिक खुद्रा र थोक इन्भेन्टरी डाटाबेस (PostgreSQL Linked)</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
          >
            बन्द गर्नुहोस् (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
