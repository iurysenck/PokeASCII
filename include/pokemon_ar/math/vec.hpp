#pragma once

#include "pokemon_ar/core/types.hpp"
#include <cmath>

namespace pokemon_ar::math {

struct Vec2 {
    f32 x = 0.0f;
    f32 y = 0.0f;

    constexpr Vec2() noexcept = default;
    constexpr Vec2(f32 x_, f32 y_) noexcept : x(x_), y(y_) {}

    [[nodiscard]] constexpr Vec2 operator+(const Vec2& rhs) const noexcept { return {x + rhs.x, y + rhs.y}; }
    [[nodiscard]] constexpr Vec2 operator-(const Vec2& rhs) const noexcept { return {x - rhs.x, y - rhs.y}; }
    [[nodiscard]] constexpr Vec2 operator*(f32 s) const noexcept { return {x * s, y * s}; }
    [[nodiscard]] constexpr f32 length_sq() const noexcept { return x * x + y * y; }
    [[nodiscard]] f32 length() const noexcept { return std::sqrt(length_sq()); }
};

struct Vec3 {
    f32 x = 0.0f;
    f32 y = 0.0f;
    f32 z = 0.0f;

    constexpr Vec3() noexcept = default;
    constexpr Vec3(f32 x_, f32 y_, f32 z_) noexcept : x(x_), y(y_), z(z_) {}

    [[nodiscard]] constexpr Vec3 operator+(const Vec3& rhs) const noexcept { return {x + rhs.x, y + rhs.y, z + rhs.z}; }
    [[nodiscard]] constexpr Vec3 operator-(const Vec3& rhs) const noexcept { return {x - rhs.x, y - rhs.y, z - rhs.z}; }
    [[nodiscard]] constexpr Vec3 operator-() const noexcept { return {-x, -y, -z}; }
    [[nodiscard]] constexpr Vec3 operator*(f32 s) const noexcept { return {x * s, y * s, z * s}; }
    [[nodiscard]] constexpr Vec3 operator/(f32 s) const noexcept {
        const f32 inv = 1.0f / s;
        return {x * inv, y * inv, z * inv};
    }

    constexpr Vec3& operator+=(const Vec3& rhs) noexcept { x += rhs.x; y += rhs.y; z += rhs.z; return *this; }
    constexpr Vec3& operator-=(const Vec3& rhs) noexcept { x -= rhs.x; y -= rhs.y; z -= rhs.z; return *this; }
    constexpr Vec3& operator*=(f32 s) noexcept { x *= s; y *= s; z *= s; return *this; }

    [[nodiscard]] constexpr f32 length_sq() const noexcept { return x * x + y * y + z * z; }
    [[nodiscard]] f32 length() const noexcept { return std::sqrt(length_sq()); }

    [[nodiscard]] Vec3 normalized() const noexcept {
        const f32 len_sq = length_sq();
        if (len_sq <= kEpsilon * kEpsilon) {
            return {0.0f, 0.0f, 0.0f};
        }
        const f32 inv_len = 1.0f / std::sqrt(len_sq);
        return {x * inv_len, y * inv_len, z * inv_len};
    }
};

/// Vetor 4D alinhado em 16 bytes para compatibilidade com SIMD e layout std140 do Vulkan.
struct alignas(16) Vec4 {
    f32 x = 0.0f;
    f32 y = 0.0f;
    f32 z = 0.0f;
    f32 w = 0.0f;

    constexpr Vec4() noexcept = default;
    constexpr Vec4(f32 x_, f32 y_, f32 z_, f32 w_) noexcept : x(x_), y(y_), z(z_), w(w_) {}
    constexpr Vec4(const Vec3& v, f32 w_) noexcept : x(v.x), y(v.y), z(v.z), w(w_) {}

    [[nodiscard]] constexpr Vec4 operator+(const Vec4& rhs) const noexcept { return {x + rhs.x, y + rhs.y, z + rhs.z, w + rhs.w}; }
    [[nodiscard]] constexpr Vec4 operator-(const Vec4& rhs) const noexcept { return {x - rhs.x, y - rhs.y, z - rhs.z, w - rhs.w}; }
    [[nodiscard]] constexpr Vec4 operator*(f32 s) const noexcept { return {x * s, y * s, z * s, w * s}; }

    [[nodiscard]] constexpr Vec3 xyz() const noexcept { return {x, y, z}; }
};

[[nodiscard]] constexpr f32 dot(const Vec2& a, const Vec2& b) noexcept {
    return a.x * b.x + a.y * b.y;
}

[[nodiscard]] constexpr f32 dot(const Vec3& a, const Vec3& b) noexcept {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

[[nodiscard]] constexpr f32 dot(const Vec4& a, const Vec4& b) noexcept {
    return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}

[[nodiscard]] constexpr Vec3 cross(const Vec3& a, const Vec3& b) noexcept {
    return {
        a.y * b.z - a.z * b.y,
        a.z * b.x - a.x * b.z,
        a.x * b.y - a.y * b.x
    };
}

} // namespace pokemon_ar::math
