#!/usr/bin/env python3
"""
Compiles a 100% standalone, offline-capable, signed Android APK
(ESWA-TUNNEL-MAPPER-User-Android.apk) with:
  1. Binary AndroidManifest.xml (RES_XML_TYPE 0x0003)
  2. Binary resources.arsc (RES_TABLE_TYPE 0x0002)
  3. Dalvik Executable classes.dex (dex\\n035\\0) for com.eswa.tunnelmapper.user.MainActivity
     which launches a full-screen native Android WebView and loads the bundled application
     directly from inside the APK (file:///android_asset/www/index.html) — NO Chrome or external URL!
  4. All compiled User Edition assets under assets/www/
  5. Both JAR v1 (META-INF/MANIFEST.MF, CERT.SF, CERT.RSA) and
     APK Signature Scheme v2 (APK Sig Block 42, ID 0x7109871a) digital signatures.
"""

import base64
import hashlib
import os
import struct
import subprocess
import sys
import zlib
import zipfile


def uleb128(value: int) -> bytes:
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value != 0:
            byte |= 0x80
        out.append(byte)
        if value == 0:
            break
    return bytes(out)


def build_binary_axml(
    pkg_name_str: str = "com.eswa.tunnelmapper.user",
    app_label_str: str = "ESWA Tunnel Mapper",
) -> bytes:
    """
    Builds a spec-compliant Android Binary XML (AXML) AndroidManifest.xml
    for the requested package and launcher label.
    """
    # 1. Attribute names that map to android:* resource IDs MUST come first,
    #    sorted in ascending order of their resource ID.
    res_attrs = [
        ("theme", 0x01010000),
        ("label", 0x01010001),
        ("icon", 0x01010002),
        ("name", 0x01010003),
        ("exported", 0x01010010),
        ("screenOrientation", 0x0101001E),
        ("configChanges", 0x0101001F),
        ("minSdkVersion", 0x0101020C),
        ("versionCode", 0x0101021B),
        ("versionName", 0x0101021C),
        ("targetSdkVersion", 0x01010270),
        ("hardwareAccelerated", 0x010102D3),
        ("usesCleartextTraffic", 0x010104EC),
        ("roundIcon", 0x0101052C),
    ]

    other_strings = [
        "android",
        "http://schemas.android.com/apk/res/android",
        "manifest",
        "package",
        pkg_name_str,
        "1.6.0",
        "uses-sdk",
        "uses-permission",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "application",
        app_label_str,
        "activity",
        f"{pkg_name_str}.MainActivity",
        "intent-filter",
        "action",
        "android.intent.action.MAIN",
        "category",
        "android.intent.category.LAUNCHER",
    ]

    all_strings = [s for s, _ in res_attrs] + other_strings
    str_idx = {s: i for i, s in enumerate(all_strings)}

    # Encode UTF-16LE String Pool Chunk (RES_STRING_POOL_TYPE = 0x0001)
    encoded_strings = []
    offsets = []
    cur_off = 0
    for s in all_strings:
        offsets.append(cur_off)
        u16 = s.encode("utf-16le")
        char_len = len(s)
        entry = struct.pack("<H", char_len) + u16 + struct.pack("<H", 0)
        encoded_strings.append(entry)
        cur_off += len(entry)

    str_blob = b"".join(encoded_strings)
    while len(str_blob) % 4 != 0:
        str_blob += b"\x00"

    str_count = len(all_strings)
    strings_start = 28 + str_count * 4
    pool_size = strings_start + len(str_blob)
    string_pool_chunk = (
        struct.pack(
            "<HHIIIIII",
            0x0001,         # RES_STRING_POOL_TYPE
            28,             # headerSize
            pool_size,      # chunkSize
            str_count,      # stringCount
            0,              # styleCount
            0,              # flags (0 = UTF-16)
            strings_start,  # stringsStart
            0,              # stylesStart
        )
        + b"".join(struct.pack("<I", o) for o in offsets)
        + str_blob
    )

    # Resource Map Chunk (RES_XML_RESOURCE_MAP_TYPE = 0x0180)
    res_ids = [rid for _, rid in res_attrs]
    res_map_size = 8 + len(res_ids) * 4
    res_map_chunk = struct.pack("<HHI", 0x0180, 8, res_map_size) + b"".join(
        struct.pack("<I", rid) for rid in res_ids
    )

    ns_prefix = str_idx["android"]
    ns_uri = str_idx["http://schemas.android.com/apk/res/android"]
    NO_IDX = 0xFFFFFFFF

    def start_ns(line: int) -> bytes:
        return struct.pack("<HHIIIII", 0x0100, 16, 24, line, NO_IDX, ns_prefix, ns_uri)

    def end_ns(line: int) -> bytes:
        return struct.pack("<HHIIIII", 0x0101, 16, 24, line, NO_IDX, ns_prefix, ns_uri)

    def attr_str(ns: int, name_s: str, val_s: str) -> bytes:
        v_i = str_idx[val_s]
        return struct.pack(
            "<IIIHBBI",
            ns,
            str_idx[name_s],
            v_i,
            8,
            0,
            0x03,  # TYPE_STRING
            v_i,
        )

    def attr_int(ns: int, name_s: str, val: int, dtype: int = 0x10) -> bytes:
        return struct.pack(
            "<IIIHBBI",
            ns,
            str_idx[name_s],
            NO_IDX,
            8,
            0,
            dtype,
            val & 0xFFFFFFFF,
        )

    def start_el(line: int, tag: str, attrs: list) -> bytes:
        size = 36 + len(attrs) * 20
        hdr = struct.pack(
            "<HHIIIIIHHHHHH",
            0x0102,          # RES_XML_START_ELEMENT_TYPE
            16,
            size,
            line,
            NO_IDX,
            NO_IDX,          # namespace
            str_idx[tag],
            20,              # attributeStart
            20,              # attributeSize
            len(attrs),      # attributeCount
            0,               # idIndex
            0,               # classIndex
            0,               # styleIndex
        )
        return hdr + b"".join(attrs)

    def end_el(line: int, tag: str) -> bytes:
        return struct.pack("<HHIIIII", 0x0103, 16, 24, line, NO_IDX, NO_IDX, str_idx[tag])

    chunks = [
        string_pool_chunk,
        res_map_chunk,
        start_ns(2),
        # <manifest package="..." android:versionCode="6" android:versionName="1.6.0">
        start_el(
            2,
            "manifest",
            [
                attr_int(ns_uri, "versionCode", 6, 0x10),
                attr_str(ns_uri, "versionName", "1.6.0"),
                attr_str(NO_IDX, "package", pkg_name_str),
            ],
        ),
        # <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />
        start_el(
            6,
            "uses-sdk",
            [
                attr_int(ns_uri, "minSdkVersion", 24, 0x10),
                attr_int(ns_uri, "targetSdkVersion", 34, 0x10),
            ],
        ),
        end_el(6, "uses-sdk"),
        # <uses-permission android:name="android.permission.INTERNET" />
        start_el(
            8,
            "uses-permission",
            [attr_str(ns_uri, "name", "android.permission.INTERNET")],
        ),
        end_el(8, "uses-permission"),
        # <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
        start_el(
            9,
            "uses-permission",
            [attr_str(ns_uri, "name", "android.permission.ACCESS_NETWORK_STATE")],
        ),
        end_el(9, "uses-permission"),
        # <application android:theme="@android:style/Theme.NoTitleBar" android:label="..." android:icon="@drawable/ic_launcher" android:roundIcon="@drawable/ic_launcher" android:hardwareAccelerated="true" android:usesCleartextTraffic="true">
        start_el(
            12,
            "application",
            [
                attr_int(ns_uri, "theme", 0x01030006, 0x01),  # @android:style/Theme.NoTitleBar
                attr_str(ns_uri, "label", app_label_str),
                attr_int(ns_uri, "icon", 0x7F010000, 0x01),   # @drawable/ic_launcher
                attr_int(ns_uri, "hardwareAccelerated", 0xFFFFFFFF, 0x12),
                attr_int(ns_uri, "usesCleartextTraffic", 0xFFFFFFFF, 0x12),
                attr_int(ns_uri, "roundIcon", 0x7F010000, 0x01),  # @drawable/ic_launcher
            ],
        ),
        # <activity android:label="..." android:icon="@drawable/ic_launcher" android:roundIcon="@drawable/ic_launcher" android:name="<pkg>.MainActivity" android:exported="true" android:configChanges="orientation|keyboardHidden|screenSize">
        start_el(
            16,
            "activity",
            [
                attr_str(ns_uri, "label", app_label_str),
                attr_int(ns_uri, "icon", 0x7F010000, 0x01),   # @drawable/ic_launcher
                attr_str(ns_uri, "name", f"{pkg_name_str}.MainActivity"),
                attr_int(ns_uri, "exported", 0xFFFFFFFF, 0x12),
                attr_int(ns_uri, "screenOrientation", 6, 0x10),  # 6 = sensorLandscape (horizontal mode)
                attr_int(ns_uri, "configChanges", 0x000004A0, 0x11),
                attr_int(ns_uri, "roundIcon", 0x7F010000, 0x01),  # @drawable/ic_launcher
            ],
        ),
        # <intent-filter>
        start_el(20, "intent-filter", []),
        start_el(
            21,
            "action",
            [attr_str(ns_uri, "name", "android.intent.action.MAIN")],
        ),
        end_el(21, "action"),
        start_el(
            22,
            "category",
            [attr_str(ns_uri, "name", "android.intent.category.LAUNCHER")],
        ),
        end_el(22, "category"),
        end_el(23, "intent-filter"),
        end_el(24, "activity"),
        end_el(25, "application"),
        end_el(26, "manifest"),
        end_ns(26),
    ]

    body = b"".join(chunks)
    total_size = 8 + len(body)
    return struct.pack("<HHI", 0x0003, 8, total_size) + body


def make_utf16_string_pool(strings_list: list) -> bytes:
    encoded = []
    offsets = []
    cur = 0
    for s in strings_list:
        offsets.append(cur)
        u16 = s.encode("utf-16le")
        entry = struct.pack("<H", len(s)) + u16 + struct.pack("<H", 0)
        encoded.append(entry)
        cur += len(entry)
    blob = b"".join(encoded)
    while len(blob) % 4 != 0:
        blob += b"\x00"
    count = len(strings_list)
    strings_start = 28 + count * 4
    total = strings_start + len(blob)
    return (
        struct.pack("<HHIIIIII", 0x0001, 28, total, count, 0, 0, strings_start, 0)
        + b"".join(struct.pack("<I", o) for o in offsets)
        + blob
    )


def build_resources_arsc(pkg_name_str: str = "com.eswa.tunnelmapper.user") -> bytes:
    """
    Builds a valid binary resources.arsc (RES_TABLE_TYPE = 0x0002) mapping
    resource ID 0x7F010000 (@drawable/ic_launcher) across default + mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi
    screen densities so every Android phone launcher resolves the ESWA Tunnel Mapper icon.
    """
    density_entries = [
        ("res/drawable/ic_launcher.png", 0),
        ("res/drawable-mdpi/ic_launcher.png", 160),
        ("res/drawable-hdpi/ic_launcher.png", 240),
        ("res/drawable-xhdpi/ic_launcher.png", 320),
        ("res/drawable-xxhdpi/ic_launcher.png", 480),
        ("res/drawable-xxxhdpi/ic_launcher.png", 640),
    ]
    global_pool = make_utf16_string_pool([path for path, _ in density_entries])
    type_pool = make_utf16_string_pool(["drawable"])
    key_pool = make_utf16_string_pool(["ic_launcher"])

    # RES_TABLE_TYPE_SPEC_TYPE (0x0202) for type id 1 ('drawable'), 1 entry with CONFIG_DENSITY (0x0100)
    type_spec_chunk = struct.pack("<HHIBBHII", 0x0202, 16, 20, 1, 0, 0, 1, 0x00000100)

    type_chunks = []
    for str_idx, (_, density) in enumerate(density_entries):
        # 36-byte ResTable_config with density at offset 14..16
        config_bytes = struct.pack("<IIIBBH", 36, 0, 0, 0, 0, density) + (b"\x00" * 20)
        entry_offset_table = struct.pack("<I", 0)
        # ResTable_entry (8 bytes: size=8, flags=0, key=0) + Res_value (8 bytes: size=8, res0=0, dataType=0x03 TYPE_STRING, data=str_idx)
        entry_and_val = struct.pack("<HHI", 8, 0, 0) + struct.pack("<HBBI", 8, 0, 0x03, str_idx)
        type_chunk_size = 56 + len(entry_offset_table) + len(entry_and_val)
        type_chunk = (
            struct.pack("<HHIBBHII", 0x0201, 56, type_chunk_size, 1, 0, 0, 1, 60)
            + config_bytes
            + entry_offset_table
            + entry_and_val
        )
        type_chunks.append(type_chunk)

    pkg_name = pkg_name_str.encode("utf-16le")
    pkg_name_padded = pkg_name + (b"\x00" * (256 - len(pkg_name)))

    pkg_hdr_size = 288
    type_strings_off = pkg_hdr_size
    key_strings_off = type_strings_off + len(type_pool)
    pkg_body = type_pool + key_pool + type_spec_chunk + b"".join(type_chunks)
    pkg_chunk_size = pkg_hdr_size + len(pkg_body)

    pkg_header = (
        struct.pack("<HHII", 0x0200, pkg_hdr_size, pkg_chunk_size, 0x7F)
        + pkg_name_padded
        + struct.pack("<IIIII", type_strings_off, 1, key_strings_off, 1, 0)
    )
    pkg_chunk = pkg_header + pkg_body

    total_len = 12 + len(global_pool) + len(pkg_chunk)
    return struct.pack("<HHII", 0x0002, 12, total_len, 1) + global_pool + pkg_chunk


def verify_dex_strict(dex: bytes) -> None:
    """
    Simulates Android ART's DexFileVerifier (art/libdexfile/dex/dex_file_verifier.cc)
    to guarantee that every section offset, alignment, map item, and checksum in
    classes.dex passes Android 8..15 ART verification without error.
    """
    assert dex[:8] == b"dex\n035\x00", "Invalid DEX magic"
    expected_adler = zlib.adler32(dex[12:]) & 0xFFFFFFFF
    actual_adler = struct.unpack_from("<I", dex, 8)[0]
    assert actual_adler == expected_adler, f"Adler32 mismatch: {actual_adler} != {expected_adler}"
    expected_sha1 = hashlib.sha1(dex[32:]).digest()
    assert dex[12:32] == expected_sha1, "SHA-1 signature mismatch"

    (
        file_size,
        header_size,
        endian_tag,
        _link_size,
        _link_off,
        map_off,
        string_ids_size,
        string_ids_off,
        type_ids_size,
        type_ids_off,
        proto_ids_size,
        proto_ids_off,
        field_ids_size,
        field_ids_off,
        method_ids_size,
        method_ids_off,
        class_defs_size,
        class_defs_off,
        data_size,
        data_off,
    ) = struct.unpack_from("<20I", dex, 32)

    assert file_size == len(dex), f"file_size {file_size} != {len(dex)}"
    assert header_size == 112
    assert endian_tag == 0x12345678
    assert data_off + data_size == file_size

    # Verify MapList & CheckIntraSection alignment/offset continuity exactly like ART DexFileVerifier
    map_count = struct.unpack_from("<I", dex, map_off)[0]
    pos = map_off + 4
    map_entries = []
    for _ in range(map_count):
        m_type, _unused, m_size, m_off = struct.unpack_from("<HHII", dex, pos)
        map_entries.append((m_type, m_size, m_off))
        pos += 12

    def read_uleb(buf: bytes, p: int):
        res = 0
        shift = 0
        while True:
            b = buf[p]
            p += 1
            res |= (b & 0x7F) << shift
            if (b & 0x80) == 0:
                break
            shift += 7
        return res, p

    cur_off = 0
    for m_type, m_size, m_off in map_entries:
        # 4-byte aligned sections in ART DexFileVerifier
        if m_type in (0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x1001, 0x2001, 0x1000):
            while cur_off % 4 != 0:
                cur_off += 1
        assert cur_off == m_off, (
            f"ART DexFileVerifier CheckIntraSection failed for section 0x{m_type:04x}: "
            f"expected offset {cur_off}, map_list has {m_off}"
        )
        if m_type == 0x0000:
            cur_off += 112
        elif m_type == 0x0001:
            cur_off += m_size * 4
        elif m_type == 0x0002:
            cur_off += m_size * 4
        elif m_type == 0x0003:
            cur_off += m_size * 12
        elif m_type == 0x0004:
            cur_off += m_size * 8
        elif m_type == 0x0005:
            cur_off += m_size * 8
        elif m_type == 0x0006:
            cur_off += m_size * 32
        elif m_type == 0x1001:
            for _ in range(m_size):
                while cur_off % 4 != 0:
                    cur_off += 1
                cnt = struct.unpack_from("<I", dex, cur_off)[0]
                cur_off += 4 + cnt * 2
        elif m_type == 0x2001:
            for _ in range(m_size):
                while cur_off % 4 != 0:
                    cur_off += 1
                insns_cnt = struct.unpack_from("<I", dex, cur_off + 12)[0]
                cur_off += 16 + insns_cnt * 2
        elif m_type == 0x2002:
            for _ in range(m_size):
                _u16_len, cur_off = read_uleb(dex, cur_off)
                while dex[cur_off] != 0:
                    cur_off += 1
                cur_off += 1
        elif m_type == 0x2000:
            for _ in range(m_size):
                sf, cur_off = read_uleb(dex, cur_off)
                inf, cur_off = read_uleb(dex, cur_off)
                dm, cur_off = read_uleb(dex, cur_off)
                vm, cur_off = read_uleb(dex, cur_off)
                for _ in range(sf + inf):
                    _, cur_off = read_uleb(dex, cur_off)
                    _, cur_off = read_uleb(dex, cur_off)
                for _ in range(dm + vm):
                    _, cur_off = read_uleb(dex, cur_off)
                    _, cur_off = read_uleb(dex, cur_off)
                    _, cur_off = read_uleb(dex, cur_off)
        elif m_type == 0x1000:
            cnt = struct.unpack_from("<I", dex, cur_off)[0]
            cur_off += 4 + cnt * 12

    assert cur_off == file_size, f"Final DEX offset {cur_off} != file_size {file_size}"

    # CheckInterSection: verify string sorting, type descriptors, proto shorties, field/method sorting
    decoded_strings = []
    for i in range(string_ids_size):
        s_off = struct.unpack_from("<I", dex, string_ids_off + i * 4)[0]
        u16_len, p = read_uleb(dex, s_off)
        end_p = dex.index(0, p)
        s_val = dex[p:end_p].decode("utf-8")
        assert len(s_val) == u16_len, f"String {i} u16_len mismatch"
        decoded_strings.append(s_val)
    for i in range(1, len(decoded_strings)):
        assert decoded_strings[i - 1] < decoded_strings[i], (
            f"Strings not strictly sorted at {i}: {decoded_strings[i - 1]} >= {decoded_strings[i]}"
        )

    decoded_types = []
    prev_t_sidx = -1
    for i in range(type_ids_size):
        t_sidx = struct.unpack_from("<I", dex, type_ids_off + i * 4)[0]
        assert t_sidx > prev_t_sidx, f"type_ids not sorted at {i}"
        prev_t_sidx = t_sidx
        decoded_types.append(decoded_strings[t_sidx])

    def shorty_char(desc: str) -> str:
        return "L" if (desc.startswith("L") or desc.startswith("[")) else desc

    for i in range(proto_ids_size):
        sh_idx, ret_tidx, params_off = struct.unpack_from("<III", dex, proto_ids_off + i * 12)
        shorty_str = decoded_strings[sh_idx]
        ret_desc = decoded_types[ret_tidx]
        param_descs = []
        if params_off != 0:
            p_cnt = struct.unpack_from("<I", dex, params_off)[0]
            for j in range(p_cnt):
                pt_idx = struct.unpack_from("<H", dex, params_off + 4 + j * 2)[0]
                param_descs.append(decoded_types[pt_idx])
        expected_shorty = shorty_char(ret_desc) + "".join(shorty_char(d) for d in param_descs)
        assert shorty_str == expected_shorty, (
            f"ART CheckInterProtoIdItem failed at proto {i}: shorty '{shorty_str}' != expected '{expected_shorty}' "
            f"for return '{ret_desc}' and params {param_descs}"
        )


def build_classes_dex(pkg_name_str: str = "com.eswa.tunnelmapper.user") -> bytes:
    """
    Builds a 100% spec-compliant Dalvik Executable (classes.dex) for
    <pkg>.MainActivity extends android.app.Activity
    and <pkg>.MainChromeClient extends android.webkit.WebChromeClient.
    Supports:
      - Full-screen Android WebView loading file:///android_asset/www/index.html
      - Native photo/file upload via WebChromeClient.onShowFileChooser + Activity.onActivityResult(1001)
      - Native data sheet download (CSV, DXF, DOC, HTML, PNG, SVG, JSON, PDF) via
        WebChromeClient.onJsPrompt + Intent.ACTION_CREATE_DOCUMENT + Activity.onActivityResult(1002)
    """
    pkg_slash = pkg_name_str.replace(".", "/")
    cls_main = f"L{pkg_slash}/MainActivity;"
    cls_chrome = f"L{pkg_slash}/MainChromeClient;"

    strings = sorted(
        set(
            [
                "*/*",
                "<init>",
                "I",
                "L",
                "LIL",
                "LL",
                "LLI",
                "LLL",
                "Landroid/app/Activity;",
                "Landroid/content/ContentResolver;",
                "Landroid/content/Context;",
                "Landroid/content/Intent;",
                "Landroid/net/Uri;",
                "Landroid/os/Bundle;",
                "Landroid/util/Base64;",
                "Landroid/view/View;",
                "Landroid/webkit/JsPromptResult;",
                "Landroid/webkit/ValueCallback;",
                "Landroid/webkit/WebChromeClient$FileChooserParams;",
                "Landroid/webkit/WebChromeClient;",
                "Landroid/webkit/WebSettings;",
                "Landroid/webkit/WebView;",
                "Landroid/webkit/WebViewClient;",
                cls_main,
                cls_chrome,
                "Ljava/io/OutputStream;",
                "Ljava/lang/Object;",
                "Ljava/lang/String;",
                "OK",
                "V",
                "VIIL",
                "VL",
                "VLI",
                "VZ",
                "Z",
                "ZLLL",
                "ZLLLLL",
                "[B",
                "[Landroid/net/Uri;",
                "act",
                "addCategory",
                "android.intent.action.CREATE_DOCUMENT",
                "android.intent.action.GET_CONTENT",
                "android.intent.category.OPENABLE",
                "android.intent.extra.TITLE",
                "canGoBack",
                "close",
                "confirm",
                "decode",
                "file:///android_asset/www/index.html",
                "filePathCallback",
                "getContentResolver",
                "getData",
                "getSettings",
                "goBack",
                "loadUrl",
                "onActivityResult",
                "onBackPressed",
                "onCreate",
                "onJsPrompt",
                "onReceiveValue",
                "onShowFileChooser",
                "openOutputStream",
                "parseResult",
                "pendingSaveBytes",
                "putExtra",
                "setAllowContentAccess",
                "setAllowFileAccess",
                "setAllowFileAccessFromFileURLs",
                "setAllowUniversalAccessFromFileURLs",
                "setContentView",
                "setDatabaseEnabled",
                "setDomStorageEnabled",
                "setJavaScriptEnabled",
                "setLoadWithOverviewMode",
                "setType",
                "setUseWideViewPort",
                "setWebChromeClient",
                "setWebViewClient",
                "startActivityForResult",
                "webView",
                "write",
            ]
        )
    )
    s_idx = {s: i for i, s in enumerate(strings)}

    type_descriptors = sorted(
        [
            "I",
            "Landroid/app/Activity;",
            "Landroid/content/ContentResolver;",
            "Landroid/content/Context;",
            "Landroid/content/Intent;",
            "Landroid/net/Uri;",
            "Landroid/os/Bundle;",
            "Landroid/util/Base64;",
            "Landroid/view/View;",
            "Landroid/webkit/JsPromptResult;",
            "Landroid/webkit/ValueCallback;",
            "Landroid/webkit/WebChromeClient$FileChooserParams;",
            "Landroid/webkit/WebChromeClient;",
            "Landroid/webkit/WebSettings;",
            "Landroid/webkit/WebView;",
            "Landroid/webkit/WebViewClient;",
            cls_main,
            cls_chrome,
            "Ljava/io/OutputStream;",
            "Ljava/lang/Object;",
            "Ljava/lang/String;",
            "V",
            "Z",
            "[B",
            "[Landroid/net/Uri;",
        ],
        key=lambda d: s_idx[d],
    )
    t_idx = {d: i for i, d in enumerate(type_descriptors)}

    # Prototypes: (shorty, return_type, params_tuple)
    raw_protos = [
        ("V", "V", ()),
        ("VIIL", "V", ("I", "I", "Landroid/content/Intent;")),
        ("VL", "V", ("Landroid/content/Context;",)),
        ("VL", "V", ("Landroid/os/Bundle;",)),
        ("VL", "V", ("Landroid/view/View;",)),
        ("VL", "V", ("Landroid/webkit/WebChromeClient;",)),
        ("VL", "V", ("Landroid/webkit/WebViewClient;",)),
        ("VL", "V", (cls_main,)),
        ("VL", "V", ("Ljava/lang/Object;",)),
        ("VL", "V", ("Ljava/lang/String;",)),
        ("VL", "V", ("[B",)),
        ("VLI", "V", ("Landroid/content/Intent;", "I")),
        ("VZ", "V", ("Z",)),
        ("L", "Landroid/content/ContentResolver;", ()),
        ("LL", "Landroid/content/Intent;", ("Ljava/lang/String;",)),
        ("LLL", "Landroid/content/Intent;", ("Ljava/lang/String;", "Ljava/lang/String;")),
        ("L", "Landroid/net/Uri;", ()),
        ("L", "Landroid/webkit/WebSettings;", ()),
        ("LL", "Ljava/io/OutputStream;", ("Landroid/net/Uri;",)),
        ("LLI", "[B", ("Ljava/lang/String;", "I")),
        ("LIL", "[Landroid/net/Uri;", ("I", "Landroid/content/Intent;")),
        ("Z", "Z", ()),
        (
            "ZLLL",
            "Z",
            (
                "Landroid/webkit/WebView;",
                "Landroid/webkit/ValueCallback;",
                "Landroid/webkit/WebChromeClient$FileChooserParams;",
            ),
        ),
        (
            "ZLLLLL",
            "Z",
            (
                "Landroid/webkit/WebView;",
                "Ljava/lang/String;",
                "Ljava/lang/String;",
                "Ljava/lang/String;",
                "Landroid/webkit/JsPromptResult;",
            ),
        ),
    ]

    protos = sorted(
        raw_protos,
        key=lambda p: (t_idx[p[1]], tuple(t_idx[x] for x in p[2])),
    )
    p_idx = {(p[1], p[2]): i for i, p in enumerate(protos)}

    raw_fields = [
        (
            cls_main,
            "Landroid/webkit/ValueCallback;",
            "filePathCallback",
        ),
        (
            cls_main,
            "[B",
            "pendingSaveBytes",
        ),
        (
            cls_main,
            "Landroid/webkit/WebView;",
            "webView",
        ),
        (
            cls_chrome,
            cls_main,
            "act",
        ),
    ]
    fields = sorted(
        raw_fields,
        key=lambda f: (t_idx[f[0]], s_idx[f[2]], t_idx[f[1]]),
    )
    f_idx = {(f[0], f[2]): i for i, f in enumerate(fields)}

    raw_methods = [
        ("Landroid/app/Activity;", "<init>", ("V", ())),
        ("Landroid/app/Activity;", "getContentResolver", ("Landroid/content/ContentResolver;", ())),
        ("Landroid/app/Activity;", "onActivityResult", ("V", ("I", "I", "Landroid/content/Intent;"))),
        ("Landroid/app/Activity;", "onBackPressed", ("V", ())),
        ("Landroid/app/Activity;", "onCreate", ("V", ("Landroid/os/Bundle;",))),
        ("Landroid/app/Activity;", "setContentView", ("V", ("Landroid/view/View;",))),
        ("Landroid/app/Activity;", "startActivityForResult", ("V", ("Landroid/content/Intent;", "I"))),
        (
            "Landroid/content/ContentResolver;",
            "openOutputStream",
            ("Ljava/io/OutputStream;", ("Landroid/net/Uri;",)),
        ),
        ("Landroid/content/Intent;", "<init>", ("V", ("Ljava/lang/String;",))),
        ("Landroid/content/Intent;", "addCategory", ("Landroid/content/Intent;", ("Ljava/lang/String;",))),
        ("Landroid/content/Intent;", "getData", ("Landroid/net/Uri;", ())),
        (
            "Landroid/content/Intent;",
            "putExtra",
            ("Landroid/content/Intent;", ("Ljava/lang/String;", "Ljava/lang/String;")),
        ),
        ("Landroid/content/Intent;", "setType", ("Landroid/content/Intent;", ("Ljava/lang/String;",))),
        ("Landroid/util/Base64;", "decode", ("[B", ("Ljava/lang/String;", "I"))),
        ("Landroid/webkit/JsPromptResult;", "confirm", ("V", ("Ljava/lang/String;",))),
        ("Landroid/webkit/ValueCallback;", "onReceiveValue", ("V", ("Ljava/lang/Object;",))),
        (
            "Landroid/webkit/WebChromeClient$FileChooserParams;",
            "parseResult",
            ("[Landroid/net/Uri;", ("I", "Landroid/content/Intent;")),
        ),
        ("Landroid/webkit/WebChromeClient;", "<init>", ("V", ())),
        ("Landroid/webkit/WebSettings;", "setAllowContentAccess", ("V", ("Z",))),
        ("Landroid/webkit/WebSettings;", "setAllowFileAccess", ("V", ("Z",))),
        ("Landroid/webkit/WebSettings;", "setAllowFileAccessFromFileURLs", ("V", ("Z",))),
        ("Landroid/webkit/WebSettings;", "setAllowUniversalAccessFromFileURLs", ("V", ("Z",))),
        ("Landroid/webkit/WebSettings;", "setDatabaseEnabled", ("V", ("Z",))),
        ("Landroid/webkit/WebSettings;", "setDomStorageEnabled", ("V", ("Z",))),
        ("Landroid/webkit/WebSettings;", "setJavaScriptEnabled", ("V", ("Z",))),
        ("Landroid/webkit/WebSettings;", "setLoadWithOverviewMode", ("V", ("Z",))),
        ("Landroid/webkit/WebSettings;", "setUseWideViewPort", ("V", ("Z",))),
        ("Landroid/webkit/WebView;", "<init>", ("V", ("Landroid/content/Context;",))),
        ("Landroid/webkit/WebView;", "canGoBack", ("Z", ())),
        ("Landroid/webkit/WebView;", "getSettings", ("Landroid/webkit/WebSettings;", ())),
        ("Landroid/webkit/WebView;", "goBack", ("V", ())),
        ("Landroid/webkit/WebView;", "loadUrl", ("V", ("Ljava/lang/String;",))),
        ("Landroid/webkit/WebView;", "setWebChromeClient", ("V", ("Landroid/webkit/WebChromeClient;",))),
        ("Landroid/webkit/WebView;", "setWebViewClient", ("V", ("Landroid/webkit/WebViewClient;",))),
        ("Landroid/webkit/WebViewClient;", "<init>", ("V", ())),
        (
            cls_chrome,
            "<init>",
            ("V", (cls_main,)),
        ),
        (
            cls_chrome,
            "onJsPrompt",
            (
                "Z",
                (
                    "Landroid/webkit/WebView;",
                    "Ljava/lang/String;",
                    "Ljava/lang/String;",
                    "Ljava/lang/String;",
                    "Landroid/webkit/JsPromptResult;",
                ),
            ),
        ),
        (
            cls_chrome,
            "onShowFileChooser",
            (
                "Z",
                (
                    "Landroid/webkit/WebView;",
                    "Landroid/webkit/ValueCallback;",
                    "Landroid/webkit/WebChromeClient$FileChooserParams;",
                ),
            ),
        ),
        (cls_main, "<init>", ("V", ())),
        (
            cls_main,
            "onActivityResult",
            ("V", ("I", "I", "Landroid/content/Intent;")),
        ),
        (cls_main, "onBackPressed", ("V", ())),
        (cls_main, "onCreate", ("V", ("Landroid/os/Bundle;",))),
        ("Ljava/io/OutputStream;", "close", ("V", ())),
        ("Ljava/io/OutputStream;", "write", ("V", ("[B",))),
    ]
    methods = sorted(
        raw_methods,
        key=lambda m: (t_idx[m[0]], s_idx[m[1]], p_idx[m[2]]),
    )
    m_idx = {(m[0], m[1], m[2]): i for i, m in enumerate(methods)}

    # Helper for Dalvik 35c instruction (invoke-virtual / invoke-direct / invoke-super / invoke-static / invoke-interface)
    def insn_35c(op: int, argc: int, method_id: int, regs: list) -> list:
        r = regs + [0] * (5 - len(regs))
        word0 = op | ((argc & 0xF) << 12) | ((r[4] & 0xF) << 8)
        word1 = method_id & 0xFFFF
        word2 = (
            (r[0] & 0xF)
            | ((r[1] & 0xF) << 4)
            | ((r[2] & 0xF) << 8)
            | ((r[3] & 0xF) << 12)
        )
        return [word0, word1, word2]

    f_webview = f_idx[(cls_main, "webView")]
    f_filecb = f_idx[(cls_main, "filePathCallback")]
    f_pending = f_idx[(cls_main, "pendingSaveBytes")]
    f_act = f_idx[(cls_chrome, "act")]

    # 1. Code for MainActivity.<init>()V (registers=1, ins=1, outs=1)
    init_insns = (
        insn_35c(0x70, 1, m_idx[("Landroid/app/Activity;", "<init>", ("V", ()))], [0])
        + [0x000E]  # return-void
    )

    # 2. Code for MainActivity.onBackPressed()V (registers=3, ins=1, outs=1)
    onback_insns = (
        [
            0x54 | ((0 | (2 << 4)) << 8),
            f_webview,
            0x38 | (0 << 8),
            0x000C,
        ]
        + insn_35c(0x6E, 1, m_idx[("Landroid/webkit/WebView;", "canGoBack", ("Z", ()))], [0])
        + [
            0x0A | (1 << 8),
            0x38 | (1 << 8),
            0x0006,
        ]
        + insn_35c(0x6E, 1, m_idx[("Landroid/webkit/WebView;", "goBack", ("V", ()))], [0])
        + [0x000E]
        + insn_35c(0x6F, 1, m_idx[("Landroid/app/Activity;", "onBackPressed", ("V", ()))], [2])
        + [0x000E]
    )

    # 3. Code for MainActivity.onCreate(Bundle)V (registers=6, ins=2, outs=2)
    oncreate_insns = (
        insn_35c(
            0x6F,
            2,
            m_idx[("Landroid/app/Activity;", "onCreate", ("V", ("Landroid/os/Bundle;",)))],
            [4, 5],
        )
        + [
            0x12 | ((0 | (1 << 4)) << 8),
            0x22 | (1 << 8),
            t_idx["Landroid/webkit/WebView;"],
        ]
        + insn_35c(
            0x70,
            2,
            m_idx[("Landroid/webkit/WebView;", "<init>", ("V", ("Landroid/content/Context;",)))],
            [1, 4],
        )
        + [
            0x5B | ((1 | (4 << 4)) << 8),
            f_webview,
        ]
        + insn_35c(
            0x6E,
            1,
            m_idx[("Landroid/webkit/WebView;", "getSettings", ("Landroid/webkit/WebSettings;", ()))],
            [1],
        )
        + [
            0x0C | (2 << 8),
        ]
        + insn_35c(
            0x6E,
            2,
            m_idx[("Landroid/webkit/WebSettings;", "setJavaScriptEnabled", ("V", ("Z",)))],
            [2, 0],
        )
        + insn_35c(
            0x6E,
            2,
            m_idx[("Landroid/webkit/WebSettings;", "setDomStorageEnabled", ("V", ("Z",)))],
            [2, 0],
        )
        + insn_35c(
            0x6E,
            2,
            m_idx[("Landroid/webkit/WebSettings;", "setDatabaseEnabled", ("V", ("Z",)))],
            [2, 0],
        )
        + insn_35c(
            0x6E,
            2,
            m_idx[("Landroid/webkit/WebSettings;", "setAllowFileAccess", ("V", ("Z",)))],
            [2, 0],
        )
        + insn_35c(
            0x6E,
            2,
            m_idx[("Landroid/webkit/WebSettings;", "setAllowContentAccess", ("V", ("Z",)))],
            [2, 0],
        )
        + insn_35c(
            0x6E,
            2,
            m_idx[("Landroid/webkit/WebSettings;", "setAllowFileAccessFromFileURLs", ("V", ("Z",)))],
            [2, 0],
        )
        + insn_35c(
            0x6E,
            2,
            m_idx[
                (
                    "Landroid/webkit/WebSettings;",
                    "setAllowUniversalAccessFromFileURLs",
                    ("V", ("Z",)),
                )
            ],
            [2, 0],
        )
        + insn_35c(
            0x6E,
            2,
            m_idx[("Landroid/webkit/WebSettings;", "setLoadWithOverviewMode", ("V", ("Z",)))],
            [2, 0],
        )
        + insn_35c(
            0x6E,
            2,
            m_idx[("Landroid/webkit/WebSettings;", "setUseWideViewPort", ("V", ("Z",)))],
            [2, 0],
        )
        + [
            0x22 | (3 << 8),
            t_idx["Landroid/webkit/WebViewClient;"],
        ]
        + insn_35c(
            0x70,
            1,
            m_idx[("Landroid/webkit/WebViewClient;", "<init>", ("V", ()))],
            [3],
        )
        + insn_35c(
            0x6E,
            2,
            m_idx[
                (
                    "Landroid/webkit/WebView;",
                    "setWebViewClient",
                    ("V", ("Landroid/webkit/WebViewClient;",)),
                )
            ],
            [1, 3],
        )
        + [
            # new-instance v3, L.../MainChromeClient;
            0x22 | (3 << 8),
            t_idx[cls_chrome],
        ]
        + insn_35c(
            0x70,
            2,
            m_idx[
                (
                    cls_chrome,
                    "<init>",
                    ("V", (cls_main,)),
                )
            ],
            [3, 4],
        )
        + insn_35c(
            0x6E,
            2,
            m_idx[
                (
                    "Landroid/webkit/WebView;",
                    "setWebChromeClient",
                    ("V", ("Landroid/webkit/WebChromeClient;",)),
                )
            ],
            [1, 3],
        )
        + insn_35c(
            0x6E,
            2,
            m_idx[("Landroid/app/Activity;", "setContentView", ("V", ("Landroid/view/View;",)))],
            [4, 1],
        )
        + [
            0x1A | (3 << 8),
            s_idx["file:///android_asset/www/index.html"],
        ]
        + insn_35c(
            0x6E,
            2,
            m_idx[("Landroid/webkit/WebView;", "loadUrl", ("V", ("Ljava/lang/String;",)))],
            [1, 3],
        )
        + [0x000E]  # return-void
    )

    # 4. Code for MainActivity.onActivityResult(IILandroid/content/Intent;)V (registers=7, ins=4, outs=4)
    # v0, v1, v2 = locals; v3 = p0 (this), v4 = p1 (requestCode), v5 = p2 (resultCode), v6 = p3 (Intent data)
    onactres_insns = (
        insn_35c(
            0x6F,
            4,
            m_idx[
                (
                    "Landroid/app/Activity;",
                    "onActivityResult",
                    ("V", ("I", "I", "Landroid/content/Intent;")),
                )
            ],
            [3, 4, 5, 6],
        )
        + [
            # 3..4: const/16 v0, 1001
            0x13 | (0 << 8),
            1001,
            # 5..6: if-ne v4, v0, +17 (jumps to offset 22)
            0x33 | ((4 | (0 << 4)) << 8),
            17,
            # 7..8: iget-object v0, v3, MainActivity->filePathCallback
            0x54 | ((0 | (3 << 4)) << 8),
            f_filecb,
            # 9..10: if-eqz v0, +12 (jumps to offset 21)
            0x38 | (0 << 8),
            12,
        ]
        # 11..13: invoke-static {v5, v6}, WebChromeClient$FileChooserParams.parseResult
        + insn_35c(
            0x71,
            2,
            m_idx[
                (
                    "Landroid/webkit/WebChromeClient$FileChooserParams;",
                    "parseResult",
                    ("[Landroid/net/Uri;", ("I", "Landroid/content/Intent;")),
                )
            ],
            [5, 6],
        )
        + [
            # 14: move-result-object v1
            0x0C | (1 << 8),
        ]
        # 15..17: invoke-interface {v0, v1}, ValueCallback.onReceiveValue
        + insn_35c(
            0x72,
            2,
            m_idx[("Landroid/webkit/ValueCallback;", "onReceiveValue", ("V", ("Ljava/lang/Object;",)))],
            [0, 1],
        )
        + [
            # 18: const/4 v1, 0
            0x12 | ((1 | (0 << 4)) << 8),
            # 19..20: iput-object v1, v3, MainActivity->filePathCallback
            0x5B | ((1 | (3 << 4)) << 8),
            f_filecb,
            # 21: return-void
            0x000E,
            # 22..23: const/16 v0, 1002
            0x13 | (0 << 8),
            1002,
            # 24..25: if-eq v4, v0, +3 (jumps to offset 27 if requestCode == 1002)
            0x32 | ((4 | (0 << 4)) << 8),
            3,
            # 26: return-void (early exit when requestCode != 1002 so v0 is never int at offset 58)
            0x000E,
            # 27..28: iget-object v0, v3, MainActivity->pendingSaveBytes
            0x54 | ((0 | (3 << 4)) << 8),
            f_pending,
            # 29: const/4 v1, 0
            0x12 | ((1 | (0 << 4)) << 8),
            # 30..31: iput-object v1, v3, MainActivity->pendingSaveBytes
            0x5B | ((1 | (3 << 4)) << 8),
            f_pending,
            # 32..33: if-eqz v0, +26 (jumps to offset 58)
            0x38 | (0 << 8),
            26,
            # 34..35: if-eqz v6, +24 (jumps to offset 58)
            0x38 | (6 << 8),
            24,
        ]
        # 36..38: invoke-virtual {v6}, Intent.getData
        + insn_35c(0x6E, 1, m_idx[("Landroid/content/Intent;", "getData", ("Landroid/net/Uri;", ()))], [6])
        + [
            # 39: move-result-object v1
            0x0C | (1 << 8),
            # 40..41: if-eqz v1, +18 (jumps to offset 58)
            0x38 | (1 << 8),
            18,
        ]
        # 42..44: invoke-virtual {v3}, Activity.getContentResolver
        + insn_35c(
            0x6E,
            1,
            m_idx[("Landroid/app/Activity;", "getContentResolver", ("Landroid/content/ContentResolver;", ()))],
            [3],
        )
        + [
            # 45: move-result-object v2
            0x0C | (2 << 8),
        ]
        # 46..48: invoke-virtual {v2, v1}, ContentResolver.openOutputStream
        + insn_35c(
            0x6E,
            2,
            m_idx[
                (
                    "Landroid/content/ContentResolver;",
                    "openOutputStream",
                    ("Ljava/io/OutputStream;", ("Landroid/net/Uri;",)),
                )
            ],
            [2, 1],
        )
        + [
            # 49: move-result-object v2
            0x0C | (2 << 8),
            # 50..51: if-eqz v2, +8 (jumps to offset 58)
            0x38 | (2 << 8),
            8,
        ]
        # 52..54: invoke-virtual {v2, v0}, OutputStream.write([B)V
        + insn_35c(0x6E, 2, m_idx[("Ljava/io/OutputStream;", "write", ("V", ("[B",)))], [2, 0])
        # 55..57: invoke-virtual {v2}, OutputStream.close()V
        + insn_35c(0x6E, 1, m_idx[("Ljava/io/OutputStream;", "close", ("V", ()))], [2])
        + [
            # 58: return-void
            0x000E
        ]
    )

    # 5. Code for MainActivity$ChromeClient.<init>(MainActivity)V (registers=2, ins=2, outs=1)
    cc_init_insns = (
        insn_35c(0x70, 1, m_idx[("Landroid/webkit/WebChromeClient;", "<init>", ("V", ()))], [0])
        + [
            0x5B | ((1 | (0 << 4)) << 8),
            f_act,
            0x000E,
        ]
    )

    # 6. Code for MainActivity$ChromeClient.onShowFileChooser (registers=7, ins=4, outs=3)
    # v0, v1, v2 = locals; v3 = p0 (this), v4 = p1 (WebView), v5 = p2 (ValueCallback), v6 = p3 (FileChooserParams)
    cc_filechooser_insns = (
        [
            # 0..1: iget-object v0, v3, ChromeClient->act
            0x54 | ((0 | (3 << 4)) << 8),
            f_act,
            # 2..3: iget-object v1, v0, MainActivity->filePathCallback
            0x54 | ((1 | (0 << 4)) << 8),
            f_filecb,
            # 4..5: if-eqz v1, +6 (jumps to offset 10)
            0x38 | (1 << 8),
            6,
            # 6: const/4 v2, 0
            0x12 | ((2 | (0 << 4)) << 8),
        ]
        # 7..9: invoke-interface {v1, v2}, ValueCallback.onReceiveValue
        + insn_35c(
            0x72,
            2,
            m_idx[("Landroid/webkit/ValueCallback;", "onReceiveValue", ("V", ("Ljava/lang/Object;",)))],
            [1, 2],
        )
        + [
            # 10..11: iput-object v5, v0, MainActivity->filePathCallback
            0x5B | ((5 | (0 << 4)) << 8),
            f_filecb,
            # 12..13: new-instance v1, Landroid/content/Intent;
            0x22 | (1 << 8),
            t_idx["Landroid/content/Intent;"],
            # 14..15: const-string v2, "android.intent.action.GET_CONTENT"
            0x1A | (2 << 8),
            s_idx["android.intent.action.GET_CONTENT"],
        ]
        # 16..18: invoke-direct {v1, v2}, Intent.<init>(String)
        + insn_35c(
            0x70,
            2,
            m_idx[("Landroid/content/Intent;", "<init>", ("V", ("Ljava/lang/String;",)))],
            [1, 2],
        )
        + [
            # 19..20: const-string v2, "android.intent.category.OPENABLE"
            0x1A | (2 << 8),
            s_idx["android.intent.category.OPENABLE"],
        ]
        # 21..23: invoke-virtual {v1, v2}, Intent.addCategory
        + insn_35c(
            0x6E,
            2,
            m_idx[
                (
                    "Landroid/content/Intent;",
                    "addCategory",
                    ("Landroid/content/Intent;", ("Ljava/lang/String;",)),
                )
            ],
            [1, 2],
        )
        + [
            # 24..25: const-string v2, "*/*"
            0x1A | (2 << 8),
            s_idx["*/*"],
        ]
        # 26..28: invoke-virtual {v1, v2}, Intent.setType
        + insn_35c(
            0x6E,
            2,
            m_idx[
                (
                    "Landroid/content/Intent;",
                    "setType",
                    ("Landroid/content/Intent;", ("Ljava/lang/String;",)),
                )
            ],
            [1, 2],
        )
        + [
            # 29..30: const/16 v2, 1001
            0x13 | (2 << 8),
            1001,
        ]
        # 31..33: invoke-virtual {v0, v1, v2}, Activity.startActivityForResult
        + insn_35c(
            0x6E,
            3,
            m_idx[
                (
                    "Landroid/app/Activity;",
                    "startActivityForResult",
                    ("V", ("Landroid/content/Intent;", "I")),
                )
            ],
            [0, 1, 2],
        )
        + [
            # 34: const/4 v0, 1
            0x12 | ((0 | (1 << 4)) << 8),
            # 35: return v0
            0x0F | (0 << 8),
        ]
    )

    # 7. Code for MainActivity$ChromeClient.onJsPrompt (registers=9, ins=6, outs=3)
    # v0, v1, v2 = locals; v3 = p0 (this), v4 = p1 (WebView), v5 = p2 (url), v6 = p3 (message=fileName), v7 = p4 (defaultValue=base64), v8 = p5 (JsPromptResult)
    cc_jsprompt_insns = (
        [
            # 0..1: if-nez v7, +4 (jumps to offset 4)
            0x39 | (7 << 8),
            4,
            # 2: const/4 v0, 0
            0x12 | ((0 | (0 << 4)) << 8),
            # 3: return v0
            0x0F | (0 << 8),
            # 4..5: iget-object v0, v3, ChromeClient->act
            0x54 | ((0 | (3 << 4)) << 8),
            f_act,
            # 6: const/4 v1, 0
            0x12 | ((1 | (0 << 4)) << 8),
        ]
        # 7..9: invoke-static {v7, v1}, Base64.decode(String, int)
        + insn_35c(
            0x71,
            2,
            m_idx[("Landroid/util/Base64;", "decode", ("[B", ("Ljava/lang/String;", "I")))],
            [7, 1],
        )
        + [
            # 10: move-result-object v1
            0x0C | (1 << 8),
            # 11..12: iput-object v1, v0, MainActivity->pendingSaveBytes
            0x5B | ((1 | (0 << 4)) << 8),
            f_pending,
            # 13..14: new-instance v1, Landroid/content/Intent;
            0x22 | (1 << 8),
            t_idx["Landroid/content/Intent;"],
            # 15..16: const-string v2, "android.intent.action.CREATE_DOCUMENT"
            0x1A | (2 << 8),
            s_idx["android.intent.action.CREATE_DOCUMENT"],
        ]
        # 17..19: invoke-direct {v1, v2}, Intent.<init>(String)
        + insn_35c(
            0x70,
            2,
            m_idx[("Landroid/content/Intent;", "<init>", ("V", ("Ljava/lang/String;",)))],
            [1, 2],
        )
        + [
            # 20..21: const-string v2, "android.intent.category.OPENABLE"
            0x1A | (2 << 8),
            s_idx["android.intent.category.OPENABLE"],
        ]
        # 22..24: invoke-virtual {v1, v2}, Intent.addCategory
        + insn_35c(
            0x6E,
            2,
            m_idx[
                (
                    "Landroid/content/Intent;",
                    "addCategory",
                    ("Landroid/content/Intent;", ("Ljava/lang/String;",)),
                )
            ],
            [1, 2],
        )
        + [
            # 25..26: const-string v2, "*/*"
            0x1A | (2 << 8),
            s_idx["*/*"],
        ]
        # 27..29: invoke-virtual {v1, v2}, Intent.setType
        + insn_35c(
            0x6E,
            2,
            m_idx[
                (
                    "Landroid/content/Intent;",
                    "setType",
                    ("Landroid/content/Intent;", ("Ljava/lang/String;",)),
                )
            ],
            [1, 2],
        )
        + [
            # 30..31: const-string v2, "android.intent.extra.TITLE"
            0x1A | (2 << 8),
            s_idx["android.intent.extra.TITLE"],
        ]
        # 32..34: invoke-virtual {v1, v2, v6}, Intent.putExtra(String, String)
        + insn_35c(
            0x6E,
            3,
            m_idx[
                (
                    "Landroid/content/Intent;",
                    "putExtra",
                    ("Landroid/content/Intent;", ("Ljava/lang/String;", "Ljava/lang/String;")),
                )
            ],
            [1, 2, 6],
        )
        + [
            # 35..36: const/16 v2, 1002
            0x13 | (2 << 8),
            1002,
        ]
        # 37..39: invoke-virtual {v0, v1, v2}, Activity.startActivityForResult
        + insn_35c(
            0x6E,
            3,
            m_idx[
                (
                    "Landroid/app/Activity;",
                    "startActivityForResult",
                    ("V", ("Landroid/content/Intent;", "I")),
                )
            ],
            [0, 1, 2],
        )
        + [
            # 40..41: const-string v2, "OK"
            0x1A | (2 << 8),
            s_idx["OK"],
        ]
        # 42..44: invoke-virtual {v8, v2}, JsPromptResult.confirm(String)
        + insn_35c(
            0x6E,
            2,
            m_idx[("Landroid/webkit/JsPromptResult;", "confirm", ("V", ("Ljava/lang/String;",)))],
            [8, 2],
        )
        + [
            # 45: const/4 v0, 1
            0x12 | ((0 | (1 << 4)) << 8),
            # 46: return v0
            0x0F | (0 << 8),
        ]
    )

    def pack_code_item(regs: int, ins: int, outs: int, insns: list) -> bytes:
        padded_insns = list(insns)
        if len(padded_insns) % 2 != 0:
            padded_insns.append(0x0000)  # Dalvik nop so 16 + len*2 is always a multiple of 4
        return struct.pack("<HHHHII", regs, ins, outs, 0, 0, len(padded_insns)) + b"".join(
            struct.pack("<H", w) for w in padded_insns
        )

    # Calculate section offsets (2 class_defs: 2 * 32 = 64 bytes)
    header_off = 0
    string_ids_off = 112
    type_ids_off = string_ids_off + len(strings) * 4
    proto_ids_off = type_ids_off + len(type_descriptors) * 4
    field_ids_off = proto_ids_off + len(protos) * 12
    method_ids_off = field_ids_off + len(fields) * 8
    class_defs_off = method_ids_off + len(methods) * 8
    data_off = class_defs_off + 64

    data_buf = bytearray()

    def align4():
        while len(data_buf) % 4 != 0:
            data_buf.append(0)

    # 1. Type lists for protos with parameters
    type_list_off = data_off + len(data_buf)
    proto_param_offs = []
    unique_param_tuples = []
    param_tuple_to_off = {}
    for _, _, params in protos:
        if not params:
            proto_param_offs.append(0)
        else:
            if params not in param_tuple_to_off:
                align4()
                off = data_off + len(data_buf)
                param_tuple_to_off[params] = off
                unique_param_tuples.append(params)
                data_buf.extend(struct.pack("<I", len(params)))
                for p in params:
                    data_buf.extend(struct.pack("<H", t_idx[p]))
            proto_param_offs.append(param_tuple_to_off[params])

    # 2. Code items (4-byte aligned, 7 methods total, in exact class_data_item method order)
    align4()
    code_items_off = data_off + len(data_buf)
    code_init_off = data_off + len(data_buf)
    data_buf.extend(pack_code_item(1, 1, 1, init_insns))

    code_onactres_off = data_off + len(data_buf)
    data_buf.extend(pack_code_item(7, 4, 4, onactres_insns))

    code_onback_off = data_off + len(data_buf)
    data_buf.extend(pack_code_item(3, 1, 1, onback_insns))

    code_oncreate_off = data_off + len(data_buf)
    data_buf.extend(pack_code_item(6, 2, 2, oncreate_insns))

    code_cc_init_off = data_off + len(data_buf)
    data_buf.extend(pack_code_item(2, 2, 1, cc_init_insns))

    code_cc_jsprompt_off = data_off + len(data_buf)
    data_buf.extend(pack_code_item(9, 6, 3, cc_jsprompt_insns))

    code_cc_filechooser_off = data_off + len(data_buf)
    data_buf.extend(pack_code_item(7, 4, 3, cc_filechooser_insns))

    # 3. String data items
    string_data_off = data_off + len(data_buf)
    string_data_offs = []
    for s in strings:
        string_data_offs.append(data_off + len(data_buf))
        utf8_bytes = s.encode("utf-8")
        data_buf.extend(uleb128(len(s)))
        data_buf.extend(utf8_bytes)
        data_buf.append(0)

    # 4. Class data items (2 classes: MainActivity and MainChromeClient)
    class_data_off = data_off + len(data_buf)
    m_init = m_idx[(cls_main, "<init>", ("V", ()))]
    m_onactres = m_idx[
        (
            cls_main,
            "onActivityResult",
            ("V", ("I", "I", "Landroid/content/Intent;")),
        )
    ]
    m_onback = m_idx[(cls_main, "onBackPressed", ("V", ()))]
    m_oncreate = m_idx[
        (
            cls_main,
            "onCreate",
            ("V", ("Landroid/os/Bundle;",)),
        )
    ]

    virtual_methods_sorted = sorted(
        [
            (m_onactres, 0x0004, code_onactres_off),  # ACC_PROTECTED
            (m_onback, 0x0001, code_onback_off),      # ACC_PUBLIC
            (m_oncreate, 0x0004, code_oncreate_off),  # ACC_PROTECTED
        ],
        key=lambda x: x[0],
    )

    main_fields_sorted = sorted([f_filecb, f_pending, f_webview])

    class_data_main = bytearray()
    class_data_main.extend(uleb128(0))  # static_fields_size
    class_data_main.extend(uleb128(len(main_fields_sorted)))  # instance_fields_size
    class_data_main.extend(uleb128(1))  # direct_methods_size
    class_data_main.extend(uleb128(len(virtual_methods_sorted)))  # virtual_methods_size

    prev_f = 0
    for fid in main_fields_sorted:
        class_data_main.extend(uleb128(fid - prev_f))
        class_data_main.extend(uleb128(0x0001))  # ACC_PUBLIC
        prev_f = fid

    # direct method 0 (<init>)
    class_data_main.extend(uleb128(m_init))
    class_data_main.extend(uleb128(0x10001))  # ACC_PUBLIC | ACC_CONSTRUCTOR
    class_data_main.extend(uleb128(code_init_off))

    # virtual methods
    prev_m = 0
    for mid, acc, coff in virtual_methods_sorted:
        class_data_main.extend(uleb128(mid - prev_m))
        class_data_main.extend(uleb128(acc))
        class_data_main.extend(uleb128(coff))
        prev_m = mid

    data_buf.extend(class_data_main)

    # Class data for MainChromeClient
    class_data_cc_off = data_off + len(data_buf)
    m_cc_init = m_idx[
        (
            cls_chrome,
            "<init>",
            ("V", (cls_main,)),
        )
    ]
    m_cc_filechooser = m_idx[
        (
            cls_chrome,
            "onShowFileChooser",
            (
                "Z",
                (
                    "Landroid/webkit/WebView;",
                    "Landroid/webkit/ValueCallback;",
                    "Landroid/webkit/WebChromeClient$FileChooserParams;",
                ),
            ),
        )
    ]
    m_cc_jsprompt = m_idx[
        (
            cls_chrome,
            "onJsPrompt",
            (
                "Z",
                (
                    "Landroid/webkit/WebView;",
                    "Ljava/lang/String;",
                    "Ljava/lang/String;",
                    "Ljava/lang/String;",
                    "Landroid/webkit/JsPromptResult;",
                ),
            ),
        )
    ]

    cc_virtual_sorted = sorted(
        [
            (m_cc_filechooser, 0x0001, code_cc_filechooser_off),
            (m_cc_jsprompt, 0x0001, code_cc_jsprompt_off),
        ],
        key=lambda x: x[0],
    )

    class_data_cc = bytearray()
    class_data_cc.extend(uleb128(0))  # static_fields_size
    class_data_cc.extend(uleb128(1))  # instance_fields_size (act)
    class_data_cc.extend(uleb128(1))  # direct_methods_size (<init>)
    class_data_cc.extend(uleb128(len(cc_virtual_sorted)))  # virtual_methods_size

    class_data_cc.extend(uleb128(f_act))
    class_data_cc.extend(uleb128(0x0001))  # ACC_PUBLIC

    class_data_cc.extend(uleb128(m_cc_init))
    class_data_cc.extend(uleb128(0x10001))  # ACC_PUBLIC | ACC_CONSTRUCTOR
    class_data_cc.extend(uleb128(code_cc_init_off))

    prev_cc_m = 0
    for mid, acc, coff in cc_virtual_sorted:
        class_data_cc.extend(uleb128(mid - prev_cc_m))
        class_data_cc.extend(uleb128(acc))
        class_data_cc.extend(uleb128(coff))
        prev_cc_m = mid

    data_buf.extend(class_data_cc)

    # 5. Map list (4-byte aligned)
    align4()
    map_off = data_off + len(data_buf)
    map_items = [
        (0x0000, 1, header_off),
        (0x0001, len(strings), string_ids_off),
        (0x0002, len(type_descriptors), type_ids_off),
        (0x0003, len(protos), proto_ids_off),
        (0x0004, len(fields), field_ids_off),
        (0x0005, len(methods), method_ids_off),
        (0x0006, 2, class_defs_off),
        (0x1001, len(unique_param_tuples), type_list_off),
        (0x2001, 7, code_items_off),
        (0x2002, len(strings), string_data_off),
        (0x2000, 2, class_data_off),
        (0x1000, 1, map_off),
    ]
    data_buf.extend(struct.pack("<I", len(map_items)))
    for m_type, m_count, m_offset in map_items:
        data_buf.extend(struct.pack("<HHII", m_type, 0, m_count, m_offset))

    # Assemble fixed tables
    string_ids_bytes = b"".join(struct.pack("<I", o) for o in string_data_offs)
    type_ids_bytes = b"".join(struct.pack("<I", s_idx[d]) for d in type_descriptors)
    proto_ids_bytes = b"".join(
        struct.pack("<III", s_idx[p[0]], t_idx[p[1]], proto_param_offs[i])
        for i, p in enumerate(protos)
    )
    field_ids_bytes = b"".join(
        struct.pack("<HHI", t_idx[f[0]], t_idx[f[1]], s_idx[f[2]]) for f in fields
    )
    method_ids_bytes = b"".join(
        struct.pack("<HHI", t_idx[m[0]], p_idx[m[2]], s_idx[m[1]]) for m in methods
    )
    class_defs_bytes = struct.pack(
        "<IIIIIIII",
        t_idx[cls_main],
        0x0001,  # ACC_PUBLIC
        t_idx["Landroid/app/Activity;"],
        0,
        0xFFFFFFFF,
        0,
        class_data_off,
        0,
    ) + struct.pack(
        "<IIIIIIII",
        t_idx[cls_chrome],
        0x0001,  # ACC_PUBLIC
        t_idx["Landroid/webkit/WebChromeClient;"],
        0,
        0xFFFFFFFF,
        0,
        class_data_cc_off,
        0,
    )

    data_size = len(data_buf)
    file_size = data_off + data_size

    header_tail = struct.pack(
        "<IIIIIIIIIIIIIIIIIIII",
        file_size,
        112,
        0x12345678,
        0,
        0,
        map_off,
        len(strings),
        string_ids_off,
        len(type_descriptors),
        type_ids_off,
        len(protos),
        proto_ids_off,
        len(fields),
        field_ids_off,
        len(methods),
        method_ids_off,
        2,
        class_defs_off,
        data_size,
        data_off,
    )

    body_after_sig = (
        header_tail
        + string_ids_bytes
        + type_ids_bytes
        + proto_ids_bytes
        + field_ids_bytes
        + method_ids_bytes
        + class_defs_bytes
        + bytes(data_buf)
    )

    sha1_digest = hashlib.sha1(body_after_sig).digest()
    adler_val = zlib.adler32(sha1_digest + body_after_sig) & 0xFFFFFFFF

    dex_out = b"dex\n035\x00" + struct.pack("<I", adler_val) + sha1_digest + body_after_sig
    verify_dex_strict(dex_out)
    return dex_out


def compute_apk_v2_chunk_digest(chunks: list) -> bytes:
    """
    Computes the APK Signature Scheme v2 SHA-256 merkle tree digest over 1MB chunks
    of the 3 ZIP sections (Before CD, Central Directory, End of Central Directory).
    """
    CHUNK_SIZE = 1024 * 1024
    level_hashes = []
    for section in chunks:
        pos = 0
        n = len(section)
        while pos < n:
            piece = section[pos : pos + CHUNK_SIZE]
            h = hashlib.sha256(b"\xa5" + struct.pack("<I", len(piece)) + piece).digest()
            level_hashes.append(h)
            pos += CHUNK_SIZE

    top_input = b"\x5a" + struct.pack("<I", len(level_hashes)) + b"".join(level_hashes)
    return hashlib.sha256(top_input).digest()


def lp_bytes(data: bytes) -> bytes:
    return struct.pack("<I", len(data)) + data


def build_apk_v2_signing_block(
    before_cd: bytes, cd: bytes, eocd: bytes, key_pem_path: str, cert_der: bytes
) -> bytes:
    """
    Builds the official Android APK Signature Scheme v2 Block ('APK Sig Block 42',
    ID 0x7109871a) signed with RSA-PKCS1-v1.5-SHA256 (0x0103).
    """
    # EOCD offset of Central Directory (bytes 16..20 of EOCD) must point to before_cd length
    # during digest computation per APK Signature Scheme v2 specification.
    eocd_for_digest = bytearray(eocd)
    struct.pack_into("<I", eocd_for_digest, 16, len(before_cd))

    top_digest = compute_apk_v2_chunk_digest([before_cd, cd, bytes(eocd_for_digest)])

    # Signature algorithm ID: 0x0103 = RSA_PKCS1_V1_5_WITH_SHA256
    ALG_RSA_PKCS1_SHA256 = 0x0103

    digest_entry = lp_bytes(struct.pack("<I", ALG_RSA_PKCS1_SHA256) + lp_bytes(top_digest))
    digests_seq = lp_bytes(digest_entry)
    certs_seq = lp_bytes(lp_bytes(cert_der))
    additional_attrs = lp_bytes(b"")

    signed_data = digests_seq + certs_seq + additional_attrs

    # Sign signed_data with RSA-SHA256 via openssl dgst -sha256 -sign
    proc = subprocess.run(
        ["openssl", "dgst", "-sha256", "-sign", key_pem_path],
        input=signed_data,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    signature_bytes = proc.stdout

    # Public key SubjectPublicKeyInfo DER from certificate
    pub_proc = subprocess.run(
        ["openssl", "pkey", "-in", key_pem_path, "-pubout", "-outform", "DER"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    spki_der = pub_proc.stdout

    sig_entry = lp_bytes(struct.pack("<I", ALG_RSA_PKCS1_SHA256) + lp_bytes(signature_bytes))
    signatures_seq = lp_bytes(sig_entry)

    signer = lp_bytes(lp_bytes(signed_data) + signatures_seq + lp_bytes(spki_der))
    signers_block = lp_bytes(signer)

    # ID-value pair: uint64 len, uint32 id (0x7109871a), value (signers_block)
    pair_payload = struct.pack("<I", 0x7109871A) + signers_block
    id_value_pair = struct.pack("<Q", len(pair_payload)) + pair_payload

    # Pad block so total APK Signing Block is a multiple of 4096 bytes (optional, clean)
    block_of_pairs = id_value_pair
    size_of_block = len(block_of_pairs) + 8 + 16  # 8-byte trailing size + 16-byte magic
    return (
        struct.pack("<Q", size_of_block)
        + block_of_pairs
        + struct.pack("<Q", size_of_block)
        + b"APK Sig Block 42"
    )


def inject_apk_v2_signature(apk_path: str, key_pem_path: str, cert_der: bytes) -> None:
    raw = open(apk_path, "rb").read()
    # Locate End of Central Directory (0x06054b50)
    eocd_pos = raw.rfind(b"PK\x05\x06")
    if eocd_pos < 0:
        raise RuntimeError("Invalid ZIP/APK: EOCD not found")

    cd_size = struct.unpack_from("<I", raw, eocd_pos + 12)[0]
    cd_offset = struct.unpack_from("<I", raw, eocd_pos + 16)[0]

    before_cd = raw[:cd_offset]
    cd = raw[cd_offset:eocd_pos]
    eocd = bytearray(raw[eocd_pos:])

    v2_block = build_apk_v2_signing_block(before_cd, cd, bytes(eocd), key_pem_path, cert_der)

    new_cd_offset = len(before_cd) + len(v2_block)
    struct.pack_into("<I", eocd, 16, new_cd_offset)

    with open(apk_path, "wb") as f:
        f.write(before_cd)
        f.write(v2_block)
        f.write(cd)
        f.write(eocd)


def main():
    if len(sys.argv) < 3:
        print("Usage: compile-standalone-apk.py <www_assets_dir> <output_apk_path>")
        sys.exit(1)

    www_dir = sys.argv[1]
    out_apk = sys.argv[2]
    pkg_name_arg = sys.argv[3] if len(sys.argv) > 3 else "com.eswa.tunnelmapper.user"
    app_label_arg = sys.argv[4] if len(sys.argv) > 4 else "ESWA Tunnel Mapper"
    os.makedirs(os.path.dirname(os.path.abspath(out_apk)), exist_ok=True)

    key_dir = "/tmp/akash-release-cache/keystore"
    os.makedirs(key_dir, exist_ok=True)
    key_pem = os.path.join(key_dir, "eswa-release-key.pem")
    cert_pem = os.path.join(key_dir, "eswa-release-cert.pem")
    cert_der_path = os.path.join(key_dir, "eswa-release-cert.der")

    if not os.path.exists(key_pem) or not os.path.exists(cert_pem):
        subprocess.run(
            [
                "openssl",
                "req",
                "-x509",
                "-newkey",
                "rsa:2048",
                "-nodes",
                "-keyout",
                key_pem,
                "-out",
                cert_pem,
                "-days",
                "10000",
                "-subj",
                "/CN=ESWA Tunnel Mapper/OU=Engineering/O=ESWA/L=Chennai/ST=TN/C=IN",
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    subprocess.run(
        ["openssl", "x509", "-in", cert_pem, "-outform", "DER", "-out", cert_der_path],
        check=True,
    )
    cert_der = open(cert_der_path, "rb").read()

    axml_bytes = build_binary_axml(pkg_name_arg, app_label_arg)
    arsc_bytes = build_resources_arsc(pkg_name_arg)
    dex_bytes = build_classes_dex(pkg_name_arg)

    # Collect all entries to place into the APK
    # Put resources.arsc and classes.dex with ZIP_STORED (4-byte aligned) for direct ART mmap
    entries = [
        ("resources.arsc", arsc_bytes, zipfile.ZIP_STORED),
        ("AndroidManifest.xml", axml_bytes, zipfile.ZIP_DEFLATED),
        ("classes.dex", dex_bytes, zipfile.ZIP_STORED),
    ]

    # Include high-resolution ESWA Tunnel Mapper launcher icons across all Android densities
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for icon_rel, arc_icon in [
        ("public/icons/icon-192x192.png", "res/drawable/ic_launcher.png"),
        ("public/icons/icon-48x48.png", "res/drawable-mdpi/ic_launcher.png"),
        ("public/icons/icon-72x72.png", "res/drawable-hdpi/ic_launcher.png"),
        ("public/icons/icon-96x96.png", "res/drawable-xhdpi/ic_launcher.png"),
        ("public/icons/icon-144x144.png", "res/drawable-xxhdpi/ic_launcher.png"),
        ("public/icons/icon-192x192.png", "res/drawable-xxxhdpi/ic_launcher.png"),
    ]:
        icon_full = os.path.join(repo_root, icon_rel)
        if not os.path.exists(icon_full):
            icon_full = os.path.join("/tmp/akash-release-cache", icon_rel)
        if os.path.exists(icon_full):
            entries.append((arc_icon, open(icon_full, "rb").read(), zipfile.ZIP_STORED))

    # Store all bundled offline application assets in assets/www/ with ZIP_STORED (4-byte aligned)
    # so Android AssetManager can memory-map them directly without decompression overhead.
    for root, _, files in os.walk(www_dir):
        for fn in sorted(files):
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, www_dir).replace("\\", "/")
            arc_name = f"assets/www/{rel}"
            data = open(full, "rb").read()
            entries.append((arc_name, data, zipfile.ZIP_STORED))

    # Build JAR v1 META-INF/MANIFEST.MF, CERT.SF, CERT.RSA
    manifest_lines = [
        "Manifest-Version: 1.0",
        "Created-By: 1.0 (ESWA Android Packager)",
        "",
    ]
    sf_lines = [
        "Signature-Version: 1.0",
        "Created-By: 1.0 (ESWA Android Packager)",
    ]

    entry_blocks = []
    for arc_name, data, _ in entries:
        digest_b64 = base64.b64encode(hashlib.sha256(data).digest()).decode("ascii")
        block = f"Name: {arc_name}\r\nSHA-256-Digest: {digest_b64}\r\n\r\n"
        entry_blocks.append((arc_name, block))

    manifest_mf = ("\r\n".join(manifest_lines) + "".join(b for _, b in entry_blocks)).encode(
        "utf-8"
    )
    mf_digest_b64 = base64.b64encode(hashlib.sha256(manifest_mf).digest()).decode("ascii")
    sf_lines.append(f"SHA-256-Digest-Manifest: {mf_digest_b64}")
    sf_lines.append("")

    sf_entry_blocks = []
    for arc_name, block in entry_blocks:
        b_digest = base64.b64encode(hashlib.sha256(block.encode("utf-8")).digest()).decode("ascii")
        sf_entry_blocks.append(f"Name: {arc_name}\r\nSHA-256-Digest: {b_digest}\r\n\r\n")

    cert_sf = ("\r\n".join(sf_lines) + "".join(sf_entry_blocks)).encode("utf-8")

    # Sign CERT.SF into PKCS#7 DER (META-INF/CERT.RSA)
    cms_proc = subprocess.run(
        [
            "openssl",
            "cms",
            "-sign",
            "-binary",
            "-noattr",
            "-in",
            "/dev/stdin",
            "-signer",
            cert_pem,
            "-inkey",
            key_pem,
            "-outform",
            "DER",
            "-md",
            "sha256",
        ],
        input=cert_sf,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    cert_rsa = cms_proc.stdout

    # Write ZIP archive with 4-byte alignment (zipalign -p 4) for all ZIP_STORED entries
    with zipfile.ZipFile(out_apk, "w") as zf:
        for arc_name, data, comp in entries:
            zi = zipfile.ZipInfo(arc_name, date_time=(2026, 1, 1, 0, 0, 0))
            zi.compress_type = comp
            zi.external_attr = 0o644 << 16
            if comp == zipfile.ZIP_STORED:
                cur_off = zf.fp.tell()
                hdr_len = 30 + len(arc_name.encode("utf-8"))
                pad_len = (4 - ((cur_off + hdr_len) % 4)) % 4
                zi.extra = b"\x00" * pad_len
            zf.writestr(zi, data)

        for meta_name, meta_data in [
            ("META-INF/MANIFEST.MF", manifest_mf),
            ("META-INF/CERT.SF", cert_sf),
            ("META-INF/CERT.RSA", cert_rsa),
        ]:
            zi = zipfile.ZipInfo(meta_name, date_time=(2026, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            zf.writestr(zi, meta_data)

    # Inject APK Signature Scheme v2 ('APK Sig Block 42')
    inject_apk_v2_signature(out_apk, key_pem, cert_der)

    size_mb = os.path.getsize(out_apk) / (1024.0 * 1024.0)
    print(f"Compiled standalone signed Android APK: {out_apk} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
