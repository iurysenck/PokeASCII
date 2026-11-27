#include "pokemon_ar/tty/tty_presenter.hpp"

#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace pokemon_ar::tty {

FrameBufferTTY::FrameBufferTTY(u32 columns, u32 rows)
    : columns_(columns), rows_(rows), cells_(static_cast<std::size_t>(columns) * rows) {}

void FrameBufferTTY::resize(u32 columns, u32 rows) {
    columns_ = columns;
    rows_    = rows;
    cells_.resize(static_cast<std::size_t>(columns) * rows);
}

void FrameBufferTTY::clear(const Cell& clear_cell) noexcept {
    std::fill(cells_.begin(), cells_.end(), clear_cell);
}

AnsiSerializer::AnsiSerializer(u8 color_tolerance)
    : color_tolerance_(color_tolerance) {
    out_buffer_.reserve(128 * 1024);
}

void AnsiSerializer::append_str(const char* s, std::size_t len) {
    out_buffer_.insert(out_buffer_.end(), s, s + len);
}

void AnsiSerializer::append_u8_decimal(u8 val) {
    if (val >= 100) {
        out_buffer_.push_back(static_cast<char>('0' + (val / 100)));
        val %= 100;
        out_buffer_.push_back(static_cast<char>('0' + (val / 10)));
        out_buffer_.push_back(static_cast<char>('0' + (val % 10)));
    } else if (val >= 10) {
        out_buffer_.push_back(static_cast<char>('0' + (val / 10)));
        out_buffer_.push_back(static_cast<char>('0' + (val % 10)));
    } else {
        out_buffer_.push_back(static_cast<char>('0' + val));
    }
}

void AnsiSerializer::append_utf8(u32 cp) {
    if (cp < 0x80u) {
        const char ch = (cp >= 0x20u && cp != 0x7Fu) ? static_cast<char>(cp) : ' ';
        out_buffer_.push_back(ch);
    } else if (cp < 0x800u) {
        out_buffer_.push_back(static_cast<char>(0xC0u | (cp >> 6)));
        out_buffer_.push_back(static_cast<char>(0x80u | (cp & 0x3Fu)));
    } else if (cp < 0x10000u) {
        out_buffer_.push_back(static_cast<char>(0xE0u | (cp >> 12)));
        out_buffer_.push_back(static_cast<char>(0x80u | ((cp >> 6) & 0x3Fu)));
        out_buffer_.push_back(static_cast<char>(0x80u | (cp & 0x3Fu)));
    } else if (cp <= 0x10FFFFu) {
        out_buffer_.push_back(static_cast<char>(0xF0u | (cp >> 18)));
        out_buffer_.push_back(static_cast<char>(0x80u | ((cp >> 12) & 0x3Fu)));
        out_buffer_.push_back(static_cast<char>(0x80u | ((cp >> 6) & 0x3Fu)));
        out_buffer_.push_back(static_cast<char>(0x80u | (cp & 0x3Fu)));
    } else {
        out_buffer_.push_back('?');
    }
}

void AnsiSerializer::append_fg_color(ColorRGB c) {
    append_str("\x1b[38;2;", 7);
    append_u8_decimal(c.r);
    out_buffer_.push_back(';');
    append_u8_decimal(c.g);
    out_buffer_.push_back(';');
    append_u8_decimal(c.b);
    out_buffer_.push_back('m');
}

void AnsiSerializer::append_bg_color(ColorRGB c) {
    append_str("\x1b[48;2;", 7);
    append_u8_decimal(c.r);
    out_buffer_.push_back(';');
    append_u8_decimal(c.g);
    out_buffer_.push_back(';');
    append_u8_decimal(c.b);
    out_buffer_.push_back('m');
}

std::string_view AnsiSerializer::serialize(const FrameBufferTTY& fb,
                                           bool use_synchronized_output,
                                           EncoderStats* out_stats) {
    out_buffer_.clear();

    const u32 cols = fb.columns();
    const u32 rows = fb.rows();
    const std::size_t estimated = static_cast<std::size_t>(cols) * rows * 12 + 128;
    if (out_buffer_.capacity() < estimated) {
        out_buffer_.reserve(estimated);
    }

    EncoderStats stats{};
    stats.cells_processed = cols * rows;

    if (use_synchronized_output) {
        append_str("\x1b[?2026h", 8);
    }

    append_str("\x1b[H", 3);

    bool has_fg = false;
    bool has_bg = false;
    ColorRGB active_fg{};
    ColorRGB active_bg{};

    for (u32 r = 0; r < rows; ++r) {
        for (u32 c = 0; c < cols; ++c) {
            const Cell& cell = fb.at(c, r);

            if (!has_fg || !cell.fg.near_equals(active_fg, color_tolerance_)) {
                append_fg_color(cell.fg);
                active_fg = cell.fg;
                has_fg = true;
                ++stats.fg_color_changes;
            }

            if (!has_bg || !cell.bg.near_equals(active_bg, color_tolerance_)) {
                append_bg_color(cell.bg);
                active_bg = cell.bg;
                has_bg = true;
                ++stats.bg_color_changes;
            }

            append_utf8(cell.codepoint);
        }

        if (r + 1 < rows) {
            append_str("\r\n", 2);
        }
    }

    if (use_synchronized_output) {
        append_str("\x1b[?2026l", 8);
    }

    stats.bytes_emitted = out_buffer_.size();
    if (out_stats != nullptr) {
        *out_stats = stats;
    }

    return std::string_view(out_buffer_.data(), out_buffer_.size());
}

TerminalDevice::~TerminalDevice() {
    shutdown();
}

bool TerminalDevice::initialize(u32 target_cols, u32 target_rows) noexcept {
    if (initialized_) {
        return true;
    }

    std::setvbuf(stdout, nullptr, _IOFBF, 131072);

    if (target_cols > 0) {
        configured_cols_ = target_cols;
    }
    if (target_rows > 0) {
        configured_rows_ = target_rows;
    }

    char init_seq[96];
    int len = 0;
    if (target_cols > 0 && target_rows > 0) {
        len = std::snprintf(init_seq, sizeof(init_seq),
                            "\x1b[?1049h\x1b[?25l\x1b[8;%u;%ut\x1b[2J\x1b[H",
                            target_rows, target_cols);
    } else {
        len = std::snprintf(init_seq, sizeof(init_seq), "\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H");
    }

    initialized_ = true;
    if (len > 0) {
        flush(std::string_view(init_seq, static_cast<std::size_t>(len)));
    }
    return true;
}

void TerminalDevice::shutdown() noexcept {
    if (!initialized_) {
        return;
    }

    constexpr std::string_view restore_seq = "\x1b[0m\x1b[?25h\x1b[?1049l";
    flush(restore_seq);
    initialized_ = false;
}

TerminalMetrics TerminalDevice::query_metrics() const noexcept {
    TerminalMetrics m{};
    m.columns        = (configured_cols_ > 0) ? configured_cols_ : 120;
    m.rows           = (configured_rows_ > 0) ? configured_rows_ : 38;
    m.cell_width_px  = 9.0f;
    m.cell_height_px = 18.0f;
    return m;
}

bool TerminalDevice::flush(std::string_view ansi_stream) noexcept {
    if (ansi_stream.empty()) {
        return true;
    }
    const std::size_t written = std::fwrite(ansi_stream.data(), 1, ansi_stream.size(), stdout);
    std::fflush(stdout);
    return written == ansi_stream.size();
}

} // namespace pokemon_ar::tty
