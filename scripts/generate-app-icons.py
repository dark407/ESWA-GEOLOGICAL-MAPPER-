#!/usr/bin/env python3
"""
Generates high-resolution anti-aliased ESWA Tunnel Mapper PNG icons matching
EswaTunnelLogo (src/components/EswaBrandIdentity.tsx & public/icon.svg):
  - Outer Geotechnical Instrument Chassis with dark navy gradient & cyan-emerald bezel
  - Inner Stereonet Compass Ring & cardinal ticks
  - Rose dashed overbreak excavation contour
  - Glowing cyan/emerald D-shaped tunnel portal arch
  - Multi-colored geological discontinuity joint traces (Amber J1, Sky J2, Emerald J3)
  - Precision central 'E' structural monogram
  - 3D survey control points (CP1, CP2, CP3) with white rings
  - Bottom 'ESWA' nameplate with geometric 'ESWA' lettering
Outputs all PWA and Android launcher icon densities (512, 192, 180, 144, 96, 72, 48).
"""

import math
import os
import struct
import zlib


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return lo if v < lo else (hi if v > hi else v)


def lerp_color(c1, c2, t: float):
    t = clamp(t, 0.0, 1.0)
    return (
        c1[0] + (c2[0] - c1[0]) * t,
        c1[1] + (c2[1] - c1[1]) * t,
        c1[2] + (c2[2] - c1[2]) * t,
    )


def blend(dst, src_rgb, alpha: float):
    a = clamp(alpha, 0.0, 1.0)
    if a <= 0.0:
        return dst
    if a >= 1.0:
        return (src_rgb[0], src_rgb[1], src_rgb[2], 255.0)
    inv = 1.0 - a
    return (
        dst[0] * inv + src_rgb[0] * a,
        dst[1] * inv + src_rgb[1] * a,
        dst[2] * inv + src_rgb[2] * a,
        255.0,
    )


def dist_to_segment(px: float, py: float, x1: float, y1: float, x2: float, y2: float) -> float:
    dx = x2 - x1
    dy = y2 - y1
    l2 = dx * dx + dy * dy
    if l2 == 0.0:
        return math.hypot(px - x1, py - y1)
    t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0.0, 1.0)
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return math.hypot(px - proj_x, py - proj_y)


def dist_to_polyline(px: float, py: float, pts: list) -> float:
    best = 1e9
    for i in range(len(pts) - 1):
        d = dist_to_segment(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])
        if d < best:
            best = d
    return best


def rounded_rect_sdf(px: float, py: float, cx: float, cy: float, half_w: float, half_h: float, r: float) -> float:
    qx = abs(px - cx) - (half_w - r)
    qy = abs(py - cy) - (half_h - r)
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - r


# Vector segments for "ESWA" lettering inside the bottom nameplate (x in 152..360, y in 421..455)
ESWA_LETTER_SEGMENTS = [
    # 'E' (x: 158..184, y: 422..454)
    (158, 422, 158, 454),
    (158, 422, 184, 422),
    (158, 438, 180, 438),
    (158, 454, 184, 454),
    # 'S' (x: 204..232, y: 422..454)
    (232, 422, 206, 422),
    (206, 422, 206, 438),
    (206, 438, 232, 438),
    (232, 438, 232, 454),
    (232, 454, 204, 454),
    # 'W' (x: 252..294, y: 422..454)
    (252, 422, 260, 454),
    (260, 454, 273, 432),
    (273, 432, 286, 454),
    (286, 454, 294, 422),
    # 'A' (x: 314..348, y: 422..454)
    (314, 454, 331, 422),
    (331, 422, 348, 454),
    (320, 443, 342, 443),
]

OVERBREAK_PTS = [
    (82, 388),
    (74, 232),
    (102, 146),
    (166, 88),
    (256, 68),
    (348, 86),
    (412, 148),
    (438, 236),
    (430, 388),
]

JOINT_J1 = [(114, 298), (194, 246), (288, 198), (396, 158)]
JOINT_J2 = [(144, 150), (228, 216), (316, 292), (394, 358)]
JOINT_J3 = [(114, 354), (228, 322), (338, 288), (398, 264)]

MONOGRAM_E = [
    (196, 168, 322, 168),
    (196, 168, 196, 336),
    (196, 252, 298, 252),
    (196, 336, 322, 336),
]


def render_master_512() -> list:
    """Renders the 512x512 RGBA master buffer in 0..512 coordinate space."""
    W = 512
    H = 512
    aa = 1.6  # anti-aliasing feather width in 512-space
    rows = []

    for y in range(H):
        py = y + 0.5
        row = bytearray(W * 4)
        t_diag = (py / 512.0) * 0.5

        for x in range(W):
            px = x + 0.5
            diag = t_diag + (px / 512.0) * 0.5

            # 1. Outer Geotechnical Instrument Chassis (rect x=16..496, y=16..496, rx=92)
            chassis_sdf = rounded_rect_sdf(px, py, 256.0, 256.0, 240.0, 240.0, 88.0)
            if chassis_sdf > aa:
                # Full-bleed dark backing outside rounded bezel so Android adaptive/square masks never show white corners
                bg_outer = lerp_color((6, 10, 18), (11, 20, 34), diag)
                r, g, b = bg_outer
                row[x * 4 : x * 4 + 4] = bytes((int(r), int(g), int(b), 255))
                continue

            bg_col = lerp_color((8, 13, 24), (15, 25, 44), diag)
            col = (bg_col[0], bg_col[1], bg_col[2], 255.0)

            # Bezel border around chassis (strokeWidth = 8)
            bezel_dist = abs(chassis_sdf + 4.0)
            if bezel_dist < 5.0 + aa:
                bezel_col = lerp_color((14, 165, 233), (16, 185, 129), diag)
                col = blend(col, bezel_col, clamp((5.0 - bezel_dist) / aa))

            # 2. Inner Stereonet Compass Ring (cx=256, cy=244, r=204 & r=192)
            r_comp = math.hypot(px - 256.0, py - 244.0)
            d_ring1 = abs(r_comp - 204.0)
            if d_ring1 < 2.2 + aa:
                col = blend(col, (51, 65, 85), clamp((2.2 - d_ring1) / aa) * 0.85)
            d_ring2 = abs(r_comp - 192.0)
            if d_ring2 < 1.8 + aa:
                ang = math.atan2(py - 244.0, px - 256.0)
                if int((ang + math.pi) * 18.0) % 2 == 0:
                    col = blend(col, (56, 189, 248), clamp((1.8 - d_ring2) / aa) * 0.45)

            # 3. Rose Dashed Overbreak Profile
            if 60.0 <= px <= 452.0 and 58.0 <= py <= 398.0:
                d_ob = dist_to_polyline(px, py, OVERBREAK_PTS)
                if d_ob < 4.0 + aa:
                    if int((px + py) / 14.0) % 2 == 0:
                        col = blend(col, (244, 63, 94), clamp((4.0 - d_ob) / aa) * 0.9)

            # 4. Primary D-Shaped Tunnel Design Profile Arch
            # Arch geometry: x in 102..410, straight walls y in 236..388, semicircle center (256, 236) radius 154
            in_tunnel_interior = False
            d_arch_edge = 1e9
            if 102.0 <= px <= 410.0 and 236.0 <= py <= 388.0:
                in_tunnel_interior = True
                d_arch_edge = min(px - 102.0, 410.0 - px, 388.0 - py)
            elif py <= 236.0:
                rc = math.hypot(px - 256.0, py - 236.0)
                if rc <= 154.0:
                    in_tunnel_interior = True
                    d_arch_edge = 154.0 - rc
                else:
                    d_arch_edge = rc - 154.0
            else:
                # Outside wall/invert below y=236
                dx_w = max(102.0 - px, 0.0, px - 410.0)
                dy_w = max(236.0 - py, 0.0, py - 388.0)
                d_arch_edge = math.hypot(dx_w, dy_w)

            if in_tunnel_interior:
                portal_t = clamp(math.hypot(px - 256.0, py - 240.0) / 180.0, 0.0, 1.0)
                portal_col = lerp_color((18, 36, 60), (6, 10, 18), portal_t)
                col = blend(col, portal_col, clamp(d_arch_edge / aa))

                # 5. Geological Discontinuity Joint Traces inside Tunnel Portal
                d_j1 = dist_to_polyline(px, py, JOINT_J1)
                if d_j1 < 4.5 + aa:
                    col = blend(col, (245, 158, 11), clamp((4.5 - d_j1) / aa))

                d_j2 = dist_to_polyline(px, py, JOINT_J2)
                if d_j2 < 4.2 + aa:
                    col = blend(col, (56, 189, 248), clamp((4.2 - d_j2) / aa))

                d_j3 = dist_to_polyline(px, py, JOINT_J3)
                if d_j3 < 4.0 + aa:
                    col = blend(col, (16, 185, 129), clamp((4.0 - d_j3) / aa))

            # Tunnel Arch Glowing Stroke (half-width = 8.0)
            if d_arch_edge < 8.0 + aa:
                arch_col = lerp_color((34, 211, 238), (16, 185, 129), diag)
                col = blend(col, arch_col, clamp((8.0 - d_arch_edge) / aa))

            # 6. Central Structural "E" Monogram (x: 184..334, y: 150..354)
            if 170.0 <= px <= 346.0 and 144.0 <= py <= 360.0:
                d_e = min(dist_to_segment(px, py, x1, y1, x2, y2) for x1, y1, x2, y2 in MONOGRAM_E)
                if d_e < 17.5 + aa:
                    col = blend(col, (6, 10, 18), clamp((17.5 - d_e) / aa) * 0.95)
                if d_e < 11.5 + aa:
                    e_col = lerp_color((248, 250, 252), (56, 189, 248), clamp((py - 168.0) / 168.0))
                    col = blend(col, e_col, clamp((11.5 - d_e) / aa))

            # 7. 3D Survey Control Targets (CP1 left wall, CP2 crown, CP3 right wall)
            for cx_p, cy_p, inner_rgb in [
                (102.0, 236.0, (16, 185, 129)),
                (256.0, 82.0, (14, 165, 233)),
                (410.0, 236.0, (16, 185, 129)),
            ]:
                dc = math.hypot(px - cx_p, py - cy_p)
                if dc < 15.5 + aa:
                    col = blend(col, (255, 255, 255), clamp((15.5 - dc) / aa))
                if dc < 10.5 + aa:
                    col = blend(col, inner_rgb, clamp((10.5 - dc) / aa))

            # 8. Invert Nameplate Lockup ("ESWA", rect x=106..406, y=404..472, rx=18)
            if 98.0 <= px <= 414.0 and 396.0 <= py <= 480.0:
                np_sdf = rounded_rect_sdf(px, py, 256.0, 438.0, 150.0, 34.0, 18.0)
                if np_sdf < aa:
                    col = blend(col, (7, 11, 20), clamp(-np_sdf / aa))
                np_border = abs(np_sdf)
                if np_border < 2.4 + aa:
                    col = blend(col, (34, 211, 238), clamp((2.4 - np_border) / aa))
                if np_sdf < 0.0 and 148.0 <= px <= 360.0 and 414.0 <= py <= 462.0:
                    d_txt = min(
                        dist_to_segment(px, py, x1, y1, x2, y2)
                        for x1, y1, x2, y2 in ESWA_LETTER_SEGMENTS
                    )
                    if d_txt < 4.2 + aa:
                        col = blend(col, (248, 250, 252), clamp((4.2 - d_txt) / aa))

            row[x * 4 : x * 4 + 4] = bytes(
                (int(clamp(col[0], 0, 255)), int(clamp(col[1], 0, 255)), int(clamp(col[2], 0, 255)), 255)
            )
        rows.append(bytes(row))
    return rows


def downsample_rows(master_rows: list, target_size: int) -> list:
    if target_size == 512:
        return master_rows
    scale = 512.0 / target_size
    out_rows = []
    for ty in range(target_size):
        y0 = int(ty * scale)
        y1 = max(y0 + 1, min(512, int((ty + 1) * scale)))
        row = bytearray(target_size * 4)
        for tx in range(target_size):
            x0 = int(tx * scale)
            x1 = max(x0 + 1, min(512, int((tx + 1) * scale)))
            r_sum = g_sum = b_sum = count = 0
            for sy in range(y0, y1):
                srow = master_rows[sy]
                for sx in range(x0, x1):
                    off = sx * 4
                    r_sum += srow[off]
                    g_sum += srow[off + 1]
                    b_sum += srow[off + 2]
                    count += 1
            row[tx * 4 : tx * 4 + 4] = bytes(
                (r_sum // count, g_sum // count, b_sum // count, 255)
            )
        out_rows.append(bytes(row))
    return out_rows


def write_png(path: str, width: int, height: int, rows: list) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    raw = b"".join(b"\x00" + r for r in rows)

    def chunk(ctype: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(ctype + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + ctype + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw, 9)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    is_ci = os.environ.get("GITHUB_ACTIONS") == "true"
    base_out_dir = repo_root if is_ci else "/tmp/akash-release-cache"
    master_512 = render_master_512()

    targets = [
        ("public/pwa-512x512.png", 512),
        ("public/pwa-maskable-512x512.png", 512),
        ("public/pwa-192x192.png", 192),
        ("public/apple-touch-icon.png", 180),
        ("public/icons/icon-512x512.png", 512),
        ("public/icons/icon-192x192.png", 192),
        ("public/icons/icon-144x144.png", 144),
        ("public/icons/icon-96x96.png", 96),
        ("public/icons/icon-72x72.png", 72),
        ("public/icons/icon-48x48.png", 48),
    ]

    cache = {512: master_512}
    for rel_path, sz in targets:
        if sz not in cache:
            cache[sz] = downsample_rows(master_512, sz)
        full_path = os.path.join(base_out_dir, rel_path)
        write_png(full_path, sz, sz, cache[sz])
        print(f"Generated {full_path} ({sz}x{sz}, {os.path.getsize(full_path)} bytes)")


if __name__ == "__main__":
    main()
