#include "pokemon_ar/game/ar_game.hpp"

#include <algorithm>
#include <cmath>
#include <cstdio>

namespace pokemon_ar::game {

ArGameSession::ArGameSession() {
    initialize();
}

void ArGameSession::initialize() noexcept {
    pikachu_mesh_     = mesh::procedural::create_pikachu();
    charmander_mesh_  = mesh::procedural::create_charmander();
    bulbasaur_mesh_   = mesh::procedural::create_bulbasaur();
    gastly_mesh_      = mesh::procedural::create_gastly();
    pokeball_mesh_    = mesh::procedural::create_pokeball(0.26f, 10, 16);
    anchor_ring_mesh_ = mesh::procedural::create_ar_anchor_ring(0.88f, 0.11f, 20);

    pokemons_.clear();

    // 4 Pokémons 3D ancorados em diferentes ângulos e distâncias no chão do ambiente real (Y = -1.25m)
    pokemons_.push_back(WildPokemonEntity{
        SpeciesId::Pikachu,
        {0.0f, -1.25f, -3.4f}, // Direto à frente da câmera inicial (Yaw = 0)
        0.0f, 1.0f, 0.90f, 420, true, false
    });
    pokemons_.push_back(WildPokemonEntity{
        SpeciesId::Charmander,
        {2.9f, -1.25f, -2.6f}, // À direita (~48 graus)
        -0.75f, 1.0f, 0.90f, 510, true, false
    });
    pokemons_.push_back(WildPokemonEntity{
        SpeciesId::Bulbasaur,
        {-2.8f, -1.25f, -2.8f}, // À esquerda (~-45 graus)
        0.75f, 1.0f, 0.95f, 485, true, false
    });
    pokemons_.push_back(WildPokemonEntity{
        SpeciesId::Gastly,
        {0.4f, -1.10f, 3.6f}, // Atrás do jogador (~170 graus, incentiva girar 360 graus com o celular!)
        kPi, 1.0f, 0.95f, 666, true, false
    });

    ball_           = PokeballProjectile{};
    total_captured_ = 0;
}

void ArGameSession::throw_pokeball(const tracker::ArPose6DoF& cam_pose,
                                   f32 throw_speed,
                                   f32 throw_up_angle_rad,
                                   f32 aim_yaw_offset_rad) noexcept {
    if (ball_.state == PokeballState::CaptureShake) {
        return; // Aguarda a Pokébola terminar de balançar
    }

    // Se havia um Pokémon dentro de uma captura que escapou/terminou, restaura estado
    if (ball_.target_idx >= 0 && static_cast<std::size_t>(ball_.target_idx) < pokemons_.size()) {
        pokemons_[static_cast<std::size_t>(ball_.target_idx)].inside_ball = false;
    }

    const f32 launch_yaw   = cam_pose.yaw_rad + aim_yaw_offset_rad;
    const f32 launch_pitch = std::clamp(cam_pose.pitch_rad + throw_up_angle_rad, -0.35f, 0.95f);

    const f32 cy = std::cos(launch_yaw);
    const f32 sy = std::sin(launch_yaw);
    const f32 cp = std::cos(launch_pitch);
    const f32 sp = std::sin(launch_pitch);

    const math::Vec3 launch_dir = math::Vec3{sy * cp, sp, -cy * cp}.normalized();
    const math::Vec3 cam_forward{std::sin(cam_pose.yaw_rad), 0.0f, -std::cos(cam_pose.yaw_rad)};

    ball_.state        = PokeballState::Flying;
    ball_.position     = cam_pose.position + cam_forward * 0.55f + math::Vec3{0.0f, -0.25f, 0.0f};
    ball_.velocity     = launch_dir * throw_speed;
    ball_.spin_pitch   = 0.0f;
    ball_.shake_timer  = 0.0f;
    ball_.shakes_done  = 0;
    ball_.target_idx   = -1;

    std::snprintf(status_banner_, sizeof(status_banner_), "Pokebola 3D arremessada! Rastreando trajetoria no espaco AR...");
}

void ArGameSession::respawn_pokemon(u32 idx, f32 time_sec) noexcept {
    if (idx >= pokemons_.size()) {
        return;
    }
    WildPokemonEntity& p = pokemons_[idx];
    const f32 base_angles[4] = {0.0f, 0.85f, -0.85f, 2.8f};
    const f32 angle = base_angles[idx % 4] + 0.35f * std::sin(time_sec * 1.7f + static_cast<f32>(idx));
    const f32 dist  = 3.2f + 0.6f * static_cast<f32>(idx % 3);

    p.world_pos   = {std::sin(angle) * dist, -1.25f, -std::cos(angle) * dist};
    p.combat_power = 200 + ((static_cast<u32>(time_sec * 37.0f) + idx * 131u) % 650u);
    p.active      = true;
    p.inside_ball = false;
}

void ArGameSession::update(const tracker::ArPose6DoF& cam_pose, f32 dt_sec, f32 time_sec) noexcept {
    // Faz cada Pokémon olhar suavemente na direção do jogador no mundo real
    for (WildPokemonEntity& p : pokemons_) {
        if (!p.active || p.inside_ball) {
            continue;
        }
        const f32 dx = cam_pose.position.x - p.world_pos.x;
        const f32 dz = cam_pose.position.z - p.world_pos.z;
        p.facing_yaw = std::atan2(dx, dz);
    }

    if (ball_.state == PokeballState::Flying) {
        constexpr f32 kGravity = -9.2f;
        ball_.velocity.y += kGravity * dt_sec;
        ball_.position   += ball_.velocity * dt_sec;
        ball_.spin_pitch += 14.0f * dt_sec;

        // Testa colisão 3D contra cada Pokémon ativo no ambiente
        for (std::size_t i = 0; i < pokemons_.size(); ++i) {
            WildPokemonEntity& p = pokemons_[i];
            if (!p.active || p.inside_ball) {
                continue;
            }
            const math::Vec3 target_center = p.world_pos + math::Vec3{0.0f, 0.82f, 0.0f};
            const f32 dist = (ball_.position - target_center).length();
            if (dist <= p.hit_radius) {
                // Acertou o Pokémon em 3D! Inicia sequência de captura no chão
                p.inside_ball     = true;
                ball_.state       = PokeballState::CaptureShake;
                ball_.target_idx  = static_cast<i32>(i);
                ball_.position    = p.world_pos + math::Vec3{0.0f, 0.28f, 0.0f};
                ball_.velocity    = {0.0f, 0.0f, 0.0f};
                ball_.shake_timer = 0.0f;
                ball_.shakes_done = 0;

                std::snprintf(status_banner_, sizeof(status_banner_),
                              "ACERTOU %s (CP %u)! A Pokebola esta balancando no chao (1/3)...",
                              species_name(p.species).data(), p.combat_power);
                return;
            }
        }

        // Verifica se a Pokébola caiu no chão real (Y <= floor_y) ou voou para muito longe
        if (ball_.position.y <= cam_pose.floor_y_meters + 0.22f ||
            (ball_.position - cam_pose.position).length() > 18.0f) {
            ball_.state = PokeballState::Idle;
            std::snprintf(status_banner_, sizeof(status_banner_),
                          "A Pokebola quicou no chao! Chegue mais perto ou mire no Pokemon e tente de novo.");
        }
    } else if (ball_.state == PokeballState::CaptureShake) {
        ball_.shake_timer += dt_sec;
        const u32 current_shakes = static_cast<u32>(ball_.shake_timer / 0.65f);
        if (current_shakes > ball_.shakes_done && current_shakes <= 3) {
            ball_.shakes_done = current_shakes;
            if (ball_.shakes_done < 3 && ball_.target_idx >= 0) {
                const WildPokemonEntity& p = pokemons_[static_cast<std::size_t>(ball_.target_idx)];
                std::snprintf(status_banner_, sizeof(status_banner_),
                              "Capturando %s... Shake (%u/3)!",
                              species_name(p.species).data(), ball_.shakes_done + 1);
            }
        }

        if (ball_.shake_timer >= 2.0f) {
            ball_.state       = PokeballState::CaptureSuccess;
            ball_.shake_timer = 0.0f;
            ++total_captured_;

            if (ball_.target_idx >= 0 && static_cast<std::size_t>(ball_.target_idx) < pokemons_.size()) {
                const u32 tidx = static_cast<u32>(ball_.target_idx);
                const WildPokemonEntity& p = pokemons_[tidx];
                std::snprintf(status_banner_, sizeof(status_banner_),
                              "GOTCHA! %s (CP %u) foi capturado em 3D! Total na Pokedex: %u",
                              species_name(p.species).data(), p.combat_power, total_captured_);
                respawn_pokemon(tidx, time_sec + 1.5f);
            }
        }
    } else if (ball_.state == PokeballState::CaptureSuccess) {
        ball_.shake_timer += dt_sec;
        if (ball_.shake_timer >= 1.2f) {
            ball_.state      = PokeballState::Idle;
            ball_.target_idx = -1;
        }
    }
}

i32 ArGameSession::find_targeted_pokemon(const tracker::ArPose6DoF& cam_pose,
                                         f32& out_distance_m,
                                         f32& out_angle_diff_rad) const noexcept {
    i32 best_idx = -1;
    f32 best_ang = 1e9f;
    out_distance_m     = 0.0f;
    out_angle_diff_rad = kPi;

    const math::Vec3 cam_fwd{std::sin(cam_pose.yaw_rad), 0.0f, -std::cos(cam_pose.yaw_rad)};

    for (std::size_t i = 0; i < pokemons_.size(); ++i) {
        const WildPokemonEntity& p = pokemons_[i];
        if (!p.active || p.inside_ball) {
            continue;
        }
        const math::Vec3 to_p = p.world_pos - cam_pose.position;
        const f32 dist = to_p.length();
        const math::Vec3 dir_xz = math::Vec3{to_p.x, 0.0f, to_p.z}.normalized();
        const f32 cos_a = std::clamp(math::dot(cam_fwd, dir_xz), -1.0f, 1.0f);
        const f32 ang   = std::acos(cos_a);

        if (ang < best_ang) {
            best_ang           = ang;
            best_idx           = static_cast<i32>(i);
            out_distance_m     = dist;
            out_angle_diff_rad = ang;
        }
    }
    return best_idx;
}

void ArGameSession::build_draw_commands(std::vector<renderer::DrawCommand>& out_cmds, f32 time_sec) const {
    out_cmds.clear();

    for (std::size_t i = 0; i < pokemons_.size(); ++i) {
        const WildPokemonEntity& p = pokemons_[i];
        if (!p.active) {
            continue;
        }

        // 1. Anel Holográfico AR ancorado no chão real abaixo de cada Pokémon
        renderer::DrawCommand ring_cmd{};
        ring_cmd.mesh         = &anchor_ring_mesh_;
        ring_cmd.model_matrix = math::Mat4::translation(p.world_pos) * math::Mat4::rotation_y(time_sec * 0.8f);
        ring_cmd.tint_color   = p.inside_ball ? math::Vec3{1.0f, 0.85f, 0.20f} : math::Vec3{0.20f, 1.0f, 0.85f};
        ring_cmd.entity_id    = static_cast<u32>(10 + i);
        out_cmds.push_back(ring_cmd);

        if (p.inside_ball) {
            continue;
        }

        // 2. Malha 3D do Pokémon com animação procedural nos vértices
        const mesh::MeshData* species_mesh = &pikachu_mesh_;
        renderer::WaveDeformMode wave_mode = renderer::WaveDeformMode::CreatureIdleBounce;
        f32 wave_amp = 0.16f;

        switch (p.species) {
            case SpeciesId::Pikachu:
                species_mesh = &pikachu_mesh_;
                wave_amp     = 0.16f;
                break;
            case SpeciesId::Charmander:
                species_mesh = &charmander_mesh_;
                wave_amp     = 0.20f;
                break;
            case SpeciesId::Bulbasaur:
                species_mesh = &bulbasaur_mesh_;
                wave_amp     = 0.12f;
                break;
            case SpeciesId::Gastly:
                species_mesh = &gastly_mesh_;
                wave_mode    = renderer::WaveDeformMode::GhostFloat;
                wave_amp     = 0.22f;
                break;
        }

        renderer::DrawCommand pcmd{};
        pcmd.mesh           = species_mesh;
        pcmd.model_matrix   = math::Mat4::translation(p.world_pos) *
                              math::Mat4::rotation_y(p.facing_yaw) *
                              math::Mat4::scale({p.scale, p.scale, p.scale});
        pcmd.wave.mode      = wave_mode;
        pcmd.wave.amplitude = wave_amp;
        pcmd.wave.frequency = 5.5f;
        pcmd.wave.spatial_k = 3.2f;
        pcmd.wave.phase     = static_cast<f32>(i) * 1.7f;
        pcmd.entity_id      = static_cast<u32>(50 + i);
        out_cmds.push_back(pcmd);
    }

    // 3. Pokébola 3D (em voo ou balançando no chão durante a captura!)
    if (ball_.state != PokeballState::Idle) {
        renderer::DrawCommand bcmd{};
        bcmd.mesh = &pokeball_mesh_;

        if (ball_.state == PokeballState::Flying) {
            bcmd.model_matrix = math::Mat4::translation(ball_.position) *
                                math::Mat4::rotation_x(ball_.spin_pitch) *
                                math::Mat4::rotation_y(time_sec * 4.0f);
            bcmd.tint_color   = {1.0f, 1.0f, 1.0f};
        } else if (ball_.state == PokeballState::CaptureShake) {
            const f32 wobble = 0.45f * std::sin(ball_.shake_timer * 14.0f);
            bcmd.model_matrix = math::Mat4::translation(ball_.position) *
                                math::Mat4::rotation_z(wobble);
            // Pisca em vermelho/dourado enquanto tenta capturar
            const f32 pulse = 0.5f + 0.5f * std::sin(ball_.shake_timer * 18.0f);
            bcmd.tint_color = {1.0f, 0.75f + 0.25f * pulse, 0.75f + 0.25f * pulse};
        } else {
            // CaptureSuccess: Pokébola brilha em dourado/verde esmeralda!
            bcmd.model_matrix = math::Mat4::translation(ball_.position) *
                                math::Mat4::scale({1.15f, 1.15f, 1.15f});
            bcmd.tint_color   = {0.40f, 1.0f, 0.55f};
        }

        bcmd.entity_id = 200;
        out_cmds.push_back(bcmd);
    }
}

} // namespace pokemon_ar::game
