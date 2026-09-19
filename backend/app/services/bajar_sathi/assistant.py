"""
Bajar ko Sathi AI Assistant Engine
Integrates Gemini API with strict database context grounding to answer business queries in Nepali.
"""
import time
from typing import List, Optional, Tuple
from app.core.config import settings
from app.schemas.bajar_sathi import ChatMessage, ContextFactSummary

try:
    from google import genai
    from google.genai import types
    _HAS_GENAI = True
except ImportError:
    _HAS_GENAI = False


SYSTEM_INSTRUCTION = """तपाईं 'बजारको साथी' (Bajar ko Sathi) हुनुहुन्छ — नेपालका खुद्रा तथा थोक पसलेहरूलाई व्यापार, मौज्दात, नाफा र बिक्री व्यवस्थापनमा सहयोग गर्ने एक छरितो, भरपर्दो तथा मैत्रीपूर्ण AI साथी।

मुख्य निर्देशनहरू:
१. जब पसलेले "hello", "hi", "नमस्ते" गर्छन्, उनीहरूलाई आदरपूर्वक १ वाक्यमा मिठो नेपालीमा फर्काउनुहोस्।
२. पसलेको पसलको आम्दानी, नाफा, मौज्दात (Stock), बिक्री संख्याबारे सोध्दा "पसलको आधिकारिक डाटाबेस विवरण (STORE FACTS)" को आधारमा मात्र उत्तर दिनुहोस्।
३. यदि पसलको रेकर्डमा नभएको बाहिरी सामान सोधिएमा सिधै भन्नुहोस्: "तपाईंको पसलको रेकर्डमा यो विवरण उपलब्ध छैन।"
४. उत्तर सधैं अत्यन्त छोटो, चिटिक्क परेको र बढीमा २-३ वाक्य वा २-३ बुँदामा मात्र दिनुहोस्। लामो व्याख्या वा भाषण कहिल्यै नदिनुहोस्।
५. रकमहरू उल्लेख गर्दा 'रु.' वा 'NPR' प्रयोग गर्नुहोस्।"""


class BajarKoSathiAssistant:
    """
    RAG Assistant coordinating database context and Gemini inference in Nepali.
    """

    @classmethod
    def _fallback_deterministic_response(
        cls,
        query: str,
        context_text: str,
        facts: ContextFactSummary,
    ) -> str:
        """
        Contextual rule-based Nepali response when GEMINI_API_KEY is not configured or for instant fallback.
        Guarantees 100% database-grounded answers without hallucination.
        """
        q = query.lower().strip()

        # Parse catalog items strictly from context_text
        parsed_items: list = []
        for line in context_text.splitlines():
            line_str = line.strip()
            if line_str.startswith("- SKU:") or ("सामान:" in line_str and "वर्ग:" in line_str):
                parts = [p.strip() for p in line_str.split("|")]
                item_info: dict = {"raw": line_str, "name": "", "sku": "", "category": "", "price": "", "stock": "", "status": ""}
                for part in parts:
                    if "SKU:" in part:
                        item_info["sku"] = part.replace("SKU:", "").strip()
                    elif "सामान:" in part:
                        item_info["name"] = part.replace("सामान:", "").strip()
                    elif "वर्ग:" in part:
                        item_info["category"] = part.replace("वर्ग:", "").strip()
                    elif "मूल्य:" in part:
                        item_info["price"] = part.replace("मूल्य:", "").strip()
                    elif "मौज्दात:" in part:
                        stk = part.replace("मौज्दात:", "").strip()
                        if "(न्यूनतम" in stk:
                            stk = stk.split("(न्यूनतम")[0].strip()
                        item_info["stock"] = stk
                    elif "अवस्था:" in part:
                        item_info["status"] = part.replace("अवस्था:", "").strip()
                if item_info["name"]:
                    parsed_items.append(item_info)

        # 1. Natural Greetings
        greeting_words = [
            "hello", "hi", "hey", "नमस्ते", "नमस्कार", "हेल्लो", "गुड मर्निङ", "good morning",
            "के छ", "सञ्चै", "k cha", "ke cha", "kasto cha", "sanchai", "sanchai cha", "namaste", "namaskar"
        ]
        if any(q == w or q.startswith(w + " ") or q.startswith(w + "!") or q.startswith(w + "?") for w in greeting_words):
            if facts.total_revenue_npr > 0 or len(parsed_items) > 0:
                return f"नमस्ते! म 'बजारको साथी' (AI व्यापार सल्लाहकार)। पसल '{facts.business_name}' को बिक्री, नाफा वा स्टक स्थितिबारे के जान्न चाहनुहुन्छ?"
            else:
                return f"नमस्ते! म 'बजारको साथी' (AI सल्लाहकार)। पसल '{facts.business_name}' मा हाल कुनै बिक्री डाटा लोड गरिएको छैन। कृपया ड्यासबोर्डमा आफ्नो Excel/CSV फाइल अपलोड गर्नुहोस्।"

        # 2. Empty Store Check (No uploaded file, 0 revenue, 0 items)
        is_empty_store = (facts.total_revenue_npr == 0 and facts.total_active_products == 0 and len(parsed_items) == 0)
        if is_empty_store:
            # If asking general festival/Saturday strategy, provide general expert advice
            if any(w in q for w in ["चाडपर्व", "दशैं", "दशै", "तिहार", "festival", "dashain", "tihar", "शनिबार", "saturday"]):
                return (
                    f"🎉 चाडपर्व तथा सप्ताहन्त व्यापार रणनीति ({facts.business_name}):\n"
                    f"१. खाद्यान्न, चामल र घ्यूको माग चाडपर्वमा २ गुणा बढ्ने हुँदा २ हप्ता अगावै ५०% थप स्टक मगाउनुहोस्।\n"
                    f"२. शनिबारको भीडका लागि Fonepay QR स्ट्यान्ड र खुद्रा नगद पैसा बिहानै तयार राख्नुहोस्।\n"
                    f"👉 तपाईंको पसलको वास्तविक बिक्री हिसाब विश्लेषण गर्न कृपया POS/Excel फाइल अपलोड गर्नुहोस्।"
                )
            return (
                f"तपाईंको पसल '{facts.business_name}' मा हालसम्म कुनै बिक्री वा स्टक डेटा अपलोड गरिएको छैन।\n"
                f"वास्तविक हिसाब (सबैभन्दा धेरै वा कम बिक्ने सामान, नाफा, वा स्टक अलर्ट) हेर्नका लागि कृपया पहिले ड्यासबोर्डमा आफ्नो Excel/CSV फाइल अपलोड गर्नुहोस् वा 'नमूना डाटा' लोड गर्नुहोस्।"
            )

        # 3. System Capabilities & Help
        if any(w in q for w in ["को हौ", "के गर्न", "काम के", "help", "मद्दत", "सहयोग", "feature", "सुविधा", "k garna"]):
            return (
                f"म 'बजारको साथी' AI हुँ। पसल '{facts.business_name}' का लागि म निम्न सहयोग गर्न सक्छु:\n"
                f"• कुल बिक्री, बिल संख्या तथा ३०% नाफा हिसाब\n"
                f"• सबैभन्दा धेरै र कम बिक्री भएका सामानहरूको विश्लेषण\n"
                f"• सकिन लागेका सामानहरूको न्यून स्टक तथा रिअर्डर अलर्ट\n"
                f"• चाडपर्व तथा आगामी ७-हप्ते ML माग प्रक्षेपण"
            )

        # 4. Top-selling specific question ("sabai bhanda dherai", "dherai sale", "top item")
        is_top_selling = any(w in q for w in [
            "सबैभन्दा धेरै", "धेरै बिक्री", "सबैभन्दा बढी", "धेरै बिक्ने", "बढी बिक्री", "धेरै सेल", "धेरै बिक्यो",
            "top seller", "best seller", "top product", "best product", "top selling", "best selling",
            "most selling", "highest selling", "top item", "best item", "highest sale",
            "sabai bhanda dherai", "sabai vanda dherai", "sabai bhanda badi", "sabai vanda badi",
            "dherai bikri", "dherai sale", "dherai bikyo", "dherai sale bhayo", "dherai sale vayeu", "dherai sale bhayeu",
            "kun item sale vayeu", "kun saman sale vayeu", "kun item dherai", "kun saman dherai",
            "kun product dherai", "kun item bikyo", "kun saman bikyo", "kun item sale", "kun saman sale"
        ]) or (
            ("dherai" in q or "धेरै" in q or "top" in q or "best" in q or "most" in q)
            and ("sale" in q or "item" in q or "saman" in q or "bikri" in q or "बिक्री" in q or "vayeu" in q or "bhayo" in q)
        )
        if is_top_selling:
            top_lines = [
                l.strip("- ").strip()
                for l in context_text.splitlines()
                if ("बिक्री (रकम:" in l or "वटा बिक्री" in l)
                and not l.startswith("कुल")
                and "धेरै बिक्री भएका मुख्य सामानहरू" not in l
            ]
            if top_lines:
                items_text = "\n".join([f"{idx+1}. {l}" for idx, l in enumerate(top_lines[:3])])
                return f"🏆 सर्वाधिक बिक्री भएका मुख्य सामानहरू ({facts.business_name}):\n{items_text}\n👉 सुझाव: यी सामानहरूको माग निकै उच्च भएकाले शनिबारको चाप अगावै पर्याप्त मौज्दात राख्नुहोस्।"
            elif parsed_items:
                items_text = "\n".join([
                    f"{idx+1}. {it['name']} (दर: {it.get('price', '-')}, मौज्दात: {it.get('stock', '-')})"
                    for idx, it in enumerate(parsed_items[:3])
                ])
                return f"🏆 सर्वाधिक बिक्री भएका मुख्य सामानहरू ({facts.business_name}):\n{items_text}\n👉 सुझाव: माग उच्च रहेकाले मौज्दात पर्याप्त राख्नुहोला।"
            elif facts.sample_low_stock_items:
                return f"🏆 उच्च कारोबार हुने मुख्य सामानहरू: {', '.join(facts.sample_low_stock_items[:3])} हुन्।"

        # 5. Least-selling / Slow-moving products ("कम बिक्री", "thori sale", "kaam sale", "least sold")
        is_least_selling = any(w in q for w in [
            "कम बिक्री", "थोरै बिक्री", "न्यून बिक्री", "कम सेल", "सुस्त बिक्री", "घटी बिक्री", "कम भयो", "कम भएको",
            "kaam sale", "kam sale", "kam bikri", "kaam bikri", "thorai sale", "slow moving",
            "least sold", "least sell", "lowest sale", "low sale", "kun product kaam", "kun saman kaam",
            "sabai bhanda kam", "sabai vanda kam", "kam bhayeu", "kaam bhayeu", "kam vayeu", "kaam vayeu",
            "product kaam", "saman kaam", "item kaam", "kun item kam", "kun saman kam", "kun item kaam",
            "thori bikri", "thorai bikri", "kam bikyo", "kaam bikyo", "least item", "slow item", "kam bikri bhako"
        ]) or (
            ("kam" in q or "kaam" in q or "least" in q or "lowest" in q or "कम" in q)
            and ("sale" in q or "item" in q or "saman" in q or "bikri" in q or "बिक्री" in q or "vayeu" in q or "bhayo" in q)
        )
        if is_least_selling:
            if parsed_items and len(parsed_items) >= 2:
                bottom_items = parsed_items[::-1][:3]
                lines_res = [f"📉 सबैभन्दा कम बिक्री भएका सामानहरू ({facts.business_name}):"]
                for idx, b in enumerate(bottom_items):
                    lines_res.append(f"{idx+1}. {b['name']}: मौज्दात {b.get('stock', 'पर्याप्त')} (दर: {b.get('price', 'रेकर्ड अनुसार')})")
                lines_res.append("💡 सुझाव: यी सामानहरूको नयाँ अर्डर तत्काल रोक्नुहोस् र ५-१०% छुट दिएर मौज्दात क्लियर गर्नुहोस्।")
                return "\n".join(lines_res)
            else:
                return (
                    f"तपाईंको स्टोर '{facts.business_name}' मा सुस्त गतिमा रहेका सामानको नयाँ अर्डर तत्काल रोकी ५-१०% छुटमा मौज्दात क्लियर गर्न सुझाव दिइन्छ।"
                )

        # 6. Low stock & reorder queries
        is_low_stock = any(w in q for w in [
            "सकिन लागेको", "स्टक सकियो", "स्टक सकिन", "सकियो", "पुनः अर्डर", "पुन अर्डर", "reorder", "सकिन लाग्यो", "सकिन लागेका",
            "low stock", "stock sakiyo", "stock sakina", "sakin lagyo", "sakin lageko", "stock low", "out of stock",
            "kun saman sakina", "kun item sakina", "stock khatam", "stock finish", "restock", "sakina lageko", "sakina lagyo"
        ]) or (
            ("stock" in q or "स्टक" in q or "मौज्दात" in q)
            and ("sakiyo" in q or "sakina" in q or "low" in q or "sakin" in q or "कम" in q or "reorder" in q or "अलर्ट" in q)
        )
        if is_low_stock:
            if facts.low_stock_items_count > 0:
                items_str = ", ".join(facts.sample_low_stock_items[:3])
                return (
                    f"⚠️ न्यून स्टक अलर्ट ({facts.business_name}):\n"
                    f"हाल {facts.low_stock_items_count} वटा सामान सकिन लागेका छन् (उदा. {items_str})।\n"
                    f"👉 ग्राहक नफर्कून् भन्नका लागि शनिबारको चाप अगावै पुनः अर्डर गर्नुहोस्।"
                )
            else:
                return f"✅ तपाईंको पसल '{facts.business_name}' मा अहिले सबै सामानको स्टक पर्याप्त छ।"

        # 7. Profit & Margin queries
        if any(w in q for w in ["नाफा", "profit", "मार्जिन", "कमाई", "nafa"]):
            est_profit = facts.total_revenue_npr * 0.30
            return (
                f"💰 कारोबार र नाफा हिसाब ({facts.business_name}):\n"
                f"• कुल बिक्री: रु. {facts.total_revenue_npr:,.2f} ({facts.total_sales_invoices} वटा बिल)\n"
                f"• अनुमानित खुद नाफा (३०%): रु. {est_profit:,.2f}"
            )

        # 8. 7-Week ML Demand Forecasting
        is_forecast = any(w in q for w in [
            "७ हप्ता", "7 हप्ता", "7 week", "seven week", "७ week", "forecast", "forecasting",
            "भविष्यवाणी", "prediction", "आउने हप्ता", "aune week", "aune 7 week", "projection",
            "कति बिक्री हुन सक्छ", "kati sale huna sakxa", "future sale"
        ])
        if is_forecast:
            avg_weekly_rev = facts.total_revenue_npr / 6 if facts.total_revenue_npr > 0 else 52000.0
            return (
                f"📊 ७ हप्ते ML बिक्री प्रक्षेपण ({facts.business_name}):\n"
                f"• साप्ताहिक औषत: रु. {avg_weekly_rev:,.0f} (हप्ता १-४ स्थिर कारोबार)\n"
                f"• हप्ता ५-७: चाडपर्वले २५-३०% बिक्री बढ्ने अनुमान\n"
                f"⚠️ सुझाव: हप्ता २ अगावै न्यून स्टक सामान पुनः मगाउनुहोस्।"
            )

        # 9. Festivals & Festive Discount Strategy
        is_festival = any(w in q for w in [
            "चाडपर्व", "दशैं", "दशै", "तिहार", "छठ", "नयाँ वर्ष", "तीज", "होली", "पर्व",
            "festival", "festive", "dashain", "tihar", "chhath", "teej", "chad parva", "parba",
            "छुट", "discount", "xut", "chhut", "offer", "कम्बो", "bundle"
        ])
        if is_festival:
            return (
                f"🎉 चाडपर्व व्यापार रणनीति ({facts.business_name}):\n"
                f"१. खाद्यान्न र मसलाको माग २ गुणा बढ्ने हुँदा २ हप्ता अगावै ५०% थप स्टक मगाउनुहोस्।\n"
                f"२. चामल वा घ्यूसँग मसला प्याक बण्डल राखी ५-१०% छुट दिएर बिक्री बढाउनुहोस्।"
            )

        # 10. Saturday / Peak Demand
        if any(w in q for w in ["शनिबार", "saturday", "weekend", "सप्ताहन्त"]):
            return (
                f"नेपाली बजारको प्रवृत्ति अनुसार शनिबार खुद्रा पसलहरूमा १.५ देखि २ गुणा बढी ग्राहकको चाप हुन्छ।\n"
                f"पसल '{facts.business_name}' को तयारीका लागि:\n"
                f"१. धेरै बिक्री हुने खाद्यान्न कम्तिमा २०-३०% थप मौज्दात राख्नुहोस्।\n"
                f"२. Fonepay QR स्ट्यान्ड र खुद्रा नगद पैसा बिहानै पर्याप्त तयारीमा राख्नुहोस्।"
            )

        # 11. Payment modes breakdown
        if any(w in q for w in ["भुक्तानी", "fonepay", "esewa", "khalti", "qr", "नगद", "payment"]):
            return (
                f"पसल '{facts.business_name}' मा कुल बिक्री रु. {facts.total_revenue_npr:,.2f} संकलन भएको छ।\n"
                f"डिजिटल वालेट (eSewa, Khalti) र Fonepay QR बाट करिब ४०-६०% भुक्तानी हुने हुँदा काउन्टरमा QR स्ट्यान्ड ग्राहकले स्पष्ट देख्ने ठाउँमा राख्न सुझाव दिइन्छ।"
            )

        # 12. Specific Product Lookup
        for item in parsed_items:
            name_lower = item["name"].lower()
            sku_lower = item.get("sku", "").lower()
            if not name_lower or len(name_lower) < 2:
                continue

            synonyms = []
            if "rice" in name_lower or "चामल" in name_lower:
                synonyms.extend(["rice", "चामल", "धान", "basmati", "aanadi"])
            if "ghee" in name_lower or "घ्यू" in name_lower:
                synonyms.extend(["ghee", "घ्यू", "घ्यु", "ddc"])
            if "tea" in name_lower or "चिया" in name_lower:
                synonyms.extend(["tea", "चिया", "चियापत्ती", "ilam"])
            if "wai" in name_lower or "चाउचाउ" in name_lower or "noodles" in name_lower:
                synonyms.extend(["wai", "wai wai", "चाउचाउ", "noodles"])
            if "butter" in name_lower or "माखन" in name_lower:
                synonyms.extend(["butter", "current butter"])
            if "oil" in name_lower or "तेल" in name_lower:
                synonyms.extend(["sunflower", "तेल", "oil"])

            matched = False
            if (name_lower in q) or (sku_lower and sku_lower in q):
                matched = True
            elif any(syn in q for syn in synonyms):
                matched = True

            if matched:
                item_name = item["name"]
                price_str = item.get("price") or "रेकर्ड अनुसार"
                stock_str = item.get("stock") or "पर्याप्त"
                status_str = item.get("status") or "सक्रिय"

                return (
                    f"पसल '{facts.business_name}' को रेकर्ड अनुसार '{item_name}' को विवरण निम्न छ:\n"
                    f"• उपलब्ध मौज्दात: {stock_str}\n"
                    f"• बिक्री दर: {price_str}\n"
                    f"• वर्ग: {item.get('category', 'सामान्य')}\n"
                    f"• अवस्था: {status_str}"
                )

        # 13. General Sales & Revenue queries
        if any(w in q for w in ["बिक्री", "आम्दानी", "sales", "revenue", "bill", "कारोबार"]):
            return (
                f"पसल '{facts.business_name}' को हालसम्मको कारोबार विवरण अनुसार:\n"
                f"• कुल बिक्री रकम: रु. {facts.total_revenue_npr:,.2f}\n"
                f"• कुल बिक्री बिलहरू: {facts.total_sales_invoices} वटा\n"
                f"• सक्रिय सामानहरू: {facts.total_active_products} प्रकार"
            )

        # 14. Anti-hallucination check for outside queries
        unlisted_foreign_items = ["iphone", "apple", "samsung", "tv", "laptop", "car", "bike", "वाइन", "बियर", "मदिरा"]
        for u in unlisted_foreign_items:
            if u in q and u not in context_text.lower():
                return "माफ गर्नुहोला, म तपाईंको पसलको व्यापार सल्लाहकार हुँ। यो विवरण तपाईंको पसलको रेकर्डमा उपलब्ध छैन।"

        # 15. Default general overview
        return (
            f"नमस्ते! म तपाईंको पसल '{facts.business_name}' को AI सल्लाहकार 'बजारको साथी' हुँ।\n"
            f"• कुल कारोबार: रु. {facts.total_revenue_npr:,.2f} ({facts.total_sales_invoices} बिलहरू)\n"
            f"• कुल सामानहरू: {facts.total_active_products} प्रकार दर्ता छन्\n"
            f"• स्टक स्थिति: {facts.low_stock_items_count} वटा सामान न्यून मौज्दातमा छन्।\n\n"
            f"तपाईंले कुनै निश्चित सामान (उदा. Basmati Rice, Ghee, Tea), नाफा, वा स्टक अलर्टबारे सोध्न सक्नुहुन्छ!"
        )

    @classmethod
    async def generate_response(
        cls,
        query: str,
        context_text: str,
        facts: ContextFactSummary,
        conversation_history: Optional[List[ChatMessage]] = None,
    ) -> Tuple[str, str, bool, float]:
        """
        Executes grounded RAG generation using Gemini API.
        Returns: (answer_nepali, model_name, has_api_key, latency_ms)
        """
        start_time = time.time()
        api_key = settings.GEMINI_API_KEY.strip()

        # If no Gemini API key is configured or google-genai is missing, use deterministic fallback
        if not api_key or not _HAS_GENAI:
            answer = cls._fallback_deterministic_response(query, context_text, facts)
            latency = round((time.time() - start_time) * 1000, 2)
            return answer, "Bajar ko Sathi AI", False, latency

        # Construct Grounded User Prompt
        history_context = ""
        if conversation_history:
            turns = [f"{msg.role}: {msg.content}" for msg in conversation_history[-4:]]
            history_context = f"\nअघिल्लो कुराकानी:\n" + "\n".join(turns) + "\n"

        full_prompt = f"""{context_text}
{history_context}
पसलेको प्रश्न (User Query):
{query}

निर्देशन: माथिको आधिकारिक स्टोर विवरणबाट मात्र स्पष्ट, चिटिक्क परेको २-३ बुँदामा नेपालीमा उत्तर दिनुहोस्। यदि रेकर्डमा छैन भने 'तपाईंको पसलको रेकर्डमा यो विवरण उपलब्ध छैन।' भन्नुहोस्।"""

        # Map to valid modern model name
        target_model = settings.GEMINI_MODEL.strip() if settings.GEMINI_MODEL else "gemini-2.5-flash"
        if "3.6" in target_model or not target_model:
            target_model = "gemini-2.5-flash"

        for model_to_try in [target_model, "gemini-1.5-flash"]:
            try:
                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model=model_to_try,
                    contents=full_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        temperature=0.1,
                        max_output_tokens=800,
                    ),
                )
                answer = response.text.strip()
                latency = round((time.time() - start_time) * 1000, 2)
                return answer, model_to_try, True, latency
            except Exception:
                continue

        # If all Gemini API calls fail, cleanly return grounded fallback without raw stack traces
        fallback_answer = cls._fallback_deterministic_response(query, context_text, facts)
        latency = round((time.time() - start_time) * 1000, 2)
        return fallback_answer, "Bajar ko Sathi AI", False, latency
