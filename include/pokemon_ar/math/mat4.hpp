#pragma once

#include "pokemon_ar/math/vec.hpp"
#include <cmath>

namespace pokemon_ar::math {

/// Matriz 4x4 Column-Major alinhada em 16 bytes (layout nativo SPIR-V / GLSL para Vulkan).
struct alignas(16) Mat4 {
    Vec4 cols[4];

    constexpr Mat4() noexcept
        : cols{
            {1.0f, 0.0f, 0.0f, 0.0f},
            {0.0f, 1.0f, 0.0f, 0.0f},
            {0.0f, 0.0f, 1.0f, 0.0f},
            {0.0f, 0.0f, 0.0f, 1.0f}
        } {}

    constexpr Mat4(const Vec4& c0, const Vec4& c1, const Vec4& c2, const Vec4& c3) noexcept
        : cols{c0, c1, c2, c3} {}

    [[nodiscard]] static constexpr Mat4 identity() noexcept {
        return Mat4{};
    }

    [[nodiscard]] static constexpr Mat4 translation(const Vec3& t) noexcept {
        return Mat4{
            {1.0f, 0.0f, 0.0f, 0.0f},
            {0.0f, 1.0f, 0.0f, 0.0f},
            {0.0f, 0.0f, 1.0f, 0.0f},
            {t.x,  t.y,  t.z,  1.0f}
        };
    }

    [[nodiscard]] static constexpr Mat4 scale(const Vec3& s) noexcept {
        return Mat4{
            {s.x,  0.0f, 0.0f, 0.0f},
            {0.0f, s.y,  0.0f, 0.0f},
            {0.0f, 0.0f, s.z,  0.0f},
            {0.0f, 0.0f, 0.0f, 1.0f}
        };
    }

    [[nodiscard]] static Mat4 rotation_x(f32 angle_rad) noexcept {
        const f32 c = std::cos(angle_rad);
        const f32 s = std::sin(angle_rad);
        return Mat4{
            {1.0f, 0.0f, 0.0f, 0.0f},
            {0.0f,  c,    s,   0.0f},
            {0.0f, -s,    c,   0.0f},
            {0.0f, 0.0f, 0.0f, 1.0f}
        };
    }

    [[nodiscard]] static Mat4 rotation_y(f32 angle_rad) noexcept {
        const f32 c = std::cos(angle_rad);
        const f32 s = std::sin(angle_rad);
        return Mat4{
            { c,   0.0f, -s,   0.0f},
            {0.0f, 1.0f, 0.0f, 0.0f},
            { s,   0.0f,  c,   0.0f},
            {0.0f, 0.0f, 0.0f, 1.0f}
        };
    }

    [[nodiscard]] static Mat4 rotation_z(f32 angle_rad) noexcept {
        const f32 c = std::cos(angle_rad);
        const f32 s = std::sin(angle_rad);
        return Mat4{
            { c,    s,   0.0f, 0.0f},
            {-s,    c,   0.0f, 0.0f},
            {0.0f, 0.0f, 1.0f, 0.0f},
            {0.0f, 0.0f, 0.0f, 1.0f}
        };
    }

    [[nodiscard]] constexpr Vec4 operator*(const Vec4& v) const noexcept {
        return cols[0] * v.x + cols[1] * v.y + cols[2] * v.z + cols[3] * v.w;
    }

    [[nodiscard]] constexpr Mat4 operator*(const Mat4& rhs) const noexcept {
        return Mat4{
            (*this) * rhs.cols[0],
            (*this) * rhs.cols[1],
            (*this) * rhs.cols[2],
            (*this) * rhs.cols[3]
        };
    }

    /// Matriz de Visão Right-Handed (câmera olhando para -Z, +Y para cima no mundo).
    [[nodiscard]] static Mat4 look_at_rh(const Vec3& eye, const Vec3& target, const Vec3& world_up) noexcept {
        const Vec3 f = (target - eye).normalized();
        const Vec3 s = cross(f, world_up).normalized();
        const Vec3 u = cross(s, f);

        return Mat4{
            { s.x,  u.x, -f.x, 0.0f},
            { s.y,  u.y, -f.y, 0.0f},
            { s.z,  u.z, -f.z, 0.0f},
            {-dot(s, eye), -dot(u, eye), dot(f, eye), 1.0f}
        };
    }

    /// Constrói a Matriz View 6DoF diretamente a partir da Pose AR rastreada (Posição + Yaw/Pitch/Roll da câmera).
    [[nodiscard]] static Mat4 view_from_pose_6dof(const Vec3& cam_pos, f32 yaw_rad, f32 pitch_rad, f32 roll_rad = 0.0f) noexcept {
        // Direção frontal da câmera no mundo (yaw=0 olha para -Z, yaw>0 gira para a direita +X)
        const f32 cy = std::cos(yaw_rad);
        const f32 sy = std::sin(yaw_rad);
        const f32 cp = std::cos(pitch_rad);
        const f32 sp = std::sin(pitch_rad);

        const Vec3 forward{sy * cp, sp, -cy * cp};
        const f32 cr = std::cos(roll_rad);
        const f32 sr = std::sin(roll_rad);
        const Vec3 up_tilted{sr * cy, cr, sr * sy};

        return look_at_rh(cam_pos, cam_pos + forward, up_tilted.normalized());
    }

    /// Projeção Perspectiva Nativamente Configurada para Vulkan + Grade ASCII:
    /// - Clip Space Vulkan: Y invertido (+Y para baixo, alinhado com as linhas 0..H-1 do terminal/canvas)
    /// - Depth Buffer Vulkan Zero-to-One: Z_ndc em [0, 1]
    [[nodiscard]] static Mat4 perspective_vulkan(f32 fov_y_rad, f32 effective_aspect, f32 z_near, f32 z_far) noexcept {
        const f32 half_tan = std::tan(fov_y_rad * 0.5f);
        const f32 f = 1.0f / half_tan;
        const f32 range_inv = 1.0f / (z_near - z_far);

        return Mat4{
            {f / effective_aspect, 0.0f, 0.0f,                      0.0f},
            {0.0f,                -f,    0.0f,                      0.0f},
            {0.0f,                 0.0f, z_far * range_inv,        -1.0f},
            {0.0f,                 0.0f, z_near * z_far * range_inv, 0.0f}
        };
    }

    [[nodiscard]] static Mat4 perspective_vulkan_tty(f32 fov_y_rad, const TerminalMetrics& metrics, f32 z_near, f32 z_far) noexcept {
        return perspective_vulkan(fov_y_rad, metrics.effective_aspect_ratio(), z_near, z_far);
    }
};

[[nodiscard]] constexpr Vec3 clip_to_ndc(const Vec4& clip) noexcept {
    if (clip.w > -kEpsilon && clip.w < kEpsilon) {
        return {0.0f, 0.0f, 0.0f};
    }
    const f32 inv_w = 1.0f / clip.w;
    return {clip.x * inv_w, clip.y * inv_w, clip.z * inv_w};
}

[[nodiscard]] constexpr f32 linearize_depth_vulkan(f32 z_ndc, f32 z_near, f32 z_far) noexcept {
    return (z_near * z_far) / (z_far - z_ndc * (z_far - z_near));
}

[[nodiscard]] constexpr Vec2 ndc_to_terminal_cell(const Vec3& ndc, const TerminalMetrics& metrics) noexcept {
    const f32 col = (ndc.x * 0.5f + 0.5f) * static_cast<f32>(metrics.columns);
    const f32 row = (ndc.y * 0.5f + 0.5f) * static_cast<f32>(metrics.rows);
    return {col, row};
}

} // namespace pokemon_ar::math
