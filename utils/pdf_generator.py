"""
SkillDNA AI - Professional Study Notes PDF Generator
Generates high-fidelity, production-grade PDF study materials using ReportLab.
Includes dynamic multi-page canvas, running headers/footers with 'Page X of Y',
branding, structured learning hierarchy, and Admin-configurable background watermark.
"""

import io
import html
import re
from datetime import datetime
from typing import Dict, Any, List, Optional

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas


class NumberedCanvasWithWatermark(canvas.Canvas):
    """
    Two-pass canvas that computes exact total page count, draws running
    headers/footers ('Page X of Y'), and renders the admin-configured watermark.
    """

    def __init__(self, *args, **kwargs):
        self.watermark_settings = kwargs.pop("watermark_settings", {})
        self.doc_topic = kwargs.pop("doc_topic", "Study Notes")
        self.doc_domain = kwargs.pop("doc_domain", "SkillDNA AI")
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_decorations(self, page_count: int):
        page_w, page_h = letter

        # Official SkillDNA AI Learning mark: vector-built so PDFs do not depend on a missing web asset.
        self.saveState()
        self.setFillColor(colors.HexColor("#0284c7"))
        self.circle(63, page_h - 32, 9, stroke=0, fill=1)
        self.setStrokeColor(colors.white)
        self.setLineWidth(1.2)
        self.line(59, page_h - 32, 63, page_h - 27)
        self.line(63, page_h - 27, 67, page_h - 32)
        self.line(59, page_h - 32, 63, page_h - 37)
        self.line(63, page_h - 37, 67, page_h - 32)
        self.setFillColor(colors.HexColor("#0f172a"))
        self.setFont("Helvetica-Bold", 8)
        self.drawString(77, page_h - 35, "SKILLDNA AI LEARNING")
        self.restoreState()

        # 1. Background Watermark (Rendered below text)
        wm = self.watermark_settings or {}
        wm_enabled = wm.get("enabled", True)
        if wm_enabled:
            wm_text = wm.get("text", "SkillDNA AI") or "SkillDNA AI"
            wm_opacity = float(wm.get("opacity", 0.035))
            wm_opacity = max(0.01, min(0.35, wm_opacity))
            wm_size = int(wm.get("fontSize", 48))
            wm_rotation = int(wm.get("rotation", 45))
            wm_position = wm.get("position", "center").lower()

            self.saveState()
            try:
                self.setFillAlpha(wm_opacity)
            except Exception:
                pass  # Fallback if setFillAlpha not supported by canvas
            self.setFillColor(colors.HexColor("#94a3b8"))
            self.setFont("Helvetica-Bold", wm_size)

            if wm_position == "top":
                cx, cy = page_w / 2, page_h * 0.75
            elif wm_position == "bottom":
                cx, cy = page_w / 2, page_h * 0.25
            else:
                cx, cy = page_w / 2, page_h / 2

            self.translate(cx, cy)
            self.rotate(wm_rotation)
            self.drawCentredString(0, 0, wm_text)
            self.restoreState()

        # 2. Running Header (Pages > 1)
        if self._pageNumber > 1:
            self.saveState()
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#0284c7"))
            self.drawString(77, page_h - 48, "SKILLDNA AI")

            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748b"))
            self.drawString(120, page_h - 36, f"|  {self.doc_topic[:45]}")

            self.drawRightString(page_w - 54, page_h - 36, f"{self.doc_domain[:35]}")

            # Divider line
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.6)
            self.line(54, page_h - 42, page_w - 54, page_h - 42)
            self.restoreState()

        # 3. Running Footer (All pages)
        self.saveState()
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.6)
        self.line(54, 46, page_w - 54, 46)

        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(54, 32, "SkillDNA AI Academic Study Guide  •  Confidential Student Learning Material")

        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(page_w - 54, 32, page_str)
        self.restoreState()


def sanitize_pdf_text(text: Any) -> str:
    """Escapes XML/HTML tags and translates basic markdown formatting safely."""
    if text is None:
        return ""
    if not isinstance(text, str):
        text = str(text)

    # Clean leading/trailing
    text = text.strip()
    # Escape special XML chars
    text = html.escape(text)

    # Convert basic bold & italic markdown safely
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"\*(.+?)\*", r"<i>\1</i>", text)
    text = re.sub(r"`(.+?)`", r'<font face="Courier">\1</font>', text)
    # Convert newlines to breaks
    text = text.replace("\n\n", "<br/><br/>").replace("\n", "<br/>")
    return text


def build_notes_pdf(
    note_data: Dict[str, Any],
    watermark_settings: Optional[Dict[str, Any]] = None,
    student_name: str = "SkillDNA Student",
) -> bytes:
    """
    Builds a professional study guide PDF from student note data.
    Returns the binary PDF bytes.
    """
    topic = note_data.get("topic") or "General Study Notes"
    domain = note_data.get("domain") or note_data.get("discipline") or "Academic Career Preparation"
    level = note_data.get("level") or "Intermediate"
    created_at = note_data.get("createdAt") or datetime.utcnow()
    if isinstance(created_at, datetime):
        date_str = created_at.strftime("%B %d, %Y")
    elif isinstance(created_at, str) and created_at:
        date_str = created_at[:10]
    else:
        date_str = datetime.utcnow().strftime("%B %d, %Y")

    artifacts = note_data.get("artifacts") or {}

    summary = note_data.get("summary") or artifacts.get("summary") or ""
    detailed_notes = note_data.get("detailedNotes") or artifacts.get("detailed_notes") or artifacts.get("detailedNotes") or ""
    key_points = note_data.get("keyPoints") or artifacts.get("key_points") or artifacts.get("keyPoints") or []
    quick_revision = note_data.get("quickRevision") or artifacts.get("revision_sheet") or artifacts.get("quickRevision") or []
    questions = note_data.get("questions") or artifacts.get("qna") or artifacts.get("questions") or []
    quiz = note_data.get("quiz") or artifacts.get("quiz") or []

    # Structure check for learning objectives and prerequisites
    objectives = artifacts.get("objectives") or [
        f"Master the fundamental definitions, mechanisms, and application principles of {topic}.",
        f"Diagnose edge cases, trade-offs, and compliance standards specific to {domain}.",
        "Apply systematic first-principles problem solving to industry interview and practice challenges."
    ]
    prerequisites = artifacts.get("prerequisites") or [
        f"Foundational knowledge of {domain} terminology and core principles.",
        "Basic competency in analytical problem deconstruction."
    ]

    # Setup Document
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    # Styles
    base_styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "DocTitle",
        parent=base_styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=6,
    )

    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=base_styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=14,
        spaceAfter=6,
    )

    subsection_heading = ParagraphStyle(
        "SubSectionHeading",
        parent=base_styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#0369a1"),
        spaceBefore=8,
        spaceAfter=4,
    )

    body_style = ParagraphStyle(
        "Body",
        parent=base_styles["BodyText"],
        fontName="Helvetica",
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor("#334155"),
        spaceAfter=6,
    )

    bullet_style = ParagraphStyle(
        "Bullet",
        parent=base_styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#334155"),
        leftIndent=12,
        spaceAfter=3,
    )

    callout_style = ParagraphStyle(
        "Callout",
        parent=base_styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#0f172a"),
    )

    meta_label = ParagraphStyle(
        "MetaLabel",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#64748b"),
    )

    meta_val = ParagraphStyle(
        "MetaVal",
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
    )

    story = []

    # ----------------------------------------------------
    # COVER / HEADER BANNER
    # ----------------------------------------------------
    badge_data = [
        [
            Paragraph(
                '<font color="#0284c7"><b>SKILLDNA AI</b></font>  •  '
                '<font color="#64748b">OFFICIAL ACADEMIC STUDY GUIDE</font>',
                ParagraphStyle("BrandHeader", fontName="Helvetica-Bold", fontSize=8, leading=10),
            )
        ]
    ]
    badge_table = Table(badge_data, colWidths=[504])
    badge_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(badge_table)
    story.append(Spacer(1, 10))

    # Title
    story.append(Paragraph(sanitize_pdf_text(topic), title_style))

    # Meta Table (2x2 grid)
    meta_table_data = [
        [
            Paragraph("STUDENT CANDIDATE", meta_label),
            Paragraph("CAREER DOMAIN", meta_label),
            Paragraph("PROFICIENCY LEVEL", meta_label),
            Paragraph("VERIFIED DATE", meta_label),
        ],
        [
            Paragraph(sanitize_pdf_text(student_name), meta_val),
            Paragraph(sanitize_pdf_text(domain), meta_val),
            Paragraph(sanitize_pdf_text(level), meta_val),
            Paragraph(sanitize_pdf_text(date_str), meta_val),
        ],
    ]
    meta_table = Table(meta_table_data, colWidths=[126, 150, 114, 114])
    meta_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ])
    )
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # Long study guides get a readable contents overview before the detailed sections.
    if len(detailed_notes) > 1200 or len(questions) >= 3 or len(quiz) >= 3:
        contents = [
            "1. Executive Summary & Learning Objectives",
            "2. Core Concepts & Theoretical Mechanics",
            "3. High-Yield Key Points",
            "4. Quick Revision Sheet",
            "5. Practice Questions & Worked Examples",
            "6. Assessment and Mastery Check",
        ]
        story.append(Paragraph("Contents", section_heading))
        story.append(Paragraph("<br/>".join(f"{idx + 1}. {sanitize_pdf_text(item.split('. ', 1)[1])}" for idx, item in enumerate(contents)), body_style))
        story.append(Spacer(1, 6))

    # Divider
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0284c7"), spaceAfter=10))

    # ----------------------------------------------------
    # SECTION 1: EXECUTIVE OVERVIEW & LEARNING OBJECTIVES
    # ----------------------------------------------------
    story.append(Paragraph("1. Executive Summary & Learning Objectives", section_heading))

    if summary:
        story.append(Paragraph(sanitize_pdf_text(summary), body_style))
        story.append(Spacer(1, 4))

    # Objectives Callout Table
    obj_rows = [
        [
            Paragraph(
                "<b>Learning Objectives for this Module:</b><br/>"
                + "<br/>".join([f"• {sanitize_pdf_text(o)}" for o in objectives]),
                callout_style,
            )
        ]
    ]
    obj_table = Table(obj_rows, colWidths=[504])
    obj_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eff6ff")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#93c5fd")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ])
    )
    story.append(obj_table)
    story.append(Spacer(1, 10))

    # ----------------------------------------------------
    # SECTION 2: DEEP CONCEPTUAL BREAKDOWN
    # ----------------------------------------------------
    story.append(Paragraph("2. Core Concepts & Theoretical Mechanics", section_heading))

    if detailed_notes:
        # Split markdown headers if present
        paragraphs = detailed_notes.split("\n\n")
        for p in paragraphs:
            p_clean = p.strip()
            if not p_clean:
                continue
            if p_clean.startswith("#"):
                clean_heading = re.sub(r"^#+\s*", "", p_clean)
                story.append(Paragraph(sanitize_pdf_text(clean_heading), subsection_heading))
            elif p_clean.startswith("- ") or p_clean.startswith("* "):
                bullet_lines = p_clean.split("\n")
                for bl in bullet_lines:
                    cleaned_line = re.sub(r"^[-*]\s*", "", bl).strip()
                    if cleaned_line:
                        story.append(Paragraph(f"• {sanitize_pdf_text(cleaned_line)}", bullet_style))
            else:
                story.append(Paragraph(sanitize_pdf_text(p_clean), body_style))
    else:
        story.append(
            Paragraph(
                f"In {domain}, mastery of {topic} entails a thorough comprehension of structural fundamentals, "
                "procedural standards, and rigorous trade-off evaluation. Adherence to industry protocols guarantees "
                "repeatable outcomes and compliance with established benchmarks.",
                body_style,
            )
        )

    story.append(Spacer(1, 8))

    # ----------------------------------------------------
    # SECTION 3: HIGH-YIELD KEY TAKEAWAYS
    # ----------------------------------------------------
    if key_points:
        story.append(Paragraph("3. High-Yield Key Points (Memory Retention)", section_heading))
        kp_rows = []
        for idx, kp in enumerate(key_points[:8]):
            kp_rows.append([
                Paragraph(f"<b>Point {idx + 1}</b>", ParagraphStyle("KPNum", fontName="Helvetica-Bold", fontSize=8, textColor=colors.HexColor("#0284c7"))),
                Paragraph(sanitize_pdf_text(kp), bullet_style)
            ])
        kp_table = Table(kp_rows, colWidths=[64, 440])
        kp_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ])
        )
        story.append(kp_table)
        story.append(Spacer(1, 10))

    # ----------------------------------------------------
    # SECTION 4: QUICK REVISION SHEET
    # ----------------------------------------------------
    if quick_revision:
        story.append(Paragraph("4. Quick Revision Sheet (High Frequency Exam Notes)", section_heading))
        qr_rows = []
        for idx, item in enumerate(quick_revision[:6]):
            if isinstance(item, dict):
                term = item.get("concept") or item.get("term") or f"Key Term {idx+1}"
                definition = item.get("summary") or item.get("definition") or item.get("explanation") or ""
            else:
                parts = str(item).split(":", 1)
                term = parts[0] if len(parts) > 1 else f"Fact {idx+1}"
                definition = parts[1] if len(parts) > 1 else str(item)

            qr_rows.append([
                Paragraph(f"<b>{sanitize_pdf_text(term)}</b>", ParagraphStyle("QRTerm", fontName="Helvetica-Bold", fontSize=8, textColor=colors.HexColor("#0f172a"))),
                Paragraph(sanitize_pdf_text(definition), bullet_style)
            ])
        qr_table = Table(qr_rows, colWidths=[140, 364])
        qr_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fafafa")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ])
        )
        story.append(qr_table)
        story.append(Spacer(1, 10))

    # ----------------------------------------------------
    # SECTION 5: INTERVIEW PREPARATION & MODEL SCENARIOS
    # ----------------------------------------------------
    if questions:
        story.append(Paragraph("5. Interview Scenarios & Model Answers", section_heading))
        for idx, q_item in enumerate(questions[:4]):
            q_text = q_item.get("question") or f"Scenario {idx+1}"
            a_text = q_item.get("answer") or q_item.get("modelAnswer") or "Refer to core methodology."

            q_data = [
                [
                    Paragraph(
                        f"<b>Q{idx+1}: {sanitize_pdf_text(q_text)}</b><br/><br/>"
                        f"<font color='#0369a1'><b>Model Answer / Evaluation Rationale:</b></font><br/>"
                        f"{sanitize_pdf_text(a_text)}",
                        callout_style,
                    )
                ]
            ]
            q_table = Table(q_data, colWidths=[504])
            q_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ])
            )
            story.append(q_table)
            story.append(Spacer(1, 6))

    # ----------------------------------------------------
    # SECTION 6: KNOWLEDGE ASSESSMENT & PRACTICE QUIZ
    # ----------------------------------------------------
    if quiz:
        story.append(Paragraph("6. Knowledge Assessment & Practice Questions", section_heading))
        for idx, qz in enumerate(quiz[:5]):
            qz_q = qz.get("question") or f"Question {idx+1}"
            qz_opts = qz.get("options") or []
            correct_idx = qz.get("correctAnswer", 0)

            opt_lines = []
            for o_idx, opt in enumerate(qz_opts):
                is_correct = (o_idx == correct_idx)
                prefix = f"<b>[{chr(65 + o_idx)}]</b> "
                if is_correct:
                    opt_lines.append(f"{prefix}<b>{sanitize_pdf_text(opt)}</b> <font color='#16a34a'><b>(Correct Answer)</b></font>")
                else:
                    opt_lines.append(f"{prefix}{sanitize_pdf_text(opt)}")

            qz_content = (
                f"<b>Question {idx+1}:</b> {sanitize_pdf_text(qz_q)}<br/><br/>"
                + "<br/>".join(opt_lines)
            )

            qz_data = [[Paragraph(qz_content, callout_style)]]
            qz_table = Table(qz_data, colWidths=[504])
            qz_table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fefce8")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#fde047")),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ])
            )
            story.append(qz_table)
            story.append(Spacer(1, 6))

    # Build PDF with two-pass canvas
    def canvas_factory(*args, **kwargs):
        return NumberedCanvasWithWatermark(
            *args,
            watermark_settings=watermark_settings or {},
            doc_topic=topic,
            doc_domain=domain,
            **kwargs,
        )

    doc.build(story, canvasmaker=canvas_factory)
    return buf.getvalue()
