#!/usr/bin/env python3
"""
Generates high-DPI PWA & Android APK launcher PNG icons using ONLY standard library
(zlib + struct + math) reproducing the exact uploaded ESWA GEOLOGICAL MAPPER icon
(Screenshot_20261029-051204 (1).png):
- Full-bleed Geological Map Backdrop:
  * Left side: Diagonal tilted terracotta, chocolate-brown, burnt-sienna, cream-gold & amber
    sedimentary strata bands + cream quartz vein (#FFFBEB) + sweeping dark contour curves
  * Right side: Vibrant Golden-Amber Orange (#EB820E -> #F39015 -> #DC730A) with dark-brown
    concentric topographic ellipses & survey grid lines
- Centerpiece Emblem with Crisp White Sticker Cutout Outline:
  * Twin-Peak Dark Topographic Mountain Triangle with concentric peak contour rings & slope lines
  * White/Ice-Blue Topographic Eagle Head with Hooked Beak & Tilted Geological Compass Eye
  * 'ESWA' Wordmark:
    - Horseshoe Tunnel Portal 'E' with segmented rim, flat invert floor, Rock Hammer,
      Hand Lens, 3-Segment Drill Core & Orange Mineral Crystal
    - 'S' with Folded Sedimentary Rock Stratum & Bedding Planes
    - 'W' & 'A' with Sky-Blue to Deep Slate-Teal Fractured Rock Texture
  * 'GEOLOGICAL MAPPER' Bold Black Subtitle inside Crisp White Sticker Pill at Bottom
"""
import math
import os
import shutil
import struct
import zlib


def clamp(v, lo=0, hi=255):
    return max(lo, min(hi, int(round(v))))


def lerp(a, b, t):
    return a + (b - a) * t


def point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) + 1e-9) + xi):
            inside = not inside
        j = i
    return inside


def dist_to_segment(px, py, x1, y1, x2, y2):
    dx = x2 - x1
    dy = y2 - y1
    l2 = dx * dx + dy * dy
    if l2 == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / l2))
    projx = x1 + t * dx
    projy = y1 + t * dy
    return math.hypot(px - projx, py - projy)


def dist_to_poly_edges(px, py, poly, closed=True):
    best = 1e9
    n = len(poly)
    limit = n if closed else n - 1
    for i in range(limit):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        d = dist_to_segment(px, py, x1, y1, x2, y2)
        if d < best:
            best = d
    return best


def sample_cubic_bezier(p0, p1, p2, p3, steps=24):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1.0 - t
        x = (
            mt * mt * mt * p0[0]
            + 3 * mt * mt * t * p1[0]
            + 3 * mt * t * t * p2[0]
            + t * t * t * p3[0]
        )
        y = (
            mt * mt * mt * p0[1]
            + 3 * mt * mt * t * p1[1]
            + 3 * mt * t * t * p2[1]
            + t * t * t * p3[1]
        )
        pts.append((x, y))
    return pts


def build_eagle_head_polygon():
    segs = [
        ((272, 268), (318, 228), (378, 190), (444, 186)),
        ((444, 186), (476, 184), (502, 194), (514, 208)),
        ((514, 208), (546, 210), (578, 224), (590, 250)),
        ((590, 250), (598, 268), (594, 292), (578, 308)),
        ((578, 308), (574, 292), (562, 280), (544, 278)),
        ((544, 278), (516, 276), (488, 292), (464, 316)),
        ((464, 316), (452, 328), (444, 342), (440, 354)),
    ]
    poly = []
    for p0, p1, p2, p3 in segs:
        pts = sample_cubic_bezier(p0, p1, p2, p3, 18)
        poly.extend(pts[:-1])
    poly.append((440, 354))
    poly.append((382, 354))
    neck_pts = sample_cubic_bezier((382, 354), (368, 310), (326, 276), (272, 268), 18)
    poly.extend(neck_pts[:-1])
    return poly


def build_letter_s_polygon():
    segs = [
        ((432, 384), (414, 366), (386, 358), (358, 360)),
        ((358, 360), (318, 362), (294, 384), (294, 412)),
        ((294, 412), (294, 442), (322, 454), (360, 466)),
        ((360, 466), (388, 474), (398, 482), (396, 494)),
        ((396, 494), (394, 506), (376, 512), (354, 510)),
        ((354, 510), (332, 508), (314, 498), (298, 486)),
    ]
    poly = []
    for p0, p1, p2, p3 in segs:
        poly.extend(sample_cubic_bezier(p0, p1, p2, p3, 12)[:-1])
    poly.append((298, 486))
    poly.append((280, 518))
    segs2 = [
        ((280, 518), (302, 534), (330, 542), (360, 542)),
        ((360, 542), (406, 542), (438, 520), (438, 486)),
        ((438, 486), (438, 454), (412, 438), (370, 426)),
        ((370, 426), (344, 418), (334, 412), (336, 400)),
        ((336, 400), (338, 390), (352, 384), (372, 386)),
        ((372, 386), (390, 388), (406, 396), (418, 406)),
    ]
    for p0, p1, p2, p3 in segs2:
        poly.extend(sample_cubic_bezier(p0, p1, p2, p3, 12)[:-1])
    poly.append((418, 406))
    return poly


# Crisp 5x7 bitmap font for "GEOLOGICAL MAPPER"
FONT_5X7 = {
    "G": [
        "01110",
        "10001",
        "10000",
        "10111",
        "10001",
        "10001",
        "01110",
    ],
    "E": [
        "11111",
        "10000",
        "10000",
        "11110",
        "10000",
        "10000",
        "11111",
    ],
    "O": [
        "01110",
        "10001",
        "10001",
        "10001",
        "10001",
        "10001",
        "01110",
    ],
    "L": [
        "10000",
        "10000",
        "10000",
        "10000",
        "10000",
        "10000",
        "11111",
    ],
    "I": [
        "11111",
        "00100",
        "00100",
        "00100",
        "00100",
        "00100",
        "11111",
    ],
    "C": [
        "01110",
        "10001",
        "10000",
        "10000",
        "10000",
        "10001",
        "01110",
    ],
    "A": [
        "01110",
        "10001",
        "10001",
        "11111",
        "10001",
        "10001",
        "10001",
    ],
    "M": [
        "10001",
        "11011",
        "10101",
        "10101",
        "10001",
        "10001",
        "10001",
    ],
    "P": [
        "11110",
        "10001",
        "10001",
        "11110",
        "10000",
        "10000",
        "10000",
    ],
    "R": [
        "11110",
        "10001",
        "10001",
        "11110",
        "10100",
        "10010",
        "10001",
    ],
    " ": [
        "00000",
        "00000",
        "00000",
        "00000",
        "00000",
        "00000",
        "00000",
    ],
}


def sample_subtitle_text(sx, sy):
    """
    Returns (in_white_pill, in_black_letter) for 'GEOLOGICAL MAPPER'
    positioned beneath 'S W A' at sy in [538..586], sx in [278..682].
    """
    text = "GEOLOGICAL MAPPER"
    start_x = 290.0
    start_y = 548.0
    cell_w = 3.55
    cell_h = 3.65
    char_Advance = 6.45 * cell_w  # 5 cols + 1.45 col spacing

    # Check pill bounds with rounded ends
    pill_x0 = 278.0
    pill_x1 = 684.0
    pill_y0 = 540.0
    pill_y1 = 584.0
    if sx < pill_x0 - 6 or sx > pill_x1 + 6 or sy < pill_y0 - 6 or sy > pill_y1 + 6:
        return False, False

    cx = min(max(sx, pill_x0 + 10.0), pill_x1 - 10.0)
    cy = min(max(sy, pill_y0 + 10.0), pill_y1 - 10.0)
    in_pill = math.hypot(sx - cx, sy - cy) <= 11.5 or (
        pill_x0 <= sx <= pill_x1 and pill_y0 <= sy <= pill_y1
    )

    if not in_pill:
        return False, False

    rel_y = sy - start_y
    if 0.0 <= rel_y < 7.0 * cell_h:
        row = int(rel_y / cell_h)
        rel_x = sx - start_x
        if rel_x >= 0.0:
            c_idx = int(rel_x / char_Advance)
            if 0 <= c_idx < len(text):
                in_char_x = rel_x - c_idx * char_Advance
                col = int(in_char_x / cell_w)
                if 0 <= col < 5:
                    ch = text[c_idx]
                    grid = FONT_5X7.get(ch)
                    if grid and grid[row][col] == "1":
                        return True, True
    return True, False


def render_background_pixel(sx, sy):
    """
    Renders the exact geological map backdrop from Screenshot_20261029-051204 (1).png
    in SVG logo coordinates (sx in [80..820], sy in [-20..605]).
    """
    # 1. Base orange gradient (#EB820E -> #F39015 -> #EE8711 -> #DC730A)
    nx = max(0.0, min(1.0, (sx - 80.0) / 740.0))
    ny = max(0.0, min(1.0, (sy + 20.0) / 625.0))
    t = 0.55 * nx + 0.45 * ny
    r = lerp(239, 224, t)
    g = lerp(138, 120, t)
    b = lerp(19, 12, t)

    # 2. Diagonal fault boundary separating Left Folded Strata Outcrop from Right Orange Sheet
    # Runs from (sx=588, sy=-20) down-left to (sx=442, sy=605)
    fault_x = 588.0 - (sy + 20.0) * 0.235
    if sx < fault_x:
        # Left side: Tilted sedimentary strata bands (tilted down from left to right at ~27 deg)
        # Band coordinate u increases from top-right to bottom-left perpendicular to bedding
        u = (sy + 20.0) - (sx - 80.0) * 0.49
        # Base rust-terracotta outcrop fill (#9A3B0A)
        r, g, b = 154, 59, 10

        # Layered geological beds matching Screenshot_20261029-051204 (1).png
        if -140.0 <= u < -75.0:
            r, g, b = 142, 60, 18
        elif -75.0 <= u < -25.0:
            r, g, b = 154, 65, 20
        elif -25.0 <= u < 42.0:
            # Deep chocolate brown band (#5A270B)
            r, g, b = 90, 39, 11
        elif 42.0 <= u < 98.0:
            # Medium burnt-sienna band (#8D3D13)
            r, g, b = 141, 61, 19
        elif 98.0 <= u < 145.0:
            # Pale cream-gold marker bed (#F0CD7A) with thin brown center seam
            if 116.0 <= u < 126.0:
                r, g, b = 154, 68, 22
            else:
                r, g, b = 240, 205, 122
        elif 145.0 <= u < 245.0:
            # Rich rust-terracotta band (#8E3E14)
            r, g, b = 142, 62, 20
        elif 245.0 <= u < 292.0:
            # Warm golden-amber band (#DF8A19)
            r, g, b = 223, 138, 25
        elif 292.0 <= u < 415.0:
            # Deep espresso-brown band (#4C2008) with warm rust sub-bed
            if 328.0 <= u < 375.0:
                r, g, b = 142, 62, 20
            else:
                r, g, b = 76, 32, 8
        elif 415.0 <= u < 452.0:
            # Cream-beige bed at bottom-left (#DFBC8B)
            r, g, b = 223, 188, 139
        elif u >= 452.0:
            r, g, b = 138, 60, 18

        # Cream/Beige cross-cutting quartz vein exiting beneath 'S' and 'GEOLOGICAL'
        # Runs from (sx=445, sy=235) to (sx=340, sy=605)
        vein_x = 445.0 - (sy - 235.0) * 0.285
        if sy > 230.0 and abs(sx - vein_x) < 16.5:
            r, g, b = 216, 196, 174

    # 3. Concentric Topographic Ellipses in Upper-Right & Sweeping Regional Contour Lines
    # Upper-right rotated ellipses centered at (705, -75)
    dx_e = sx - 705.0
    dy_e = sy - (-75.0)
    cos32 = math.cos(math.radians(32.0))
    sin32 = math.sin(math.radians(32.0))
    rx_e = dx_e * cos32 + dy_e * sin32
    ry_e = -dx_e * sin32 + dy_e * cos32
    ell_d = math.hypot(rx_e / 1.55, ry_e)
    ring_mod = ell_d % 24.0
    if ring_mod < 1.8 or ring_mod > 22.2:
        r = lerp(r, 62, 0.55)
        g = lerp(g, 22, 0.55)
        b = lerp(b, 4, 0.55)

    # Sweeping regional contour curves across the sheet
    reg_v = (sx - 135.0) - 0.32 * sy - 38.0 * math.sin(sy * 0.0085)
    reg_mod = reg_v % 42.0
    if reg_mod < 1.6 or reg_mod > 40.4:
        r = lerp(r, 62, 0.52)
        g = lerp(g, 22, 0.52)
        b = lerp(b, 4, 0.52)

    # Subtle survey coordinate grid lines (horizontal at sy=485, vertical at sx=445)
    if abs(sy - 485.0) < 0.9 or abs(sx - 445.0) < 0.9:
        r = lerp(r, 62, 0.28)
        g = lerp(g, 22, 0.28)
        b = lerp(b, 4, 0.28)

    return r, g, b


def render_master_512():
    W = 512
    H = 512
    buf = bytearray(W * H * 4)

    mtn_poly = [(222, 332), (346, 118), (368, 144), (452, 22), (686, 332)]
    eagle_poly = build_eagle_head_polygon()
    beak_curve = sample_cubic_bezier((514, 208), (498, 236), (496, 268), (516, 286), 14)

    s_poly = build_letter_s_polygon()
    w_poly = [
        (426, 364),
        (466, 364),
        (490, 472),
        (520, 364),
        (554, 364),
        (584, 472),
        (608, 364),
        (648, 364),
        (604, 538),
        (566, 538),
        (537, 432),
        (508, 538),
        (470, 538),
    ]
    a_outer_poly = [
        (686, 364),
        (730, 364),
        (792, 538),
        (748, 538),
        (736, 502),
        (678, 502),
        (666, 538),
        (624, 538),
    ]
    a_hole_poly = [(707, 412), (688, 470), (726, 470)]

    # Horseshoe Tunnel Arch 'E' polygon
    e_poly = [(152, 538), (152, 392)]
    for deg in range(180, -18, -8):
        rad = math.radians(deg)
        e_poly.append((278 + 126 * math.cos(rad), 392 - 126 * math.sin(rad)))
    for deg in range(-12, 165, 10):
        rad = math.radians(deg)
        e_poly.append((282 + 54 * math.cos(rad), 414 - 54 * math.sin(rad)))
    e_poly.extend(
        [
            (238, 428),
            (286, 428),
            (286, 468),
            (238, 468),
            (238, 496),
            (296, 496),
            (296, 538),
        ]
    )

    e_floor_poly = [(174, 538), (222, 504), (296, 504), (296, 538)]
    crystal_poly = [(344, 328), (356, 320), (364, 332), (354, 342), (342, 338)]

    cos36 = math.cos(math.radians(36.0))
    sin36 = math.sin(math.radians(36.0))
    cos14 = math.cos(math.radians(14.0))
    sin14 = math.sin(math.radians(14.0))
    cos32 = math.cos(math.radians(-32.0))
    sin32 = math.sin(math.radians(-32.0))

    # Exact framing matching Screenshot_20261029-051204 (1).png
    scale_x = 512.0 / 710.0
    scale_y = 512.0 / 615.0
    scale_factor = min(scale_x, scale_y)  # ~0.721

    for y in range(H):
        for x in range(W):
            px = x + 0.5
            py = y + 0.5

            # Map pixel (px, py) to SVG coordinate space (sx, sy)
            sx = (px - 256.0) / scale_factor + 462.0
            sy = (py - 256.0) / scale_factor + 298.0

            # 0. Full-bleed Geological Orange & Folded Strata Backdrop
            r, g, b = render_background_pixel(sx, sy)

            in_mtn = point_in_poly(sx, sy, mtn_poly)
            d_mtn = dist_to_poly_edges(sx, sy, mtn_poly, True)

            in_eagle = point_in_poly(sx, sy, eagle_poly)
            d_eagle = dist_to_poly_edges(sx, sy, eagle_poly, True)

            in_e = point_in_poly(sx, sy, e_poly)
            d_e = dist_to_poly_edges(sx, sy, e_poly, True)

            in_s = point_in_poly(sx, sy, s_poly)
            d_s = dist_to_poly_edges(sx, sy, s_poly, True)

            in_w = point_in_poly(sx, sy, w_poly)
            d_w = dist_to_poly_edges(sx, sy, w_poly, True)

            in_a_outer = point_in_poly(sx, sy, a_outer_poly)
            in_a_hole = point_in_poly(sx, sy, a_hole_poly)
            in_a = in_a_outer and not in_a_hole
            d_a = min(
                dist_to_poly_edges(sx, sy, a_outer_poly, True),
                dist_to_poly_edges(sx, sy, a_hole_poly, True),
            )

            in_sub_pill, in_sub_text = sample_subtitle_text(sx, sy)

            # White sticker cutout halo around entire emblem
            min_emblem_dist = min(
                0.0 if in_mtn else d_mtn,
                0.0 if in_eagle else d_eagle,
                0.0 if in_e else d_e,
                0.0 if in_s else d_s,
                0.0 if in_w else d_w,
                0.0 if in_a else d_a,
            )
            if min_emblem_dist < 11.5 or in_sub_pill:
                r, g, b = 255, 255, 255

            # LAYER 1: TWIN-PEAK MOUNTAIN TRIANGLE
            if in_mtn:
                if d_mtn < 6.0:
                    r, g, b = 5, 7, 10
                else:
                    mt = max(0.0, min(1.0, (sy - 22.0) / 310.0))
                    r = lerp(52, 7, mt)
                    g = lerp(64, 10, mt)
                    b = lerp(82, 16, mt)

                    # Concentric oval contour target on main peak (452, 96) & left peak (352, 176)
                    d_p1 = math.hypot((sx - 452.0) * 1.35, sy - 96.0)
                    d_p2 = math.hypot((sx - 352.0) * 1.15, sy - 176.0)
                    slope_wave = math.sin((sy + 0.45 * abs(sx - 445.0)) * 0.25)
                    if (
                        abs(d_p1 - 22.0) < 1.8
                        or abs(d_p1 - 38.0) < 1.8
                        or abs(d_p2 - 26.0) < 1.8
                        or abs(slope_wave) > 0.92
                    ):
                        r = lerp(r, 148, 0.42)
                        g = lerp(g, 163, 0.42)
                        b = lerp(b, 184, 0.42)

            # LAYER 2: TOPOGRAPHIC EAGLE HEAD & COMPASS EYE
            if not in_e and not in_s and not in_w and not in_a:
                if not in_eagle and d_eagle < 6.5:
                    r, g, b = 255, 255, 255
                elif in_eagle:
                    if d_eagle < 2.8:
                        r, g, b = 9, 13, 20
                    else:
                        et = max(0.0, min(1.0, (sx - 272.0) / 320.0))
                        r = lerp(255, 186, et)
                        g = lerp(255, 230, et)
                        b = lerp(255, 253, et)

                        c_val = math.sin((sy - 180.0 + (sx - 270.0) * 0.36) * 0.42)
                        if abs(c_val) > 0.88:
                            r = lerp(r, 30, 0.55)
                            g = lerp(g, 41, 0.55)
                            b = lerp(b, 59, 0.55)

                        d_beak = dist_to_poly_edges(sx, sy, beak_curve, False)
                        if d_beak < 2.0:
                            r, g, b = 15, 23, 42

                        # Tilted Geological Compass Eye at (476, 236)
                        dx_eye = sx - 476.0
                        dy_eye = sy - 236.0
                        rx_eye = dx_eye * cos36 + dy_eye * sin36
                        ry_eye = -dx_eye * sin36 + dy_eye * cos36
                        diamond_val = abs(rx_eye) / 28.0 + abs(ry_eye) / 8.0
                        dist_eye = math.hypot(dx_eye, dy_eye)
                        if dist_eye < 2.3:
                            r, g, b = 15, 23, 42
                        elif dist_eye < 5.2:
                            r, g, b = 186, 230, 253
                        elif dist_eye < 7.8 or diamond_val <= 1.0:
                            r, g, b = 5, 7, 10

            # LAYER 3A: HORSESHOE TUNNEL ARCH 'E' + GEOLOGICAL TOOLS
            if in_e:
                if d_e < 3.0:
                    r, g, b = 9, 13, 20
                else:
                    dist_arch = math.hypot(sx - 278.0, sy - 392.0)
                    is_outer_rim = (sx < 174.0) or (sy < 392.0 and dist_arch > 104.0)
                    if is_outer_rim:
                        r, g, b = 148, 163, 184
                        if abs(dist_arch - 104.0) < 2.6 or abs(sx - 174.0) < 2.6:
                            r, g, b = 9, 13, 20
                        # Radial segment joint ticks on outer rim
                        if (
                            dist_to_segment(sx, sy, 152, 452, 174, 452) < 2.0
                            or dist_to_segment(sx, sy, 162, 346, 182, 356) < 2.0
                            or dist_to_segment(sx, sy, 216, 278, 230, 296) < 2.0
                            or dist_to_segment(sx, sy, 306, 262, 302, 284) < 2.0
                            or dist_to_segment(sx, sy, 376, 302, 358, 316) < 2.0
                        ):
                            r, g, b = 9, 13, 20
                    elif point_in_poly(sx, sy, e_floor_poly):
                        # Flat grey tunnel invert floor at bottom of 'E'
                        r, g, b = 100, 116, 139
                        if dist_to_poly_edges(sx, sy, e_floor_poly, True) < 2.2:
                            r, g, b = 9, 13, 20
                    else:
                        wt = max(0.0, min(1.0, (538.0 - sy) / 260.0))
                        r = lerp(146, 72, wt)
                        g = lerp(116, 88, wt)
                        b = lerp(78, 100, wt)
                        # Internal tunnel rib rings
                        if abs(dist_arch - 86.0) < 1.3 or abs(dist_arch - 68.0) < 1.3:
                            r = lerp(r, 30, 0.45)
                            g = lerp(g, 35, 0.45)
                            b = lerp(b, 42, 0.45)

                        # 1. Rock Hammer at (192, 456) rotated -14 deg
                        hx = (sx - 192.0) * cos14 - (sy - 456.0) * sin14
                        hy = (sx - 192.0) * sin14 + (sy - 456.0) * cos14
                        if -4.5 <= hx <= 4.5 and 0.0 <= hy <= 46.0:
                            r, g, b = (9, 13, 20) if (abs(hx) > 2.8 or hy > 43.5) else (161, 98, 7)
                        if -16.0 <= hx <= 20.0 and -6.5 <= hy <= 4.0:
                            r, g, b = (
                                (9, 13, 20)
                                if (hx < -13.5 or hx > 17.5 or hy < -4.2 or hy > 1.8)
                                else (148, 163, 184)
                            )

                        # 2. Hand Lens at (224, 424)
                        d_lens = math.hypot(sx - 224.0, sy - 424.0)
                        if d_lens <= 11.0:
                            r, g, b = (9, 13, 20) if d_lens > 8.2 else (186, 230, 253)
                        elif 219.0 <= sx <= 226.0 and 433.0 <= sy <= 449.0:
                            r, g, b = 203, 213, 225

                        # 3. Drill Core Cylinder at (244, 336) rotated 32 deg
                        cx_core = (sx - 244.0) * cos32 - (sy - 336.0) * sin32
                        cy_core = (sx - 244.0) * sin32 + (sy - 336.0) * cos32
                        if -14.5 <= cx_core <= 14.5 and -6.5 <= cy_core <= 6.5:
                            if (
                                abs(cx_core) > 12.2
                                or abs(cy_core) > 4.5
                                or abs(cx_core + 4.0) < 1.2
                                or abs(cx_core - 4.5) < 1.2
                            ):
                                r, g, b = 15, 23, 42
                            else:
                                r, g, b = 203, 213, 225

                        # 4. Orange Mineral Crystal at (352, 331)
                        if point_in_poly(sx, sy, crystal_poly):
                            if dist_to_poly_edges(sx, sy, crystal_poly, True) < 2.0:
                                r, g, b = 9, 13, 20
                            else:
                                r, g, b = 217, 119, 6

            # LAYER 3B: LETTER 'W' AND 'A'
            if in_w or in_a:
                d_wa = d_w if in_w else d_a
                if not in_s and d_s < 6.0:
                    r, g, b = 255, 255, 255
                elif d_wa < 2.8:
                    r, g, b = 9, 13, 20
                else:
                    lt = max(0.0, min(1.0, (sy - 364.0) / 174.0))
                    r = lerp(41, 42, lt)
                    g = lerp(163, 64, lt)
                    b = lerp(220, 77, lt)
                    # Rock joint fracture lines across 'W' and 'A'
                    if (
                        dist_to_segment(sx, sy, 442, 430, 478, 452) < 1.6
                        or dist_to_segment(sx, sy, 478, 452, 502, 438) < 1.6
                        or dist_to_segment(sx, sy, 556, 418, 588, 446) < 1.6
                        or dist_to_segment(sx, sy, 658, 468, 692, 448) < 1.6
                        or dist_to_segment(sx, sy, 722, 462, 758, 442) < 1.6
                    ):
                        r, g, b = 15, 23, 42

            # LAYER 3C: LETTER 'S' WITH FOLDED OCHRE STRATUM
            if in_s:
                if d_s < 2.8:
                    r, g, b = 9, 13, 20
                else:
                    st = max(0.0, min(1.0, (sy - 360.0) / 182.0))
                    r = lerp(41, 42, st)
                    g = lerp(163, 64, st)
                    b = lerp(220, 77, st)

                    band_y = 398.0 + (sx - 280.0) * 0.52
                    if abs(sy - band_y) < 18.0:
                        if abs(sy - band_y) > 15.2:
                            r, g, b = 9, 13, 20
                        elif abs(sy - band_y + 4.0) < 1.2:
                            r, g, b = 254, 243, 199
                        else:
                            r, g, b = 186, 128, 62

            # LAYER 4: 'GEOLOGICAL MAPPER' SUBTITLE PILL & TEXT
            if in_sub_pill:
                if in_sub_text:
                    r, g, b = 9, 13, 20
                else:
                    r, g, b = 255, 255, 255

            idx = (y * W + x) * 4
            buf[idx] = clamp(r)
            buf[idx + 1] = clamp(g)
            buf[idx + 2] = clamp(b)
            buf[idx + 3] = 255

    return W, H, buf


def downsample_bilinear(src_w, src_h, src_buf, dst_w, dst_h):
    dst = bytearray(dst_w * dst_h * 4)
    scale = src_w / dst_w
    support = max(1, int(round(scale)))
    for dy in range(dst_h):
        for dx in range(dst_w):
            sx0 = int(dx * scale)
            sy0 = int(dy * scale)
            r_acc = g_acc = b_acc = a_acc = count = 0
            for oy in range(support):
                sy = min(src_h - 1, sy0 + oy)
                for ox in range(support):
                    sx = min(src_w - 1, sx0 + ox)
                    s_idx = (sy * src_w + sx) * 4
                    r_acc += src_buf[s_idx]
                    g_acc += src_buf[s_idx + 1]
                    b_acc += src_buf[s_idx + 2]
                    a_acc += src_buf[s_idx + 3]
                    count += 1
            d_idx = (dy * dst_w + dx) * 4
            dst[d_idx] = r_acc // count
            dst[d_idx + 1] = g_acc // count
            dst[d_idx + 2] = b_acc // count
            dst[d_idx + 3] = a_acc // count
    return dst


def write_png(filepath, width, height, rgba_bytes):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    raw_data = bytearray()
    stride = width * 4
    for y in range(height):
        raw_data.append(0)
        row_start = y * stride
        raw_data.extend(rgba_bytes[row_start : row_start + stride])

    def make_chunk(chunk_type, data):
        chunk = struct.pack(">I", len(data)) + chunk_type + data
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return chunk + struct.pack(">I", crc)

    png = bytearray(b"\x89PNG\r\n\x1a\n")
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png.extend(make_chunk(b"IHDR", ihdr))
    compressed = zlib.compress(bytes(raw_data), 9)
    png.extend(make_chunk(b"IDAT", compressed))
    png.extend(make_chunk(b"IEND", b""))

    with open(filepath, "wb") as f:
        f.write(png)
    try:
        cache_path = os.path.join("/tmp/akash-release-cache", filepath)
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        shutil.copyfile(filepath, cache_path)
    except Exception:
        pass
    print(f"Generated {filepath} ({width}x{height})")


def main():
    print("Rendering 512x512 master icon for ESWA GEOLOGICAL MAPPER (matching uploaded APK/EXE icon)...")
    mw, mh, mbuf = render_master_512()

    write_png("public/pwa-512x512.png", 512, 512, mbuf)
    write_png("public/icons/icon-512x512.png", 512, 512, mbuf)

    sizes = [384, 256, 192, 180, 152, 144, 128, 96, 72, 48]
    for s in sizes:
        sbuf = downsample_bilinear(mw, mh, mbuf, s, s)
        write_png(f"public/icons/icon-{s}x{s}.png", s, s, sbuf)
        if s == 192:
            write_png("public/pwa-192x192.png", 192, 192, sbuf)
        if s == 180:
            write_png("public/apple-touch-icon.png", 180, 180, sbuf)


if __name__ == "__main__":
    main()
