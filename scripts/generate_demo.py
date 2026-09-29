from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "careerflow-demo.gif"
OUT.parent.mkdir(parents=True, exist_ok=True)

W, H = 1000, 562
BG = (246, 249, 255)
BLUE = (28, 96, 210)
NAVY = (28, 39, 60)
MUTED = (95, 107, 129)
BORDER = (219, 226, 237)
CARD = (255, 255, 255)
LIGHT_BLUE = (235, 243, 255)
GREEN = (31, 140, 92)

REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def font(size, bold=False):
    try:
        return ImageFont.truetype(BOLD if bold else REGULAR, size)
    except OSError:
        return ImageFont.load_default()

def rounded(draw, box, radius=16, fill=CARD, outline=BORDER, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def text(draw, xy, value, size=20, color=NAVY, bold=False, anchor=None):
    draw.text(xy, value, fill=color, font=font(size, bold), anchor=anchor)

def wrapped(draw, value, xy, width_px, size=18, color=MUTED, bold=False, gap=4):
    f = font(size, bold)
    lines, current = [], ""
    for word in value.split():
        candidate = (current + " " + word).strip()
        if draw.textlength(candidate, font=f) <= width_px:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    x, y = xy
    for line in lines:
        draw.text((x, y), line, fill=color, font=f)
        y += size + gap
    return y

def background():
    image = Image.new("RGB", (W, H), BG)
    for cx, cy, color, radius in [
        (80, 40, (222, 239, 255), 180),
        (850, 120, (255, 239, 205), 170),
    ]:
        blob = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        bd = ImageDraw.Draw(blob)
        bd.ellipse((cx-radius, cy-radius, cx+radius, cy+radius), fill=(*color, 120))
        blob = blob.filter(ImageFilter.GaussianBlur(35))
        image = Image.alpha_composite(image.convert("RGBA"), blob).convert("RGB")
    return image

def frame(stage):
    image = background()
    draw = ImageDraw.Draw(image)

    text(draw, (42, 28), "CareerFlow AI", 28, NAVY, True)
    text(draw, (42, 64), "Demo flow using the bundled sample data", 14, MUTED)

    labels = ["1  Load sources", "2  Grounded workspace", "3  Analyze match", "4  Draft outreach"]
    x = 42
    for index, label in enumerate(labels):
        f = font(13, True)
        tw = draw.textlength(label, font=f)
        fill = BLUE if index == stage else (238, 243, 250)
        color = (255, 255, 255) if index == stage else MUTED
        draw.rounded_rectangle((x, 92, x + tw + 24, 120), radius=14, fill=fill)
        text(draw, (x + 12, 106), label, 13, color, True, "lm")
        x += tw + 34

    if stage == 0:
        rounded(draw, (45, 145, 570, 520), 24)
        text(draw, (72, 177), "Grounded career workspace", 27, NAVY, True)
        wrapped(
            draw,
            "Keep candidate facts and opportunity facts separate, then route work through focused agents.",
            (72, 220), 450, 18
        )
        rows = [
            (315, "Truth store", "Resume + candidate evidence"),
            (380, "Opportunity store", "Role + company evidence"),
            (445, "Claim checker", "Source-backed generated outputs"),
        ]
        for y, title, body in rows:
            rounded(draw, (72, y, 535, y + 52), 14, (248, 250, 254))
            text(draw, (88, y + 17), title, 14, NAVY, True)
            text(draw, (285, y + 18), body, 13, MUTED)

        rounded(draw, (610, 145, 955, 520), 24)
        text(draw, (638, 178), "Start a session", 23, NAVY, True)
        text(draw, (638, 222), "Resume", 14, NAVY, True)
        rounded(draw, (638, 246, 927, 290), 12, (249, 251, 255))
        text(draw, (653, 268), "Maya_Patel_Resume.pdf", 14, MUTED, anchor="lm")
        text(draw, (638, 322), "Opportunity", 14, NAVY, True)
        rounded(draw, (638, 346, 927, 410), 12, (249, 251, 255))
        text(draw, (653, 366), "Product Engineering Intern", 14, NAVY, True)
        text(draw, (653, 389), "BrightPath Careers", 13, MUTED)
        draw.rounded_rectangle((638, 448, 927, 493), radius=12, fill=BLUE)
        text(draw, (782, 470), "Load demo data →", 15, (255, 255, 255), True, "mm")
        return image

    rounded(draw, (36, 145, 964, 525), 22, (252, 253, 255))

    rounded(draw, (52, 162, 265, 508), 18)
    text(draw, (70, 185), "Sources", 20, NAVY, True)
    for y, title, subtitle, active in [
        (225, "Maya Patel", "Active resume", True),
        (294, "BrightPath Careers", "Selected opportunity", True),
        (363, "Supporting notes", "Candidate source", False),
    ]:
        rounded(draw, (68, y, 248, y + 52), 12, LIGHT_BLUE if active else (248, 250, 253))
        text(draw, (80, y + 16), title, 14, NAVY, True)
        text(draw, (80, y + 35), subtitle, 12, MUTED)

    rounded(draw, (282, 162, 690, 508), 18)
    text(draw, (302, 185), "Conversation", 20, NAVY, True)
    if stage == 1:
        rounded(draw, (304, 226, 660, 285), 14, LIGHT_BLUE)
        text(draw, (322, 245), "Workspace ready", 15, NAVY, True)
        text(draw, (322, 267), "2 truth sources · 1 opportunity", 13, MUTED)
        rounded(draw, (304, 310, 660, 392), 14, (249, 251, 254))
        wrapped(
            draw,
            "Candidate evidence and role evidence are indexed separately before agent actions run.",
            (322, 329), 315, 14
        )
        rounded(draw, (304, 423, 660, 475), 14, (249, 251, 254))
        text(draw, (322, 445), "Ask: How well do I match this role?", 14, MUTED)
    elif stage == 2:
        rounded(draw, (304, 220, 660, 318), 14, (248, 250, 254))
        text(draw, (322, 240), "Match analysis", 16, NAVY, True)
        text(draw, (322, 270), "Strong alignment", 26, GREEN, True)
        text(draw, (322, 300), "React · Next.js · TypeScript · RAG", 13, MUTED)
        rounded(draw, (304, 338, 660, 466), 14, LIGHT_BLUE)
        text(draw, (322, 360), "Evidence-backed gaps", 15, NAVY, True)
        for i, line in enumerate([
            "Make API/backend impact more explicit",
            "Surface experiment/evaluation experience",
            "Keep claims tied to candidate sources",
        ]):
            text(draw, (326, 390 + i * 23), "• " + line, 13, MUTED)
    else:
        rounded(draw, (304, 220, 660, 465), 14, (249, 251, 254))
        text(draw, (322, 240), "Recruiter outreach", 16, NAVY, True)
        wrapped(
            draw,
            "Hi BrightPath team — I’m a WashU CS student with experience building retrieval-backed AI products and full-stack TypeScript workflows. I’m especially interested in your Applied AI product engineering role...",
            (322, 274), 315, 14, gap=6
        )
        rounded(draw, (322, 412, 520, 450), 10, LIGHT_BLUE)
        text(draw, (421, 431), "Grounded in 4 sources", 13, BLUE, True, "mm")

    rounded(draw, (706, 162, 948, 508), 18)
    text(draw, (726, 185), "Actions", 20, NAVY, True)
    actions = ["Parse Sources", "Analyze Match", "Optimize Resume", "Draft Email", "Search Jobs"]
    for i, action in enumerate(actions):
        y = 225 + i * 50
        selected = (stage == 2 and action == "Analyze Match") or (stage == 3 and action == "Draft Email")
        rounded(draw, (724, y, 930, y + 38), 10, BLUE if selected else (248, 250, 253))
        text(draw, (740, y + 19), action, 13, (255,255,255) if selected else NAVY, selected, "lm")
    rounded(draw, (724, 476, 930, 494), 8, (232, 247, 240), (200, 233, 218))
    text(draw, (827, 485), "Workflow trace ✓", 11, GREEN, True, "mm")
    return image

frames = [frame(i).resize((800, 450), Image.Resampling.LANCZOS).convert("P", palette=Image.Palette.ADAPTIVE, colors=128) for i in range(4)]
frames[0].save(
    OUT,
    save_all=True,
    append_images=frames[1:],
    duration=[1800, 1800, 1800, 2200],
    loop=0,
    optimize=True,
    disposal=2,
)
print(OUT)
