#include "pokemon_ar/mesh/mesh.hpp"

#include <cstdio>
#include <cstdlib>

namespace {

int g_tests_run = 0;
int g_tests_failed = 0;

#define EXPECT_TRUE(cond) do { ++g_tests_run; if (!(cond)) { std::fprintf(stderr, "[FALHA] %s:%d: %s\n", __FILE__, __LINE__, #cond); ++g_tests_failed; } } while(0)

using namespace pokemon_ar;
using namespace pokemon_ar::mesh;

void test_pokemon_and_pokeball_meshes() {
    const MeshData pikachu    = procedural::create_pikachu();
    const MeshData charmander = procedural::create_charmander();
    const MeshData bulbasaur  = procedural::create_bulbasaur();
    const MeshData gastly     = procedural::create_gastly();
    const MeshData pokeball   = procedural::create_pokeball();
    const MeshData ring       = procedural::create_ar_anchor_ring();

    EXPECT_TRUE(pikachu.validate());
    EXPECT_TRUE(charmander.validate());
    EXPECT_TRUE(bulbasaur.validate());
    EXPECT_TRUE(gastly.validate());
    EXPECT_TRUE(pokeball.validate());
    EXPECT_TRUE(ring.validate());

    EXPECT_TRUE(pikachu.triangle_count() > 50);
    EXPECT_TRUE(pokeball.triangle_count() > 50);
    EXPECT_TRUE(pikachu.bounds.extents().y > 1.2f);
}

} // namespace

int main() {
    test_pokemon_and_pokeball_meshes();
    if (g_tests_failed == 0) {
        std::printf("[SUCESSO] Modulo 3 (Pokemon & Pokeball 3D Meshes): %d assercoes passaram.\n", g_tests_run);
        return EXIT_SUCCESS;
    }
    return EXIT_FAILURE;
}
