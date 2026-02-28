import os
import uuid
import json
import base64
import requests as http_requests
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from openai import OpenAI

from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

load_dotenv()

# ── Config ──────────────────────────────────────────────────────────────────
OPENAI_API_KEY  = os.environ["OPENAI_API_KEY"]
GOOGLE_API_KEY  = os.environ["GOOGLE_API_KEY"]
GENERATED_DIR   = Path(__file__).parent / "generated"
GENERATED_DIR.mkdir(exist_ok=True)

openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Google Generative AI REST endpoints (avoids SDK version compatibility issues)
_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_IMAGE_URL = f"{_BASE}/gemini-2.0-flash-exp-image-generation:generateContent?key={GOOGLE_API_KEY}"
IMAGEN_URL       = f"{_BASE}/imagen-4.0-fast-generate-001:predict?key={GOOGLE_API_KEY}"

# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(title="EstateOS AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/generated", StaticFiles(directory=str(GENERATED_DIR)), name="generated")


# ── Request / Response models ────────────────────────────────────────────────
class HistoryItem(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[HistoryItem] = []


# ── Intent classification ────────────────────────────────────────────────────
INTENT_SYSTEM = """You are an intent classifier for a real estate AI assistant.

Given a user message, classify it into EXACTLY one of these intents:
- "schematic": The user wants a floor plan, architectural schematic, property layout, building diagram, or any visual/spatial representation of a property.
- "pdf_report": The user wants a comprehensive written report, market analysis, property valuation, investment analysis, CMA (Comparative Market Analysis), or any document-style output.
- "chat": General real estate questions, advice, conversational queries that need a text answer.

Respond ONLY with a JSON object — no markdown, no explanation:
{"intent": "schematic|pdf_report|chat", "subject": "brief description of what to generate"}
"""

def classify_intent(message: str, history: list[HistoryItem]) -> tuple[str, str]:
    messages = [{"role": "system", "content": INTENT_SYSTEM}]
    for h in history[-6:]:  # last 3 turns for context
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": message})

    resp = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0,
        max_tokens=100,
    )
    raw = resp.choices[0].message.content.strip()
    data = json.loads(raw)
    return data["intent"], data.get("subject", message)


# ── Schematic generation (Google Imagen / Gemini via REST) ───────────────────
def generate_schematic(subject: str) -> dict:
    prompt = (
        f"Create a clean, professional architectural floor plan or schematic for: {subject}. "
        "Top-down 2D blueprint style with labeled rooms, dimensions, clear black lines "
        "on a white background. Include a compass rose and scale bar."
    )

    try:
        # ── Strategy 1: Imagen 4 Fast (predict endpoint) ─────────────────────
        imagen_payload = {
            "instances": [{"prompt": prompt}],
            "parameters": {"sampleCount": 1},
        }
        r = http_requests.post(IMAGEN_URL, json=imagen_payload, timeout=60)
        if r.ok:
            preds = r.json().get("predictions", [])
            if preds:
                b64_data  = preds[0].get("bytesBase64Encoded", "")
                mime_type = preds[0].get("mimeType", "image/png")
                if b64_data:
                    return {
                        "type": "image",
                        "imageUrl": f"data:{mime_type};base64,{b64_data}",
                        "message": f"Here is the schematic for: {subject}",
                    }

        # ── Strategy 2: Gemini 2.0 Flash image-gen (generateContent) ─────────
        gemini_payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
        }
        r2 = http_requests.post(GEMINI_IMAGE_URL, json=gemini_payload, timeout=60)
        if r2.ok:
            parts = r2.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])
            for part in parts:
                if "inlineData" in part:
                    mime_type = part["inlineData"].get("mimeType", "image/png")
                    b64_data  = part["inlineData"].get("data", "")
                    if b64_data:
                        return {
                            "type": "image",
                            "imageUrl": f"data:{mime_type};base64,{b64_data}",
                            "message": f"Here is the schematic for: {subject}",
                        }
            text_parts = [p.get("text", "") for p in parts if "text" in p]
            if text_parts:
                return {"type": "text", "message": " ".join(text_parts)}

        raise RuntimeError(f"Imagen HTTP {r.status_code}, Gemini HTTP {r2.status_code}")

    except Exception as exc:
        fallback = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a real estate architect. Describe a detailed floor plan layout in text.",
                },
                {"role": "user", "content": f"Describe a floor plan for: {subject}"},
            ],
            max_tokens=400,
        )
        return {
            "type": "text",
            "message": (
                f"⚠️ Image generation unavailable ({exc}). "
                f"Here is a text description instead:\n\n"
                f"{fallback.choices[0].message.content}"
            ),
        }


# ── PDF report generation ────────────────────────────────────────────────────
REPORT_SYSTEM = """You are an expert real estate analyst. Generate a comprehensive, structured
property report based on the user's request. Return a JSON object with this exact structure:

{
  "title": "Report title",
  "subtitle": "e.g. Prepared by EstateOS AI",
  "executive_summary": "2-3 sentence overview",
  "property_details": [
    ["Field", "Value"],
    ["Property Type", "Single Family Home"],
    ...
  ],
  "sections": [
    {
      "heading": "Market Analysis",
      "body": "Detailed paragraph text..."
    },
    ...
  ],
  "key_metrics": [
    ["Metric", "Value", "Note"],
    ["Estimated Value", "$450,000", "Based on comps"],
    ...
  ],
  "conclusion": "Final recommendation paragraph"
}

Include at least: Market Analysis, Location Overview, Investment Outlook, and Recommendations sections.
Use realistic, plausible data even if hypothetical — label it as estimated."""

def generate_pdf_report(subject: str, message: str) -> dict:
    resp = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": REPORT_SYSTEM},
            {"role": "user", "content": f"Generate a real estate report for: {message}"},
        ],
        max_tokens=2000,
        temperature=0.7,
    )
    raw = resp.choices[0].message.content.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    report_data = json.loads(raw)

    filename  = f"report_{uuid.uuid4().hex[:8]}.pdf"
    filepath  = GENERATED_DIR / filename

    _build_pdf(filepath, report_data)

    return {
        "type": "pdf",
        "pdfUrl": f"http://localhost:8000/generated/{filename}",
        "pdfFilename": filename,
        "message": f"Your report **\"{report_data.get('title', 'Property Report')}\"** is ready.",
    }


def _build_pdf(filepath: Path, data: dict):
    doc = SimpleDocTemplate(
        str(filepath),
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=1 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    BRAND    = colors.HexColor("#0891B2")
    DARK     = colors.HexColor("#0F172A")
    MUTED    = colors.HexColor("#64748B")
    LIGHT_BG = colors.HexColor("#F5F0EB")

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=26,
        textColor=BRAND,
        spaceAfter=4,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=MUTED,
        spaceAfter=16,
        alignment=TA_CENTER,
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=BRAND,
        spaceBefore=14,
        spaceAfter=6,
        fontName="Helvetica-Bold",
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=10,
        textColor=DARK,
        leading=15,
        spaceAfter=8,
    )
    summary_style = ParagraphStyle(
        "Summary",
        parent=styles["Normal"],
        fontSize=10,
        textColor=DARK,
        leading=15,
        backColor=LIGHT_BG,
        borderPadding=(8, 10, 8, 10),
        spaceAfter=12,
    )

    story = []

    header_data = [[Paragraph(
        f'<font color="white"><b>{data.get("title", "Property Report")}</b></font>',
        ParagraphStyle("H", fontSize=20, textColor=colors.white, fontName="Helvetica-Bold"),
    )]]
    header_table = Table(header_data, colWidths=[7 * inch])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND),
        ("TOPPADDING",    (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING",   (0, 0), (-1, -1), 16),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 16),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [BRAND]),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.1 * inch))

    story.append(Paragraph(data.get("subtitle", "Prepared by EstateOS AI"), subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=LIGHT_BG, spaceAfter=10))

    if data.get("executive_summary"):
        story.append(Paragraph("Executive Summary", section_heading))
        story.append(Paragraph(data["executive_summary"], summary_style))

    if data.get("property_details"):
        story.append(Paragraph("Property Details", section_heading))
        rows = data["property_details"]
        t = Table(rows, colWidths=[2.5 * inch, 4.5 * inch])
        t.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (0, -1), LIGHT_BG),
            ("BACKGROUND",   (0, 0), (-1,  0), BRAND),
            ("TEXTCOLOR",    (0, 0), (-1,  0), colors.white),
            ("FONTNAME",     (0, 0), (-1,  0), "Helvetica-Bold"),
            ("FONTNAME",     (0, 0), (0,  -1), "Helvetica-Bold"),
            ("FONTSIZE",     (0, 0), (-1, -1), 9),
            ("GRID",         (0, 0), (-1, -1), 0.5, colors.HexColor("#EBE6E0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
            ("TOPPADDING",   (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
            ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.1 * inch))

    for section in data.get("sections", []):
        story.append(Paragraph(section.get("heading", ""), section_heading))
        story.append(Paragraph(section.get("body", ""), body_style))

    if data.get("key_metrics"):
        story.append(Paragraph("Key Metrics", section_heading))
        rows = data["key_metrics"]
        col_count = len(rows[0]) if rows else 3
        col_w = 7 * inch / col_count
        t = Table(rows, colWidths=[col_w] * col_count)
        t.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1,  0), BRAND),
            ("TEXTCOLOR",    (0, 0), (-1,  0), colors.white),
            ("FONTNAME",     (0, 0), (-1,  0), "Helvetica-Bold"),
            ("FONTSIZE",     (0, 0), (-1, -1), 9),
            ("GRID",         (0, 0), (-1, -1), 0.5, colors.HexColor("#EBE6E0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
            ("TOPPADDING",   (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
            ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.1 * inch))

    if data.get("conclusion"):
        story.append(Paragraph("Conclusion & Recommendations", section_heading))
        story.append(Paragraph(data["conclusion"], body_style))

    story.append(Spacer(1, 0.2 * inch))
    story.append(HRFlowable(width="100%", thickness=1, color=MUTED))
    story.append(Paragraph(
        "Generated by EstateOS AI · For informational purposes only",
        ParagraphStyle("Footer", fontSize=8, textColor=MUTED, alignment=TA_CENTER),
    ))

    doc.build(story)


# ── Chat (general) ────────────────────────────────────────────────────────────
def generate_chat_response(message: str, history: list[HistoryItem]) -> dict:
    messages = [
        {
            "role": "system",
            "content": (
                "You are a knowledgeable and friendly real estate AI assistant for EstateOS. "
                "Provide helpful, accurate, and concise answers about real estate topics. "
                "You can help with property valuations, market trends, investment advice, "
                "neighborhood analysis, and general real estate guidance."
            ),
        }
    ]
    for h in history[-10:]:
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": message})

    resp = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        max_tokens=600,
        temperature=0.7,
    )
    return {"type": "text", "message": resp.choices[0].message.content}


# ── Main endpoint ─────────────────────────────────────────────────────────────
@app.post("/api/chat-report")
async def chat_report(request: ChatRequest):
    try:
        intent, subject = classify_intent(request.message, request.history)

        if intent == "schematic":
            result = generate_schematic(subject)
        elif intent == "pdf_report":
            result = generate_pdf_report(subject, request.message)
        else:
            result = generate_chat_response(request.message, request.history)

        return JSONResponse(content={"intent": intent, **result})

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok"}
