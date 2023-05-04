// 纹理属性
@binding(1) @group(1) var textureSampler: sampler;
@binding(2) @group(1) var textureData: texture_2d<f32>;

struct inPut {
    @location(0) vUV: vec2<f32>,
}

@fragment
fn frag_main(
    in: inPut
) -> @location(0) vec4<f32> {
    return vec4(1.0, 0.0, 0.0, 1.0);
}