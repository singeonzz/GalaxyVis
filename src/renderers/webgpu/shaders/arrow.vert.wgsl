const unit32:u32 = 0xFF000000u;
const unit24:u32 = 0x00FF0000u;
const unit16:u32 = 0x0000FF00u;
const unit8:u32 = 0x000000FFu;

// 属性attributes
struct Uniforms {
    x: f32,
    y: f32,
    angle: f32,
    sx: f32,
    width: f32,
    color: u32
}
@binding(0) @group(0) var<uniform> uniforms: Uniforms;

// 投影矩阵，透视矩阵
struct Mats {   
        aXformMatrix: mat4x4<f32>,
        projection: mat4x4<f32>,                     
    };
@binding(0) @group(1) var<uniform> mats: Mats;

struct Output {
    @builtin(position) Position: vec4<f32>,
    @location(0) vColor: vec4<f32>,
    @location(1) coords: vec2<f32>
}

@vertex
fn main(
    @location(0) position: vec4<f32>,
    @location(1) coords: vec2<f32>,
) -> Output {

    var output: Output;

    var transMat4 = mat4x4<f32>(
        1.,
        0.,
        0.,
        0.,
        0.,
        1.,
        0.,
        0.,
        0.,
        0.,
        1.,
        0.,
        uniforms.x,
        uniforms.y,
        0.,
        1.
    );

    var angle = uniforms.angle;

    var rotateMat4 = mat4x4<f32>(
        cos(angle),
        sin(angle),
        0.,
        0.,
        -sin(angle),
        cos(angle),
        0.,
        0.,
        0.,
        0.,
        1.,
        0.,
        0.,
        0.,
        0.,
        1.
    );

    var sy: f32;
    var sx: f32;

    sy = uniforms.sx;
    sx = uniforms.width * 3.;

    var scaleMat4 = mat4x4<f32>(
        sx,
        0.,
        0.,
        0.,
        0.,
        sy,
        0.,
        0.,
        0.,
        0.,
        0.,
        0.,
        0.,
        0.,
        0.,
        1.
    );

    var aMat4 = transMat4 * rotateMat4 * scaleMat4;

    output.Position = mats.projection * mats.aXformMatrix * aMat4 * vec4(position.xy, 0.0, 1.0);

    var packedColor: u32 = uniforms.color;
    var ma: f32 = f32((packedColor & unit32) >> 24u) / 255.0;
    var mb: f32 = f32((packedColor & unit24) >> 16u) / 255.0;
    var mg: f32 = f32((packedColor & unit16) >> 8u) / 255.0;
    var mr: f32 = f32(packedColor & unit8) / 255.0;
    output.vColor = vec4<f32>(mr, mg, mb, ma);

    output.coords = coords;

    return output;
}