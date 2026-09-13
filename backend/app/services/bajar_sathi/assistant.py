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


SYSTEM_INSTRUCTION = """तपाईं 'बजारको साथी' (Bajar ko Sathi) हुनुहुन्छ — नेपालका खुद्रा तथा थोक पसलेहरूलाई व्यवसाय सञ्चालन, इन्भेन्टरी र बिक्री व्यवस्थापनमा सहयोग गर्ने एक भरपर्दो AI साथी।

कडा नियमहरू (STRICT ANTI-HALLUCINATION RULES):
१. तपाईंले केवल तल दिइएको "पसलको आधिकारिक डाटाबेस विवरण (STORE FACTS)" भित्र रहेका तथ्य, मौज्दात (Stock) संख्या र रकमहरूको आधारमा मात्र उत्तर दिनुपर्छ।
२. यदि प्रयोगकर्ताले सोधेको कुनै पनि सामान (Product), मूल्य, वा ग्राहकको विवरण उपलब्ध डाटाबेसमा छैन भने, आफ्नै मनगढन्ते उत्तर (Hallucination) नदिनुहोस्। सिधै विनम्रताका साथ भन्नुहोस्: "माफ गर्नुहोला, तपाईंको पसलको रेकर्डमा यो विवरण उपलब्ध छैन।"
३. उत्तर शुद्ध, स्पष्ट, व्यावसायिक र मिठो नेपाली भाषामा हुनुपर्छ। रकमहरू उल्लेख गर्दा 'रु.' वा 'NPR' प्रयोग गर्नुहोस्।
४. यदि कुनै सामानको स्टक सकिन लागेको (Low Stock) छ भने, पसलेलाई नयाँ सामान तुरुन्तै अर्डर गर्न सुझाव दिनुहोस्।
५. बाहिरको कुनै पनि काल्पनिक जानकारी नजोड्नुहोस्।"""


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
        Contextual rule-based Nepali response when GEMINI_API_KEY is not configured.
        Guarantees 100% database-grounded answers without hallucination.
        """
        q = query.lower()

        # 1. Anti-hallucination check: Detect queries for items not in store catalog
        unlisted_foreign_items = [
            "iphone", "apple", "samsung", "mobile", "phone", "tv", "laptop", "car", "bike",
            "कपडा", "जुत्ता", "औषधि", "दवाइ", "गोली", "वाइन", "बियर", "मदिरा"
        ]
        if any(u in q for u in unlisted_foreign_items):
            return "माफ गर्नुहोला, तपाईंको पसलको रेकर्डमा यो विवरण उपलब्ध छैन।"

        # 2. Specific product queries
        # Check if query asks for a specific in-catalog item vs unknown item
        if "को स्टक" in q or "कति छ" in q or "मूल्य" in q:
            # Check if any known catalog name or SKU is in query
            catalog_match = False
            for line in context_text.splitlines():
                if line.startswith("- SKU:"):
                    for seg in line.split("|"):
                        if "सामान:" in seg or "SKU:" in seg:
                            term = seg.split(":")[-1].strip().lower()
                            if term and term in q:
                                catalog_match = True
                                break
            # If query asked for a specific item's stock/price but no catalog item matched
            if not catalog_match and ("स्टक कति" in q or "मूल्य कति" in q):
                return "माफ गर्नुहोला, तपाईंको पसलको रेकर्डमा यो विवरण उपलब्ध छैन।"

        # 3. Low stock & reorder queries
        if any(w in q for w in ["सकिन", "सकियो", "कम", "थोरै", "reorder", "पुनः"]):
            if facts.low_stock_items_count > 0:
                items_str = ", ".join(facts.sample_low_stock_items)
                return (
                    f"नमस्ते! तपाईंको पसल '{facts.business_name}' मा हाल {facts.low_stock_items_count} वटा सामानको स्टक सकिन लागेको छ।\n"
                    f"पुनः अर्डर गर्नुपर्ने सामानहरू: {items_str}।\n"
                    f"कृपया ग्राहकहरूको माग पूरा गर्न यी सामानहरू छिट्टै मगाउनुहोला।"
                )
            else:
                return (
                    f"नमस्ते! तपाईंको पसल '{facts.business_name}' मा अहिले सबै सामानको स्टक पर्याप्त छ। "
                    f"हाल कुनै पनि सामान सकिन लागेको छैन।"
                )

        # 4. General stock overview
        if "स्टक" in q or "stock" in q or "मौज्दात" in q:
            items_str = ", ".join(facts.sample_low_stock_items) if facts.sample_low_stock_items else "कुनै छैन"
            return (
                f"नमस्ते! तपाईंको पसल '{facts.business_name}' मा कुल {facts.total_active_products} प्रकारका सामानहरू स्टकमा छन्।\n"
                f"- सकिन लागेका सामानहरू: {facts.low_stock_items_count} वटा ({items_str})।"
            )

        # 5. Sales & Revenue queries
        if any(w in q for w in ["बिक्री", "आम्दानी", "पैसा", "कमाई", "sales", "revenue", "bill", "कारोबार"]):
            return (
                f"तपाईंको पसल '{facts.business_name}' को हालसम्मको कारोबार विवरण अनुसार:\n"
                f"- जम्मा बिक्री बिलहरू: {facts.total_sales_invoices} वटा\n"
                f"- कुल बिक्री रकम: रु. {facts.total_revenue_npr:,.2f} संकलन भएको छ।"
            )

        # 6. Default general summary
        return (
            f"नमस्ते! म तपाईंको 'बजारको साथी' हुँ।\n"
            f"तपाईंको पसल '{facts.business_name}' मा हाल {facts.total_active_products} प्रकारका सामानहरू दर्ता छन्।\n"
            f"कुल बिक्री आम्दानी रु. {facts.total_revenue_npr:,.2f} रहेको छ र {facts.low_stock_items_count} वटा सामानको मौज्दात कम छ। "
            f"थप केही जान्न चाहनुहुन्छ भने सोध्नुहोस्!"
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
            return answer, "Rule-Based Grounded Engine (Local Dev)", False, latency

        # Construct Grounded User Prompt
        history_context = ""
        if conversation_history:
            turns = [f"{msg.role}: {msg.content}" for msg in conversation_history[-4:]]
            history_context = f"\nअघिल्लो कुराकानी:\n" + "\n".join(turns) + "\n"

        full_prompt = f"""{context_text}
{history_context}
पसलेको प्रश्न (User Query):
{query}

निर्देशन: माथिको आधिकारिक स्टोर विवरणबाट मात्र नेपालीमा उत्तर दिनुहोस्। यदि रेकर्डमा छैन भने 'माफ गर्नुहोला, तपाईंको पसलको रेकर्डमा यो विवरण उपलब्ध छैन।' भन्नुहोस्।"""

        try:
            client = genai.Client(api_key=api_key)
            model_name = settings.GEMINI_MODEL or "gemini-3.6-flash"

            # Use client.models.generate_content with temperature=0.1 for strict factual grounding
            response = client.models.generate_content(
                model=model_name,
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    temperature=0.1,
                    max_output_tokens=800,
                ),
            )

            answer = response.text.strip()
            latency = round((time.time() - start_time) * 1000, 2)
            return answer, model_name, True, latency

        except Exception as e:
            # If Gemini API returns an error (e.g. invalid key or rate limit), fail safely to grounded fallback
            fallback_answer = cls._fallback_deterministic_response(query, context_text, facts)
            latency = round((time.time() - start_time) * 1000, 2)
            return (
                f"{fallback_answer}\n\n(नोट: Gemini API मा समस्या देखिएकाले स्थानीय रेकर्डबाट उत्तर प्रदान गरिएको छ: {str(e)[:100]})",
                "Fallback Local Engine",
                False,
                latency,
            )
