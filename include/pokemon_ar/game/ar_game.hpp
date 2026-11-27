#pragma once

#include "pokemon_ar/core/types.hpp"
#include "pokemon_ar/math/vec.hpp"
#include "pokemon_ar/math/mat4.hpp"
#include "pokemon_ar/mesh/mesh.hpp"
#include "pokemon_ar/renderer/gpu_renderer.hpp"
#include "pokemon_ar/tracker/ar_tracker.hpp"

#include <string_view>
#include <vector>

namespace pokemon_ar::game {

enum class SpeciesId : u8 {
    Pikachu    = 0,
    Charmander = 1,
    Bulbasaur  = 2,
    Gastly     = 3
};

[[nodiscard]] constexpr std::string_view species_name(SpeciesId id) noexcept {
    switch (id) {
        case SpeciesId::Pikachu:    return "PIKACHU";
        case SpeciesId::Charmander: return "CHARMANDER";
        case SpeciesId::Bulbasaur:  return "BULBASAUR";
        case SpeciesId::Gastly:     return "GASTLY";
        default:                    return "UNKNOWN";
    }
}

/// Pokémon 3D ancorado em uma coordenada fixa do mundo real (X, Y_chão, Z).
struct WildPokemonEntity {
    SpeciesId  species       = SpeciesId::Pikachu;
    math::Vec3 world_pos{0.0f, -1.25f, -3.5f}; ///< Posição 3D ancorada no chão real
    f32        facing_yaw    = 0.0f;
    f32        scale         = 1.0f;
    f32        hit_radius    = 0.85f;
    u32        combat_power  = 150;
    bool       active        = true;
    bool       inside_ball   = false;
};

enum class PokeballState : u8 {
    Idle          = 0, ///< Pronta na mão do jogador
    Flying        = 1, ///< Em voo parabólico 3D no espaço do ambiente
    CaptureShake  = 2, ///< No chão balançando com o Pokémon dentro (3 shakes)
    CaptureSuccess = 3 ///< Captura concluída com explosão de estrelas 3D!
};

struct PokeballProjectile {
    PokeballState state         = PokeballState::Idle;
    math::Vec3    position{0.0f, 0.0f, 0.0f};
    math::Vec3    velocity{0.0f, 0.0f, 0.0f};
    f32           spin_pitch    = 0.0f;
    f32           shake_timer   = 0.0f;
    u32           shakes_done   = 0;
    i32           target_idx    = -1;
};

/// Sessão de Gameplay AR: gerencia os Pokémons ancorados no mundo 3D, a física da Pokébola e os DrawCommands.
class ArGameSession {
public:
    ArGameSession();

    /// Inicializa as malhas 3D e posiciona os Pokémons ao redor do jogador no ambiente real.
    void initialize() noexcept;

    /// Arremessa uma Pokébola 3D a partir da pose atual da câmera com velocidade e elevação configuráveis.
    void throw_pokeball(const tracker::ArPose6DoF& cam_pose,
                        f32 throw_speed = 7.2f,
                        f32 throw_up_angle_rad = 0.34f,
                        f32 aim_yaw_offset_rad = 0.0f) noexcept;

    /// Atualiza física 3D da Pokébola, detecção de colisão com AABB/Esfera dos Pokémons e estado de captura.
    void update(const tracker::ArPose6DoF& cam_pose, f32 dt_sec, f32 time_sec) noexcept;

    /// Constrói a fila de comandos de desenho 3D (Pokémons + Anéis de Chão AR + Pokébola) para o GpuRenderer.
    void build_draw_commands(std::vector<renderer::DrawCommand>& out_cmds, f32 time_sec) const;

    [[nodiscard]] const std::vector<WildPokemonEntity>& pokemons() const noexcept { return pokemons_; }
    [[nodiscard]] const PokeballProjectile& pokeball() const noexcept { return ball_; }
    [[nodiscard]] u32 total_captured() const noexcept { return total_captured_; }
    [[nodiscard]] std::string_view status_banner() const noexcept { return status_banner_; }

    /// Encontra o índice do Pokémon mais próximo do centro da mira da câmera atual.
    [[nodiscard]] i32 find_targeted_pokemon(const tracker::ArPose6DoF& cam_pose,
                                            f32& out_distance_m,
                                            f32& out_angle_diff_rad) const noexcept;

private:
    void respawn_pokemon(u32 idx, f32 time_sec) noexcept;

    mesh::MeshData pikachu_mesh_;
    mesh::MeshData charmander_mesh_;
    mesh::MeshData bulbasaur_mesh_;
    mesh::MeshData gastly_mesh_;
    mesh::MeshData pokeball_mesh_;
    mesh::MeshData anchor_ring_mesh_;

    std::vector<WildPokemonEntity> pokemons_;
    PokeballProjectile             ball_{};
    u32                            total_captured_ = 0;
    char                           status_banner_[128] = "Aponte a camera para um Pokemon 3D e pressione [ESPACO] para lancar a Pokebola!";
};

} // namespace pokemon_ar::game
