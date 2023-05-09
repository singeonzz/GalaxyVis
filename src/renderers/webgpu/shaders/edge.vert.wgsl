const unit32:u32 = 0xFF000000u;
const unit24:u32 = 0x00FF0000u;
const unit16:u32 = 0x0000FF00u;
const unit8:u32 = 0x000000FFu;

// 属性attributes
struct Uniforms {
    color: u32,
    width: f32,
    // isArrow: f32,
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
    @location(0) coords: vec3<f32>,
    @location(1) vColor: vec4<f32>,
}

@vertex
fn main(
    // @builtin(instance_index) instanceIdx : u32, 
    @location(0) pos: vec4<f32>,
    @location(1) normal: vec2<f32>
) -> Output {

    var vPos = vec4(
        pos.x + normal.x,
        pos.y + normal.y,
        0.,
        1. 
    );

    var output: Output;

    output.coords = vec3(normal, uniforms.width);

    output.Position = mats.projection * mats.aXformMatrix * vPos;
        
    var packedColor: u32 = uniforms.color;
    var ma: f32 = f32((packedColor & unit32) >> 24u) / 255.0;
    var mb: f32 = f32((packedColor & unit24) >> 16u) / 255.0;
    var mg: f32 = f32((packedColor & unit16) >> 8u) / 255.0;
    var mr: f32 = f32(packedColor & unit8) / 255.0;
    output.vColor = vec4<f32>(mr, mg, mb, ma);

    return output;
}