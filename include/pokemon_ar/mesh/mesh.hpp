#pragma once

#include "pokemon_ar/core/types.hpp"
#include "pokemon_ar/math/vec.hpp"

#include <string>
#include <string_view>
#include <vector>

namespace pokemon_ar::mesh {

/// Vértice 3D de 48 bytes (3 x 16 bytes), ideal para Vulkan Vertex Input e cache L1.
/// uv.x controla a intensidade de deformação procedural (0 = base rígida .. 1 = extremidade animada: cauda/chama/orelha).
struct Vertex {
    math::Vec3 position{0.0f, 0.0f, 0.0f};
    math::Vec3 normal{0.0f, 1.0f, 0.0f};
    math::Vec2 uv{0.0f, 0.0f};
    math::Vec3 color{1.0f, 1.0f, 1.0f};
    f32        padding = 0.0f;
};

static_assert(sizeof(Vertex) == 48, "Vertex deve ter exatos 48 bytes para alinhamento em GPU");

/// Axis-Aligned Bounding Box (Caixa Delimitadora Alinhada aos Eixos) para colisão 3D de Pokébolas.
struct AABB {
    math::Vec3 min{ 1e30f,  1e30f,  1e30f};
    math::Vec3 max{-1e30f, -1e30f, -1e30f};

    constexpr void reset() noexcept {
        min = { 1e30f,  1e30f,  1e30f};
        max = {-1e30f, -1e30f, -1e30f};
    }

    constexpr void expand(const math::Vec3& p) noexcept {
        if (p.x < min.x) min.x = p.x;
        if (p.y < min.y) min.y = p.y;
        if (p.z < min.z) min.z = p.z;

        if (p.x > max.x) max.x = p.x;
        if (p.y > max.y) max.y = p.y;
        if (p.z > max.z) max.z = p.z;
    }

    [[nodiscard]] constexpr bool is_valid() const noexcept {
        return min.x <= max.x && min.y <= max.y && min.z <= max.z;
    }

    [[nodiscard]] constexpr math::Vec3 center() const noexcept {
        return (min + max) * 0.5f;
    }

    [[nodiscard]] constexpr math::Vec3 extents() const noexcept {
        return max - min;
    }

    [[nodiscard]] constexpr bool contains(const math::Vec3& p) const noexcept {
        return p.x >= min.x && p.x <= max.x &&
               p.y >= min.y && p.y <= max.y &&
               p.z >= min.z && p.z <= max.z;
    }
};

/// Malha poligonal indexada pronta para rasterização 3D.
struct MeshData {
    std::vector<Vertex> vertices;
    std::vector<u32>    indices;
    AABB                bounds;

    [[nodiscard]] u32 triangle_count() const noexcept {
        return static_cast<u32>(indices.size() / 3);
    }

    void recompute_bounds() noexcept;
    void recompute_normals() noexcept;
    [[nodiscard]] bool validate() const noexcept;
};

struct ObjLoadResult {
    bool        ok = false;
    MeshData    mesh;
    std::string error_message;
};

[[nodiscard]] ObjLoadResult load_obj_from_string(std::string_view obj_source,
                                                 const math::Vec3& default_color = {0.9f, 0.9f, 0.9f});

/// Geradores procedurais 3D ultra-leves para os Pokémons, Pokébola e âncoras AR.
namespace procedural {

/// Pikachu 3D (Rato Elétrico): corpo amarelo vibrante, bochechas vermelhas, orelhas longas com pontas escuras e cauda em raio.
[[nodiscard]] MeshData create_pikachu();

/// Charmander 3D (Lagarto de Fogo): corpo laranja, barriga creme e cauda com chama bicolor animada.
[[nodiscard]] MeshData create_charmander();

/// Bulbasaur 3D (Monstro Planta): corpo turquesa quadrúpede com grande bulbo verde nas costas.
[[nodiscard]] MeshData create_bulbasaur();

/// Gastly 3D (Orbe Fantasma): núcleo esférico roxo escuro com olhos brilhantes e aura espectral flutuante.
[[nodiscard]] MeshData create_gastly();

/// Pokébola 3D: hemisfério superior vermelho, faixa equatorial preta, hemisfério inferior branco e botão frontal 3D.
[[nodiscard]] MeshData create_pokeball(f32 radius = 0.28f, u32 rings = 10, u32 sectors = 16);

/// Anel holográfico 3D de ancoragem no chão real (mostra o plano Y do ambiente rastreado sob cada Pokémon).
[[nodiscard]] MeshData create_ar_anchor_ring(f32 outer_radius = 0.85f, f32 thickness = 0.10f, u32 segments = 20);

} // namespace procedural

} // namespace pokemon_ar::mesh
