#include "pokemon_ar/mesh/mesh.hpp"

#include <charconv>
#include <cmath>
#include <cstdlib>

namespace pokemon_ar::mesh {

void MeshData::recompute_bounds() noexcept {
    bounds.reset();
    for (const Vertex& v : vertices) {
        bounds.expand(v.position);
    }
}

void MeshData::recompute_normals() noexcept {
    for (Vertex& v : vertices) {
        v.normal = {0.0f, 0.0f, 0.0f};
    }

    const std::size_t tri_indices = (indices.size() / 3) * 3;
    for (std::size_t i = 0; i < tri_indices; i += 3) {
        const u32 i0 = indices[i + 0];
        const u32 i1 = indices[i + 1];
        const u32 i2 = indices[i + 2];
        if (i0 >= vertices.size() || i1 >= vertices.size() || i2 >= vertices.size()) {
            continue;
        }
        const math::Vec3 e1 = vertices[i1].position - vertices[i0].position;
        const math::Vec3 e2 = vertices[i2].position - vertices[i0].position;
        const math::Vec3 face_n = math::cross(e1, e2);
        vertices[i0].normal += face_n;
        vertices[i1].normal += face_n;
        vertices[i2].normal += face_n;
    }

    for (Vertex& v : vertices) {
        const f32 len_sq = v.normal.length_sq();
        if (len_sq > kEpsilon * kEpsilon) {
            v.normal = v.normal / std::sqrt(len_sq);
        } else {
            v.normal = {0.0f, 1.0f, 0.0f};
        }
    }
}

bool MeshData::validate() const noexcept {
    if (vertices.empty() || indices.empty() || (indices.size() % 3 != 0)) {
        return false;
    }
    if (!bounds.is_valid()) {
        return false;
    }

    const u32 max_idx = static_cast<u32>(vertices.size());
    for (const u32 idx : indices) {
        if (idx >= max_idx) {
            return false;
        }
    }

    for (const Vertex& v : vertices) {
        if (std::isnan(v.position.x) || std::isnan(v.position.y) || std::isnan(v.position.z) ||
            std::isinf(v.position.x) || std::isinf(v.position.y) || std::isinf(v.position.z)) {
            return false;
        }
        const f32 n_len = v.normal.length();
        if (std::isnan(n_len) || std::fabs(n_len - 1.0f) > 0.05f) {
            return false;
        }
    }

    return true;
}

namespace {

[[nodiscard]] std::string_view trim_left(std::string_view sv) noexcept {
    while (!sv.empty() && (sv.front() == ' ' || sv.front() == '\t' || sv.front() == '\r')) {
        sv.remove_prefix(1);
    }
    return sv;
}

[[nodiscard]] std::string_view next_token(std::string_view& line) noexcept {
    line = trim_left(line);
    if (line.empty()) {
        return {};
    }
    std::size_t pos = 0;
    while (pos < line.size() && line[pos] != ' ' && line[pos] != '\t' && line[pos] != '\r') {
        ++pos;
    }
    std::string_view tok = line.substr(0, pos);
    line.remove_prefix(pos);
    return tok;
}

[[nodiscard]] bool parse_f32(std::string_view tok, f32& out) noexcept {
    if (tok.empty()) {
        return false;
    }
    const auto res = std::from_chars(tok.data(), tok.data() + tok.size(), out);
    return res.ec == std::errc{} && res.ptr == tok.data() + tok.size();
}

[[nodiscard]] bool parse_i32(std::string_view tok, i32& out) noexcept {
    if (tok.empty()) {
        return false;
    }
    const auto res = std::from_chars(tok.data(), tok.data() + tok.size(), out);
    return res.ec == std::errc{} && res.ptr == tok.data() + tok.size();
}

struct ObjFaceVertex {
    i32 v_idx  = 0;
    i32 vt_idx = 0;
    i32 vn_idx = 0;
};

[[nodiscard]] bool parse_face_vertex(std::string_view tok, ObjFaceVertex& out) noexcept {
    out = {};
    const std::size_t s1 = tok.find('/');
    if (s1 == std::string_view::npos) {
        return parse_i32(tok, out.v_idx);
    }

    if (!parse_i32(tok.substr(0, s1), out.v_idx)) {
        return false;
    }

    const std::string_view rest = tok.substr(s1 + 1);
    const std::size_t s2 = rest.find('/');
    if (s2 == std::string_view::npos) {
        if (!rest.empty() && !parse_i32(rest, out.vt_idx)) {
            return false;
        }
        return true;
    }

    const std::string_view vt_part = rest.substr(0, s2);
    const std::string_view vn_part = rest.substr(s2 + 1);
    if (!vt_part.empty() && !parse_i32(vt_part, out.vt_idx)) {
        return false;
    }
    if (!vn_part.empty() && !parse_i32(vn_part, out.vn_idx)) {
        return false;
    }
    return true;
}

} // namespace

ObjLoadResult load_obj_from_string(std::string_view obj_source, const math::Vec3& default_color) {
    ObjLoadResult result{};

    std::vector<math::Vec3> raw_positions;
    std::vector<math::Vec3> raw_normals;
    std::vector<math::Vec2> raw_uvs;
    bool has_explicit_normals = false;

    std::size_t pos = 0;
    while (pos < obj_source.size()) {
        std::size_t end = obj_source.find('\n', pos);
        if (end == std::string_view::npos) {
            end = obj_source.size();
        }
        std::string_view line = obj_source.substr(pos, end - pos);
        pos = end + 1;

        const std::size_t hash_pos = line.find('#');
        if (hash_pos != std::string_view::npos) {
            line = line.substr(0, hash_pos);
        }

        const std::string_view cmd = next_token(line);
        if (cmd.empty()) {
            continue;
        }

        if (cmd == "v") {
            f32 x = 0.0f, y = 0.0f, z = 0.0f;
            if (!parse_f32(next_token(line), x) ||
                !parse_f32(next_token(line), y) ||
                !parse_f32(next_token(line), z)) {
                result.error_message = "Vertice 'v' malformado no OBJ";
                return result;
            }
            raw_positions.emplace_back(x, y, z);
        } else if (cmd == "vn") {
            f32 nx = 0.0f, ny = 0.0f, nz = 0.0f;
            if (!parse_f32(next_token(line), nx) ||
                !parse_f32(next_token(line), ny) ||
                !parse_f32(next_token(line), nz)) {
                result.error_message = "Normal 'vn' malformada no OBJ";
                return result;
            }
            raw_normals.push_back(math::Vec3{nx, ny, nz}.normalized());
        } else if (cmd == "vt") {
            f32 u = 0.0f, v = 0.0f;
            if (!parse_f32(next_token(line), u) ||
                !parse_f32(next_token(line), v)) {
                result.error_message = "UV 'vt' malformada no OBJ";
                return result;
            }
            raw_uvs.emplace_back(u, v);
        } else if (cmd == "f") {
            ObjFaceVertex face_verts[8];
            std::size_t corner_count = 0;

            while (true) {
                const std::string_view tok = next_token(line);
                if (tok.empty()) {
                    break;
                }
                if (corner_count >= 8) {
                    result.error_message = "Face com mais de 8 vertices nao suportada";
                    return result;
                }
                if (!parse_face_vertex(tok, face_verts[corner_count])) {
                    result.error_message = "Indice de face 'f' invalido no OBJ";
                    return result;
                }
                ++corner_count;
            }

            if (corner_count < 3) {
                result.error_message = "Face degenerada com menos de 3 vertices";
                return result;
            }

            u32 emitted_indices[8]{};
            for (std::size_t c = 0; c < corner_count; ++c) {
                const ObjFaceVertex& fv = face_verts[c];
                if (fv.v_idx <= 0 || static_cast<std::size_t>(fv.v_idx) > raw_positions.size()) {
                    result.error_message = "Indice de posicao fora de faixa no OBJ";
                    return result;
                }

                Vertex vert{};
                vert.position = raw_positions[static_cast<std::size_t>(fv.v_idx - 1)];
                vert.color    = default_color;

                if (fv.vt_idx != 0) {
                    if (fv.vt_idx < 0 || static_cast<std::size_t>(fv.vt_idx) > raw_uvs.size()) {
                        result.error_message = "Indice de UV fora de faixa no OBJ";
                        return result;
                    }
                    vert.uv = raw_uvs[static_cast<std::size_t>(fv.vt_idx - 1)];
                }

                if (fv.vn_idx != 0) {
                    if (fv.vn_idx < 0 || static_cast<std::size_t>(fv.vn_idx) > raw_normals.size()) {
                        result.error_message = "Indice de normal fora de faixa no OBJ";
                        return result;
                    }
                    vert.normal = raw_normals[static_cast<std::size_t>(fv.vn_idx - 1)];
                    has_explicit_normals = true;
                }

                emitted_indices[c] = static_cast<u32>(result.mesh.vertices.size());
                result.mesh.vertices.push_back(vert);
            }

            for (std::size_t c = 1; c + 1 < corner_count; ++c) {
                result.mesh.indices.push_back(emitted_indices[0]);
                result.mesh.indices.push_back(emitted_indices[c]);
                result.mesh.indices.push_back(emitted_indices[c + 1]);
            }
        }
    }

    if (result.mesh.vertices.empty() || result.mesh.indices.empty()) {
        result.error_message = "OBJ nao contem geometria valida";
        return result;
    }

    result.mesh.recompute_bounds();
    if (!has_explicit_normals) {
        result.mesh.recompute_normals();
    }

    if (!result.mesh.validate()) {
        result.error_message = "Malha carregada falhou na validacao topologica";
        return result;
    }

    result.ok = true;
    return result;
}

namespace procedural {

namespace {

void add_triangle(MeshData& m, u32 i0, u32 i1, u32 i2) {
    m.indices.push_back(i0);
    m.indices.push_back(i1);
    m.indices.push_back(i2);
}

void add_quad(MeshData& m, u32 i0, u32 i1, u32 i2, u32 i3) {
    add_triangle(m, i0, i1, i2);
    add_triangle(m, i0, i2, i3);
}

void append_box(MeshData& m,
                const math::Vec3& center,
                const math::Vec3& half_extents,
                const math::Vec3& color,
                f32 uv_anim_weight = 0.0f) {
    const u32 base = static_cast<u32>(m.vertices.size());
    const f32 x0 = center.x - half_extents.x, x1 = center.x + half_extents.x;
    const f32 y0 = center.y - half_extents.y, y1 = center.y + half_extents.y;
    const f32 z0 = center.z - half_extents.z, z1 = center.z + half_extents.z;

    const math::Vec3 corners[8] = {
        {x0, y0, z1}, {x1, y0, z1}, {x1, y1, z1}, {x0, y1, z1},
        {x0, y0, z0}, {x1, y0, z0}, {x1, y1, z0}, {x0, y1, z0}
    };

    for (int i = 0; i < 8; ++i) {
        Vertex v{};
        v.position = corners[i];
        v.uv       = {uv_anim_weight, (i >= 2 && i != 4 && i != 5) ? 1.0f : 0.0f};
        v.color    = color;
        m.vertices.push_back(v);
    }

    add_quad(m, base + 0, base + 1, base + 2, base + 3);
    add_quad(m, base + 5, base + 4, base + 7, base + 6);
    add_quad(m, base + 4, base + 0, base + 3, base + 7);
    add_quad(m, base + 1, base + 5, base + 6, base + 2);
    add_quad(m, base + 3, base + 2, base + 6, base + 7);
    add_quad(m, base + 4, base + 5, base + 1, base + 0);
}

void append_ellipsoid(MeshData& m,
                      const math::Vec3& center,
                      const math::Vec3& radii,
                      const math::Vec3& color,
                      u32 rings = 6,
                      u32 sectors = 10,
                      f32 uv_anim_weight = 0.1f) {
    const u32 base = static_cast<u32>(m.vertices.size());

    for (u32 r = 0; r <= rings; ++r) {
        const f32 v   = static_cast<f32>(r) / static_cast<f32>(rings);
        const f32 phi = v * kPi;
        const f32 sp  = std::sin(phi);
        const f32 cp  = std::cos(phi);

        for (u32 s = 0; s <= sectors; ++s) {
            const f32 u     = static_cast<f32>(s) / static_cast<f32>(sectors);
            const f32 theta = u * kTwoPi;
            const math::Vec3 unit_n{sp * std::cos(theta), cp, sp * std::sin(theta)};
            const math::Vec3 pos{
                center.x + unit_n.x * radii.x,
                center.y + unit_n.y * radii.y,
                center.z + unit_n.z * radii.z
            };

            m.vertices.push_back(Vertex{pos, unit_n.normalized(), {uv_anim_weight, v}, color});
        }
    }

    const u32 stride = sectors + 1;
    for (u32 r = 0; r < rings; ++r) {
        for (u32 s = 0; s < sectors; ++s) {
            const u32 i0 = base + r * stride + s;
            const u32 i1 = i0 + 1;
            const u32 i2 = base + (r + 1) * stride + (s + 1);
            const u32 i3 = base + (r + 1) * stride + s;
            add_quad(m, i0, i2, i1, i3);
        }
    }
}

void append_pyramid_cone(MeshData& m,
                         const math::Vec3& base_center,
                         const math::Vec3& tip_pos,
                         f32 base_radius,
                         const math::Vec3& base_color,
                         const math::Vec3& tip_color,
                         f32 uv_anim_tip = 0.9f) {
    const u32 b = static_cast<u32>(m.vertices.size());
    const math::Vec3 axis = (tip_pos - base_center).normalized();
    const math::Vec3 helper = (std::fabs(axis.y) < 0.9f) ? math::Vec3{0.0f, 1.0f, 0.0f} : math::Vec3{1.0f, 0.0f, 0.0f};
    const math::Vec3 right = math::cross(axis, helper).normalized() * base_radius;
    const math::Vec3 fwd   = math::cross(right, axis).normalized() * base_radius;

    m.vertices.push_back(Vertex{base_center + right, {}, {0.2f, 0.0f}, base_color});
    m.vertices.push_back(Vertex{base_center + fwd,   {}, {0.2f, 0.0f}, base_color});
    m.vertices.push_back(Vertex{base_center - right, {}, {0.2f, 0.0f}, base_color});
    m.vertices.push_back(Vertex{base_center - fwd,   {}, {0.2f, 0.0f}, base_color});
    m.vertices.push_back(Vertex{tip_pos,             {}, {uv_anim_tip, 1.0f}, tip_color});

    add_triangle(m, b + 0, b + 1, b + 4);
    add_triangle(m, b + 1, b + 2, b + 4);
    add_triangle(m, b + 2, b + 3, b + 4);
    add_triangle(m, b + 3, b + 0, b + 4);
    add_quad(m, b + 3, b + 2, b + 1, b + 0);
}

} // namespace

MeshData create_pikachu() {
    MeshData m{};
    const math::Vec3 yellow_main{1.00f, 0.88f, 0.12f};
    const math::Vec3 yellow_dark{0.92f, 0.72f, 0.06f};
    const math::Vec3 cheek_red{0.98f, 0.18f, 0.16f};
    const math::Vec3 ear_tip_black{0.15f, 0.15f, 0.18f};

    // Pés ancorados em Y=0.0, corpo e cabeça voltados para +Z
    append_box(m, {-0.22f, 0.10f,  0.10f}, {0.11f, 0.10f, 0.18f}, yellow_dark, 0.0f);
    append_box(m, { 0.22f, 0.10f,  0.10f}, {0.11f, 0.10f, 0.18f}, yellow_dark, 0.0f);

    // Torso rechonchudo e cabeça arredondada
    append_ellipsoid(m, {0.0f, 0.52f, 0.0f},  {0.42f, 0.44f, 0.36f}, yellow_main, 6, 10, 0.15f);
    append_ellipsoid(m, {0.0f, 1.08f, 0.08f}, {0.38f, 0.36f, 0.35f}, yellow_main, 6, 10, 0.30f);

    // Bochechas elétricas vermelhas (+Z frontal)
    append_box(m, {-0.26f, 1.00f, 0.38f}, {0.09f, 0.09f, 0.06f}, cheek_red, 0.35f);
    append_box(m, { 0.26f, 1.00f, 0.38f}, {0.09f, 0.09f, 0.06f}, cheek_red, 0.35f);

    // Braços frontais
    append_box(m, {-0.38f, 0.62f, 0.18f}, {0.10f, 0.12f, 0.12f}, yellow_main, 0.25f);
    append_box(m, { 0.38f, 0.62f, 0.18f}, {0.10f, 0.12f, 0.12f}, yellow_main, 0.25f);

    // Orelhas longas pontudas com ponta preta (uv_anim_tip = 0.85 para balançar!)
    append_pyramid_cone(m, {-0.22f, 1.35f, 0.05f}, {-0.48f, 1.92f, 0.08f}, 0.12f, yellow_main, ear_tip_black, 0.85f);
    append_pyramid_cone(m, { 0.22f, 1.35f, 0.05f}, { 0.48f, 1.92f, 0.08f}, 0.12f, yellow_main, ear_tip_black, 0.85f);

    // Cauda em formato de Raio (3 segmentos em zigue-zague em -Z com peso de animação crescente)
    append_box(m, {0.0f, 0.45f, -0.40f}, {0.06f, 0.10f, 0.16f}, yellow_dark, 0.50f);
    append_box(m, {0.0f, 0.72f, -0.62f}, {0.07f, 0.18f, 0.18f}, yellow_main, 0.75f);
    append_box(m, {0.0f, 1.08f, -0.86f}, {0.08f, 0.26f, 0.24f}, yellow_main, 1.00f);

    m.recompute_bounds();
    m.recompute_normals();
    return m;
}

MeshData create_charmander() {
    MeshData m{};
    const math::Vec3 orange_body{0.98f, 0.45f, 0.12f};
    const math::Vec3 cream_belly{0.98f, 0.88f, 0.52f};
    const math::Vec3 flame_core{1.00f, 0.95f, 0.25f};
    const math::Vec3 flame_tip{1.00f, 0.22f, 0.05f};

    // Pernas e pés
    append_box(m, {-0.24f, 0.18f, 0.05f}, {0.13f, 0.18f, 0.16f}, orange_body, 0.0f);
    append_box(m, { 0.24f, 0.18f, 0.05f}, {0.13f, 0.18f, 0.16f}, orange_body, 0.0f);

    // Torso laranja + placa peitoral creme
    append_ellipsoid(m, {0.0f, 0.62f, 0.0f},  {0.38f, 0.45f, 0.34f}, orange_body, 6, 10, 0.15f);
    append_box(m,       {0.0f, 0.60f, 0.28f}, {0.24f, 0.32f, 0.08f}, cream_belly, 0.15f);

    // Cabeça + focinho de réptil (+Z)
    append_ellipsoid(m, {0.0f, 1.18f, 0.10f}, {0.34f, 0.32f, 0.34f}, orange_body, 6, 10, 0.25f);
    append_box(m,       {0.0f, 1.10f, 0.38f}, {0.22f, 0.14f, 0.16f}, orange_body, 0.28f);

    // Braços
    append_box(m, {-0.42f, 0.76f, 0.16f}, {0.10f, 0.12f, 0.16f}, orange_body, 0.30f);
    append_box(m, { 0.42f, 0.76f, 0.16f}, {0.10f, 0.12f, 0.16f}, orange_body, 0.30f);

    // Cauda curvada para trás (-Z) + Chama acesa na ponta (uv=1.0 para tremular rápido!)
    append_box(m, {0.0f, 0.38f, -0.45f}, {0.14f, 0.14f, 0.25f}, orange_body, 0.50f);
    append_box(m, {0.0f, 0.55f, -0.78f}, {0.10f, 0.12f, 0.22f}, orange_body, 0.75f);
    append_pyramid_cone(m, {0.0f, 0.66f, -0.95f}, {0.0f, 1.28f, -1.02f}, 0.22f, flame_core, flame_tip, 1.00f);

    m.recompute_bounds();
    m.recompute_normals();
    return m;
}

MeshData create_bulbasaur() {
    MeshData m{};
    const math::Vec3 teal_body{0.18f, 0.78f, 0.72f};
    const math::Vec3 bulb_green{0.20f, 0.85f, 0.32f};
    const math::Vec3 bulb_tip{0.45f, 0.96f, 0.35f};

    // 4 patas robustas de quadrúpede
    append_box(m, {-0.34f, 0.20f,  0.34f}, {0.14f, 0.20f, 0.14f}, teal_body, 0.0f);
    append_box(m, { 0.34f, 0.20f,  0.34f}, {0.14f, 0.20f, 0.14f}, teal_body, 0.0f);
    append_box(m, {-0.34f, 0.20f, -0.34f}, {0.14f, 0.20f, 0.14f}, teal_body, 0.0f);
    append_box(m, { 0.34f, 0.20f, -0.34f}, {0.14f, 0.20f, 0.14f}, teal_body, 0.0f);

    // Corpo largo e cabeça frontal baixa (+Z)
    append_ellipsoid(m, {0.0f, 0.52f,  0.00f}, {0.48f, 0.34f, 0.55f}, teal_body, 6, 10, 0.15f);
    append_ellipsoid(m, {0.0f, 0.68f,  0.54f}, {0.38f, 0.30f, 0.32f}, teal_body, 6, 10, 0.25f);

    // Orelhas curtas
    append_pyramid_cone(m, {-0.26f, 0.90f, 0.50f}, {-0.34f, 1.12f, 0.50f}, 0.10f, teal_body, teal_body, 0.40f);
    append_pyramid_cone(m, { 0.26f, 0.90f, 0.50f}, { 0.34f, 1.12f, 0.50f}, 0.10f, teal_body, teal_body, 0.40f);

    // Grande Bulbo de Planta nas costas (com topo cônico animado que pulsa com a respiração)
    append_ellipsoid(m,    {0.0f, 0.92f, -0.10f}, {0.52f, 0.42f, 0.52f}, bulb_green, 6, 12, 0.60f);
    append_pyramid_cone(m, {0.0f, 1.20f, -0.10f}, {0.0f, 1.56f, -0.10f}, 0.28f, bulb_green, bulb_tip, 0.95f);

    m.recompute_bounds();
    m.recompute_normals();
    return m;
}

MeshData create_gastly() {
    MeshData m{};
    const math::Vec3 dark_core{0.34f, 0.14f, 0.52f};
    const math::Vec3 eye_glow{0.98f, 0.95f, 1.00f};
    const math::Vec3 gas_aura{0.74f, 0.30f, 0.95f};

    // Esfera central levitando acima do chão (Y = 1.05m)
    append_ellipsoid(m, {0.0f, 1.05f, 0.0f}, {0.52f, 0.52f, 0.52f}, dark_core, 7, 12, 0.45f);

    // Grandes olhos brancos angulares na frente (+Z)
    append_box(m, {-0.20f, 1.12f, 0.46f}, {0.14f, 0.16f, 0.08f}, eye_glow, 0.45f);
    append_box(m, { 0.20f, 1.12f, 0.46f}, {0.14f, 0.16f, 0.08f}, eye_glow, 0.45f);

    // Nuvens espectrais de gás roxo ao redor (uv=1.0 para flutuar fortemente!)
    append_pyramid_cone(m, {-0.55f, 1.10f, -0.15f}, {-0.95f, 1.55f, -0.35f}, 0.22f, gas_aura, gas_aura, 1.0f);
    append_pyramid_cone(m, { 0.55f, 1.10f, -0.15f}, { 0.95f, 1.55f, -0.35f}, 0.22f, gas_aura, gas_aura, 1.0f);
    append_pyramid_cone(m, { 0.00f, 1.45f, -0.25f}, { 0.00f, 1.95f, -0.45f}, 0.24f, gas_aura, gas_aura, 1.0f);

    m.recompute_bounds();
    m.recompute_normals();
    return m;
}

MeshData create_pokeball(f32 radius, u32 rings, u32 sectors) {
    MeshData m{};
    if (rings < 4) rings = 4;
    if (sectors < 6) sectors = 6;

    const math::Vec3 red_top{0.96f, 0.14f, 0.14f};
    const math::Vec3 white_bot{0.96f, 0.96f, 0.98f};
    const math::Vec3 black_band{0.12f, 0.12f, 0.15f};

    for (u32 r = 0; r <= rings; ++r) {
        const f32 v   = static_cast<f32>(r) / static_cast<f32>(rings);
        const f32 phi = v * kPi;
        const f32 sp  = std::sin(phi);
        const f32 cp  = std::cos(phi); // +1 no polo norte (+Y), -1 no polo sul (-Y)

        math::Vec3 ring_col = white_bot;
        if (std::fabs(cp) <= 0.13f) {
            ring_col = black_band;
        } else if (cp > 0.13f) {
            ring_col = red_top;
        }

        for (u32 s = 0; s <= sectors; ++s) {
            const f32 u     = static_cast<f32>(s) / static_cast<f32>(sectors);
            const f32 theta = u * kTwoPi;
            const math::Vec3 n{sp * std::cos(theta), cp, sp * std::sin(theta)};

            m.vertices.push_back(Vertex{n * radius, n.normalized(), {u, v}, ring_col});
        }
    }

    const u32 stride = sectors + 1;
    for (u32 r = 0; r < rings; ++r) {
        for (u32 s = 0; s < sectors; ++s) {
            const u32 i0 = r * stride + s;
            const u32 i1 = i0 + 1;
            const u32 i2 = (r + 1) * stride + (s + 1);
            const u32 i3 = (r + 1) * stride + s;
            add_quad(m, i0, i2, i1, i3);
        }
    }

    // Botão central branco frontal (+Z) da Pokébola
    append_box(m, {0.0f, 0.0f, radius * 0.96f}, {radius * 0.24f, radius * 0.24f, radius * 0.14f}, white_bot, 0.0f);

    m.recompute_bounds();
    m.recompute_normals();
    return m;
}

MeshData create_ar_anchor_ring(f32 outer_radius, f32 thickness, u32 segments) {
    MeshData m{};
    if (segments < 6) segments = 6;

    const f32 inner_r = std::max(0.05f, outer_radius - thickness);
    const math::Vec3 holo_cyan{0.15f, 0.95f, 0.85f};

    for (u32 s = 0; s <= segments; ++s) {
        const f32 u   = static_cast<f32>(s) / static_cast<f32>(segments);
        const f32 ang = u * kTwoPi;
        const f32 c   = std::cos(ang);
        const f32 sn  = std::sin(ang);

        m.vertices.push_back(Vertex{{inner_r * c,      0.02f, inner_r * sn},      {0.0f, 1.0f, 0.0f}, {u, 0.0f}, holo_cyan});
        m.vertices.push_back(Vertex{{outer_radius * c, 0.02f, outer_radius * sn}, {0.0f, 1.0f, 0.0f}, {u, 1.0f}, holo_cyan});
    }

    for (u32 s = 0; s < segments; ++s) {
        const u32 b = s * 2;
        add_quad(m, b + 0, b + 2, b + 3, b + 1);
    }

    m.recompute_bounds();
    m.recompute_normals();
    return m;
}

} // namespace procedural

} // namespace pokemon_ar::mesh
