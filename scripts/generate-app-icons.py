#!/usr/bin/env python3
"""
Generates high-DPI PWA & Android APK launcher PNG icons using ONLY standard library
(zlib + struct + math) representing the official ESWA GEOLOGICAL MAPPER Eagle Logo:
- Rounded Geological Amber-Orange & Slate Field Badge with Crisp White Rim
- Twin-Peak Dark Topographic Mountain Triangle
- White/Ice-Blue Topographic Eagle Head with Hooked Beak & Geological Compass Eye
- 'ESWA' Bold Geological Wordmark (Horseshoe Tunnel Arch 'E', Stratum 'S', Rock 'W' & 'A')
"""
import math
import os
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
    """
    Exact cubic bezier sampling of EswaBrandIdentity.tsx Eagle Head & Hooked Beak:
    M 272 268
    C 318 228, 378 190, 444 186
    C 476 184, 502 194, 514 208
    C 546 210, 578 224, 590 250
    C 598 268, 594 292, 578 308
    C 574 292, 562 280, 544 278
    C 516 276, 488 292, 464 316
    C 452 328, 444 342, 440 354
    L 382 354
    C 368 310, 326 276, 272 268 Z
    """
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
    """
    Exact cubic bezier sampling of EswaBrandIdentity.tsx Letter 'S'
    """
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


def render_master_512():
    W = 512
    H = 512
    buf = bytearray(W * H * 4)

    # Geometry in 820x580 SVG space mapped cleanly into 512x512 icon canvas
    # Center 464, 285 -> 256, 252 with scale 0.72
    mtn_poly = [(222, 332), (346, 118), (368, 144), (452, 22), (686, 332)]
    eagle_poly = build_eagle_head_polygon()
    eagle_top_edge = eagle_poly[: int(len(eagle_poly) * 0.78)]
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

    # Horseshoe Tunnel Arch 'E' polygon approximation
    e_poly = []
    # Left vertical wall bottom to arch start
    e_poly.append((152, 538))
    e_poly.append((152, 392))
    # Outer arch from (152,392) over center (278,392) R=126 to ~35deg
    for deg in range(180, -18, -8):
        rad = math.radians(deg)
        e_poly.append((278 + 126 * math.cos(rad), 392 - 126 * math.sin(rad)))
    # Inner arch back
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

    pad = 16.0
    rad_corner = 108.0
    inner_x0 = pad + rad_corner
    inner_x1 = W - pad - rad_corner
    inner_y0 = pad + rad_corner
    inner_y1 = H - pad - rad_corner

    cos36 = math.cos(math.radians(36.0))
    sin36 = math.sin(math.radians(36.0))

    for y in range(H):
        for x in range(W):
            px = x + 0.5
            py = y + 0.5

            # 1. Rounded Square App Badge SDF
            cx = min(max(px, inner_x0), inner_x1)
            cy = min(max(py, inner_y0), inner_y1)
            dist_out = math.hypot(px - cx, py - cy) - rad_corner
            if px >= inner_x0 and px <= inner_x1 and py >= inner_y0 and py <= inner_y1:
                dist_in = -min(px - pad, W - pad - px, py - pad, H - pad - py)
                sdf_box = dist_in
            else:
                sdf_box = dist_out

            if sdf_box > 1.2:
                continue

            alpha = 1.0
            if sdf_box > -1.2:
                alpha = max(0.0, min(1.0, (1.2 - sdf_box) / 2.4))

            # Warm Geological Amber-Orange Background with Topographic Rings & Dark Vignette
            nx = px / W
            ny = py / H
            bg_r = lerp(245, 180, ny * 0.75 + nx * 0.25)
            bg_g = lerp(148, 68, ny * 0.8 + nx * 0.2)
            bg_b = lerp(38, 12, ny)

            # Subtle topographic rings on orange badge background
            topo_wave = math.sin(
                math.hypot(px - 256, py - 240) * 0.14
                + 0.4 * math.sin(px * 0.04)
                + 0.4 * math.cos(py * 0.04)
            )
            if abs(topo_wave) < 0.11:
                bg_r = lerp(bg_r, 255, 0.16)
                bg_g = lerp(bg_g, 210, 0.16)
                bg_b = lerp(bg_b, 140, 0.16)

            # Crisp white & dark outer badge border
            if sdf_box > -12.0:
                if sdf_box > -6.5:
                    bg_r, bg_g, bg_b = 255, 252, 245
                else:
                    bg_r, bg_g, bg_b = 15, 23, 42

            r, g, b = bg_r, bg_g, bg_b

            # Map pixel (px, py) to SVG coordinate space (sx, sy)
            sx = (px - 256.0) / 0.72 + 468.0
            sy = (py - 256.0) / 0.72 + 286.0

            # Precompute containment & edge distances for crisp white cutout outline
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
                dist_to_poly_edges(sx, sy, a_hole_poly, True) if in_a_outer else 1e9,
            )

            any_inside = in_mtn or in_eagle or in_e or in_s or in_w or in_a
            min_edge_dist = min(d_mtn, d_eagle, d_e, d_s, d_w, d_a)

            # Outer White Cutout Halo around entire Eagle + Mountain + ESWA Logo
            if not any_inside and min_edge_dist < 13.5:
                halo_t = max(0.0, min(1.0, (13.5 - min_edge_dist) / 3.0))
                r = lerp(r, 255, halo_t)
                g = lerp(g, 255, halo_t)
                b = lerp(b, 255, halo_t)

            # LAYER 1: TWIN-PEAK TOPOGRAPHIC MOUNTAIN TRIANGLE
            if in_mtn:
                mt_t = max(0.0, min(1.0, (sy - 22.0) / 310.0))
                mr = lerp(68, 8, mt_t)
                mg = lerp(78, 12, mt_t)
                mb = lerp(94, 20, mt_t)

                # Topographic contour lines inside mountain
                c_val = math.sin((sy - 30) * 0.16 + math.sin(sx * 0.035) * 2.2)
                if abs(c_val) < 0.16:
                    mr = lerp(mr, 148, 0.45)
                    mg = lerp(mg, 163, 0.45)
                    mb = lerp(mb, 184, 0.45)

                # Bold black mountain border
                if d_mtn < 8.5:
                    mr, mg, mb = 5, 7, 10

                r, g, b = mr, mg, mb

            # LAYER 2: TOPOGRAPHIC WHITE/ICE-BLUE EAGLE HEAD & COMPASS EYE
            if not in_eagle and d_eagle < 6.5 and sy < 350:
                # Crisp white halo separating Eagle from Dark Mountain
                r, g, b = 255, 255, 255

            if in_eagle:
                et = max(0.0, min(1.0, (sx - 272.0) / 320.0 * 0.65 + (sy - 186.0) / 170.0 * 0.35))
                er = lerp(255, 165, et)
                eg = lerp(255, 230, et)
                eb = lerp(255, 252, et)

                # Flowing topographic contour lines across Eagle Head & Beak
                eagle_wave = math.sin((sx * 0.065 + sy * 0.095) + math.sin(sx * 0.025) * 1.6)
                if abs(eagle_wave) < 0.15:
                    er = lerp(er, 30, 0.62)
                    eg = lerp(eg, 41, 0.62)
                    eb = lerp(eb, 59, 0.62)

                # Beak separation curve
                d_beak = dist_to_poly_edges(sx, sy, beak_curve, False)
                if d_beak < 2.2:
                    er, eg, eb = 15, 23, 42

                # Eagle Head outer dark stroke
                if d_eagle < 3.6:
                    er, eg, eb = 9, 13, 20

                # Eagle Eye: Tilted Geological Compass Needle at (476, 236) rotated -36 deg
                ex = sx - 476.0
                ey = sy - 236.0
                rx_eye = ex * cos36 - ey * sin36
                ry_eye = ex * sin36 + ey * cos36
                eye_r = math.hypot(ex, ey)
                # Diamond needle: |rx|/28 + |ry|/8 <= 1
                if abs(rx_eye) / 28.0 + abs(ry_eye) / 8.2 <= 1.0 or eye_r <= 7.8:
                    er, eg, eb = 5, 7, 10
                    if eye_r <= 5.3:
                        er, eg, eb = 186, 230, 253
                    if eye_r <= 2.4:
                        er, eg, eb = 15, 23, 42
                    if math.hypot(ex + 1.5, ey + 1.5) <= 1.2:
                        er, eg, eb = 255, 255, 255

                r, g, b = er, eg, eb

            # LAYER 3: 'ESWA' GEOLOGICAL & TUNNEL PORTAL WORDMARK
            if in_e:
                # Outer rim vs inner brown/slate rock wall
                dist_arch_center = math.hypot(sx - 278.0, min(sy, 392.0) - 392.0)
                if sx < 174 or dist_arch_center > 104:
                    er, eg, eb = 148, 163, 184
                else:
                    wt = max(0.0, min(1.0, (538.0 - sy) / 240.0))
                    er = lerp(154, 59, wt)
                    eg = lerp(123, 77, wt)
                    eb = lerp(79, 89, wt)
                if d_e < 4.5:
                    er, eg, eb = 9, 13, 20
                r, g, b = er, eg, eb

            if in_s:
                wt = max(0.0, min(1.0, (sy - 360.0) / 180.0))
                sr = lerp(41, 42, wt)
                sg = lerp(163, 64, wt)
                sb = lerp(220, 77, wt)
                # Folded ochre rock band inside 'S'
                band_y = 392.0 + (sx - 275.0) * 0.52
                if abs(sy - band_y) < 18.0:
                    sr, sg, sb = 196, 138, 69
                if d_s < 4.5:
                    sr, sg, sb = 9, 13, 20
                r, g, b = sr, sg, sb

            if in_w or in_a:
                wt = max(0.0, min(1.0, (sy - 364.0) / 174.0))
                wr = lerp(41, 42, wt)
                wg = lerp(163, 64, wt)
                wb = lerp(220, 77, wt)
                d_edge = d_w if in_w else d_a
                if d_edge < 4.5:
                    wr, wg, wb = 9, 13, 20
                r, g, b = wr, wg, wb

            idx = (y * W + x) * 4
            buf[idx] = clamp(r)
            buf[idx + 1] = clamp(g)
            buf[idx + 2] = clamp(b)
            buf[idx + 3] = clamp(alpha * 255)

    return W, H, buf


def downsample_bilinear(src_w, src_h, src_buf, dst_w, dst_h):
    dst = bytearray(dst_w * dst_h * 4)
    scale_x = src_w / dst_w
    scale_y = src_h / dst_h
    box_w = max(1, int(round(scale_x)))
    box_h = max(1, int(round(scale_y)))

    for dy in range(dst_h):
        sy0 = int(dy * scale_y)
        for dx in range(dst_w):
            sx0 = int(dx * scale_x)
            r_acc = g_acc = b_acc = a_acc = 0
            count = 0
            for oy in range(box_h):
                sy = min(src_h - 1, sy0 + oy)
                row_off = sy * src_w * 4
                for ox in range(box_w):
                    sx = min(src_w - 1, sx0 + ox)
                    idx = row_off + sx * 4
                    r_acc += src_buf[idx]
                    g_acc += src_buf[idx + 1]
                    b_acc += src_buf[idx + 2]
                    a_acc += src_buf[idx + 3]
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
    print(f"Generated {filepath} ({width}x{height})")


def main():
    print("Rendering 512x512 master icon for ESWA GEOLOGICAL MAPPER (Official Eagle Logo)...")
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
