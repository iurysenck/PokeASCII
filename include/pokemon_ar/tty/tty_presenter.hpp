#pragma once

#include "pokemon_ar/core/types.hpp"
#include <vector>
#include <string_view>

namespace pokemon_ar::tty {

/// Cor RGB de 24 bits (TrueColor).
struct ColorRGB {
    u8 r = 0;
    u8 g = 0;
    u8 b = 0;

    constexpr ColorRGB() noexcept = default;
    constexpr ColorRGB(u8 r_, u8 g_, u8 b_) noexcept : r(r_), g(g_), b(b_) {}

    [[nodiscard]] constexpr bool operator==(const ColorRGB& rhs) const noexcept {
        return r == rhs.r && g == rhs.g && b == rhs.b;
    }

    [[nodiscard]] constexpr bool operator!=(const ColorRGB& rhs) const noexcept {
        return !(*this == rhs);
    }

    [[nodiscard]] constexpr bool near_equals(const ColorRGB& rhs, u8 tolerance) const noexcept {
        const int dr = static_cast<int>(r) - static_cast<int>(rhs.r);
        const int dg = static_cast<int>(g) - static_cast<int>(rhs.g);
        const int db = static_cast<int>(b) - static_cast<int>(rhs.b);
        const int tol = static_cast<int>(tolerance);
        return (dr >= -tol && dr <= tol) &&
               (dg >= -tol && dg <= tol) &&
               (db >= -tol && db <= tol);
    }
};

/// Célula individual do terminal / grade ASCII (12 bytes).
struct Cell {
    u32      codepoint = U' ';
    ColorRGB fg{255, 255, 255};
    ColorRGB bg{10, 14, 22};

    [[nodiscard]] constexpr bool operator==(const Cell& rhs) const noexcept {
        return codepoint == rhs.codepoint && fg == rhs.fg && bg == rhs.bg;
    }
};

/// Modos nativos de apresentação para maximizar percepção 3D e adaptar-se ao hardware.
enum class RenderMode : u8 {
    Ascii3D   = 0, ///< Glifo ASCII direcional/luminância no FG + sombreamento contínuo no BG
    HalfBlock = 1, ///< Sub-bloco Unicode U+2580 ('▀'): dobra a resolução vertical (2x1 por célula)
    Braille   = 2  ///< Padrão Braille Unicode U+2800..U+28FF: aumenta em 8x a densidade (2x4 por célula)
};

/// Buffer 1D contíguo (cache-friendly) que armazena o estado visual de um frame do terminal.
class FrameBufferTTY {
public:
    FrameBufferTTY(u32 columns, u32 rows);

    void resize(u32 columns, u32 rows);
    void clear(const Cell& clear_cell = Cell{U' ', {255, 255, 255}, {10, 14, 22}}) noexcept;

    [[nodiscard]] u32 columns() const noexcept { return columns_; }
    [[nodiscard]] u32 rows() const noexcept { return rows_; }
    [[nodiscard]] std::size_t size() const noexcept { return cells_.size(); }

    [[nodiscard]] Cell& at(u32 col, u32 row) noexcept {
        return cells_[static_cast<std::size_t>(row) * columns_ + col];
    }

    [[nodiscard]] const Cell& at(u32 col, u32 row) const noexcept {
        return cells_[static_cast<std::size_t>(row) * columns_ + col];
    }

    void set_half_block(u32 col, u32 row, ColorRGB top_pixel, ColorRGB bottom_pixel) noexcept {
        if (col >= columns_ || row >= rows_) {
            return;
        }
        Cell& c = at(col, row);
        c.codepoint = 0x2580u;
        c.fg = top_pixel;
        c.bg = bottom_pixel;
    }

    [[nodiscard]] static constexpr u32 braille_codepoint_from_mask(u8 dot_mask_2x4) noexcept {
        return 0x2800u + static_cast<u32>(dot_mask_2x4);
    }

    [[nodiscard]] const std::vector<Cell>& raw_cells() const noexcept { return cells_; }

private:
    u32 columns_ = 0;
    u32 rows_    = 0;
    std::vector<Cell> cells_;
};

struct EncoderStats {
    std::size_t bytes_emitted    = 0;
    u32         fg_color_changes = 0;
    u32         bg_color_changes = 0;
    u32         cells_processed  = 0;
};

/// Serializador ANSI de passagem única com Run-Length Encoding de cor e Synchronized Output.
class AnsiSerializer {
public:
    explicit AnsiSerializer(u8 color_tolerance = 0);

    void set_color_tolerance(u8 tolerance) noexcept { color_tolerance_ = tolerance; }
    [[nodiscard]] u8 color_tolerance() const noexcept { return color_tolerance_; }

    [[nodiscard]] std::string_view serialize(const FrameBufferTTY& fb,
                                             bool use_synchronized_output = true,
                                             EncoderStats* out_stats = nullptr);

private:
    void append_str(const char* s, std::size_t len);
    void append_u8_decimal(u8 val);
    void append_utf8(u32 codepoint);
    void append_fg_color(ColorRGB c);
    void append_bg_color(ColorRGB c);

    u8 color_tolerance_ = 0;
    std::vector<char> out_buffer_;
};

/// Abstração de Hardware do Terminal (Cross-Platform com buffer CRT único de 128 KB).
class TerminalDevice {
public:
    TerminalDevice() = default;
    ~TerminalDevice();

    TerminalDevice(const TerminalDevice&) = delete;
    TerminalDevice& operator=(const TerminalDevice&) = delete;

    bool initialize(u32 target_cols = 0, u32 target_rows = 0) noexcept;
    void shutdown() noexcept;

    [[nodiscard]] TerminalMetrics query_metrics() const noexcept;
    bool flush(std::string_view ansi_stream) noexcept;

private:
    bool initialized_     = false;
    u32  configured_cols_ = 120;
    u32  configured_rows_ = 38;
};

} // namespace pokemon_ar::tty
