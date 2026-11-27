#include "pokemon_ar/tty/tty_presenter.hpp"

#include <cstdio>
#include <cstdlib>

namespace {

int g_tests_run = 0;
int g_tests_failed = 0;

#define EXPECT_TRUE(cond) do { ++g_tests_run; if (!(cond)) { std::fprintf(stderr, "[FALHA] %s:%d: %s\n", __FILE__, __LINE__, #cond); ++g_tests_failed; } } while(0)

using namespace pokemon_ar;
using namespace pokemon_ar::tty;

void test_tty_serialization() {
    FrameBufferTTY fb(10, 1);
    fb.clear(Cell{U'#', ColorRGB{255, 220, 40}, ColorRGB{10, 20, 30}});

    AnsiSerializer ser(1);
    EncoderStats stats{};
    const std::string_view out = ser.serialize(fb, true, &stats);

    EXPECT_TRUE(stats.cells_processed == 10u);
    EXPECT_TRUE(stats.fg_color_changes == 1u);
    EXPECT_TRUE(stats.bg_color_changes == 1u);
    EXPECT_TRUE(out.find("\x1b[?2026h") == 0);
}

} // namespace

int main() {
    test_tty_serialization();
    if (g_tests_failed == 0) {
        std::printf("[SUCESSO] Modulo 2 (TTY Presenter): %d assercoes passaram.\n", g_tests_run);
        return EXIT_SUCCESS;
    }
    return EXIT_FAILURE;
}
