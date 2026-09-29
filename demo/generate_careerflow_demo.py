"""Generate the lightweight README product walkthrough GIF.

The animation uses the repository's bundled demo persona/opportunity and mirrors
the current CareerFlow workflow: ingest -> grounded workspace -> match -> outreach.
It is intentionally deterministic so the GitHub Action can regenerate the asset.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "assets" / "careerflow-demo.gif"
OUT.parent.mkdir(parents=True, exist_ok=True)

W, H = 720, 405
BG = (246, 249, 255)
NAVY = (28, 39, 60)
MUTED = (95, 107, 129)
BLUE = (28, 96, 210)
LIGHT = (235, 243, 255)
CARD = (255, 255, 255)
BORDER = (219, 226, 237)
GREEN = (31, 140, 92)


def font(size: int, bold: bool = False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def rounded(draw, box, radius=14, fill=CARD, outline=BORDER):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=1)


def text(draw, xy, value, size=16, color=NAVY, bold=False, anchor=None):
    draw.text(xy, value, font=font(size, bold), fill=color, anchor=anchor)


def frame(stage: int):
    image = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(image)
    text(draw, (28, 20), "CareerFlow AI", 23, NAVY, True)
    text(draw, (28, 48), "Grounded multi-agent career workspace", 12, MUTED)

    labels = ["Load sources", "Ground workspace", "Analyze match", "Draft outreach"]
    x = 28
    for i, label in enumerate(labels):
        width = int(draw.textlength(label, font=font(11, True))) + 22
        draw.rounded_rectangle((x, 72, x + width, 96), radius=12, fill=BLUE if i == stage else (236, 241, 248))
        text(draw, (x + width / 2, 84), label, 11, (255,255,255) if i == stage else MUTED, True, "mm")
        x += width + 8

    if stage == 0:
        rounded(draw, (34, 120, 430, 370), 20)
        text(draw, (56, 146), "Truth + opportunity stores", 20, NAVY, True)
        text(draw, (56, 182), "Resume evidence stays separate from job evidence.", 13, MUTED)
        for y, title, subtitle in [
            (225, "Truth store", "Resume + candidate sources"),
            (275, "Opportunity store", "Role + company sources"),
            (325, "Claim checker", "Evidence-backed outputs"),
        ]:
            rounded(draw, (56, y, 404, y + 38), 10, (248,250,254))
            text(draw, (70, y + 12), title, 13, NAVY, True)
            text(draw, (194, y + 13), subtitle, 12, MUTED)

        rounded(draw, (452, 120, 686, 370), 20)
        text(draw, (470, 146), "Bundled demo", 18, NAVY, True)
        text(draw, (470, 185), "Maya Patel", 14, NAVY, True)
        text(draw, (470, 207), "WashU · CS", 12, MUTED)
        text(draw, (470, 245), "Applied AI Intern", 14, NAVY, True)
        text(draw, (470, 267), "BrightPath Careers", 12, MUTED)
        draw.rounded_rectangle((470, 310, 668, 346), radius=10, fill=BLUE)
        text(draw, (569, 328), "Load demo data →", 13, (255,255,255), True, "mm")
        return image

    rounded(draw, (24, 114, 696, 377), 18, (252,253,255))
    rounded(draw, (38, 128, 188, 360), 15)
    rounded(draw, (202, 128, 490, 360), 15)
    rounded(draw, (504, 128, 682, 360), 15)
    text(draw, (52, 147), "Sources", 16, NAVY, True)
    for y, title, subtitle in [
        (182, "Maya Patel", "Active resume"),
        (230, "BrightPath Careers", "Opportunity"),
        (278, "Supporting notes", "Candidate source"),
    ]:
        rounded(draw, (50, y, 176, y + 37), 9, LIGHT if y < 260 else (248,250,253))
        text(draw, (60, y + 10), title, 11, NAVY, True)
        text(draw, (60, y + 24), subtitle, 9, MUTED)

    text(draw, (218, 147), "Conversation", 16, NAVY, True)
    text(draw, (518, 147), "Actions", 16, NAVY, True)

    actions = ["Parse Sources", "Analyze Match", "Optimize Resume", "Draft Email", "Search Jobs"]
    for i, action in enumerate(actions):
        y = 180 + i * 35
        selected = (stage == 2 and action == "Analyze Match") or (stage == 3 and action == "Draft Email")
        rounded(draw, (516, y, 670, y + 27), 8, BLUE if selected else (248,250,253))
        text(draw, (528, y + 14), action, 10, (255,255,255) if selected else NAVY, selected, "lm")

    if stage == 1:
        rounded(draw, (218, 186, 472, 238), 10, LIGHT)
        text(draw, (232, 203), "Workspace ready", 13, NAVY, True)
        text(draw, (232, 221), "Candidate and role evidence indexed separately", 10, MUTED)
        rounded(draw, (218, 255, 472, 323), 10, (248,250,253))
        text(draw, (232, 273), "Ask naturally", 12, NAVY, True)
        text(draw, (232, 295), "“How well do I match this role?”", 11, MUTED)
    elif stage == 2:
        rounded(draw, (218, 182, 472, 324), 10, (248,250,253))
        text(draw, (232, 200), "Match analysis", 13, NAVY, True)
        text(draw, (232, 232), "Strong alignment", 22, GREEN, True)
        text(draw, (232, 261), "React · Next.js · TypeScript · RAG", 10, MUTED)
        text(draw, (232, 294), "Gaps are tied back to source evidence.", 10, MUTED)
    else:
        rounded(draw, (218, 182, 472, 324), 10, (248,250,253))
        text(draw, (232, 200), "Recruiter outreach", 13, NAVY, True)
        lines = [
            "Hi BrightPath team — I’m a WashU CS student",
            "with experience building retrieval-backed AI",
            "products and full-stack TypeScript workflows...",
        ]
        for i, line in enumerate(lines):
            text(draw, (232, 232 + i * 20), line, 10, MUTED)
        rounded(draw, (232, 298, 372, 320), 7, LIGHT)
        text(draw, (302, 309), "Grounded in 4 sources", 9, BLUE, True, "mm")

    text(draw, (588, 346), "Workflow trace ✓", 9, GREEN, True, "mm")
    return image


frames = [frame(i).convert("P", palette=Image.Palette.ADAPTIVE, colors=64) for i in range(4)]
frames[0].save(
    OUT,
    save_all=True,
    append_images=frames[1:],
    duration=[1300, 1300, 1500, 1600],
    loop=0,
    optimize=True,
    disposal=2,
)
print(f"Wrote {OUT}")
